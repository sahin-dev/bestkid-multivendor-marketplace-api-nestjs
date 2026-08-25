import { Injectable } from "@nestjs/common";
import { CurrencyPreference, PaymentStatus } from "generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AdminPeriod } from "./dtos/admin-period-query.dto";
import { AdminEarningsQueryDto } from "./dtos/admin-earnings-query.dto";
import { CurrencyConversionService } from "../currency/currency.service";

@Injectable()
export class AdminService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly currencyService: CurrencyConversionService,
    ) {}

    async getDashboard(period: AdminPeriod = AdminPeriod.TODAY) {
        const [cards, activity, recentlyJoinedUsers] = await Promise.all([
            this.getCards(),
            this.getActivity(period),
            this.getRecentlyJoinedUsers(),
        ]);

        return {
            cards,
            activity,
            recentlyJoinedUsers,
        };
    }

    async getCards() {
        const [totalUsers, totalEarnings, totalSupport] = await Promise.all([
            this.prismaService.baseUser.count({ where: { role: "USER" } }),
            this.getPlatformEarningsUsd(),
            this.prismaService.contactRequest.count(),
        ]);

        return {
            totalUsers,
            totalEarnings,
            totalSupport,
        };
    }

    async getActivity(period: AdminPeriod = AdminPeriod.TODAY) {
        const current = this.getDateFilter(period);
        const previous = this.getPreviousDateFilter(period);

        const [newUsers, totalEarnings, newSupport, prevUsers, prevEarnings, prevSupport] = await Promise.all([
            this.prismaService.baseUser.count({ where: { role: "USER", createdAt: current } }),
            this.getPlatformEarningsUsd(current),
            this.prismaService.contactRequest.count({ where: { createdAt: current } }),
            this.prismaService.baseUser.count({ where: { role: "USER", createdAt: previous } }),
            this.getPlatformEarningsUsd(previous),
            this.prismaService.contactRequest.count({ where: { createdAt: previous } }),
        ]);

        return {
            period,
            rows: [
                this.formatActivityRow("NEW_USERS_JOINED", "New Users Joined", newUsers, prevUsers),
                this.formatActivityRow(
                    "TOTAL_EARNINGS",
                    "Total Earnings",
                    totalEarnings,
                    prevEarnings,
                ),
                this.formatActivityRow("NEW_SUPPORT_REQUESTS", "New Help & Support", newSupport, prevSupport),
            ],
        };
    }

    async getEarnings(query: AdminEarningsQueryDto) {
        const { period = AdminPeriod.TODAY, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;
        const current = this.getDateFilter(period);
        const previous = this.getPreviousDateFilter(period);

        const where = {
            createdAt: current,
            status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED] },
        };

        const [earnings, previousEarnings, data, total] = await Promise.all([
            this.getPlatformEarningsUsd(current),
            this.getPlatformEarningsUsd(previous),
            this.prismaService.paymentTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    provider: true,
                    status: true,
                    metadata: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true } },
                        },
                    },
                    order: {
                        select: {
                            id: true,
                            seller: {
                                select: {
                                    id: true,
                                    email: true,
                                    profile: { select: { full_name: true } },
                                },
                            },
                        },
                    },
                },
            }),
            this.prismaService.paymentTransaction.count({ where }),
        ]);

        const percentage = this.calculateChangePercentage(earnings, previousEarnings);

        return {
            period,
            matrix: {
                earnings,
                previousEarnings,
                percentage,
                direction: percentage > 0 ? "HIGHER" : percentage < 0 ? "LOWER" : "SAME",
            },
            transactions: await Promise.all(
                data.map(async (transaction, index) => {
                    const metadata = this.toMetadataObject(transaction.metadata);
                    return {
                        sl: skip + index + 1,
                        pay_on: transaction.createdAt,
                        txn_id: `TXN${String(transaction.id).padStart(8, "0")}`,
                        amount: await this.getTransactionPlatformFeeUsd(transaction),
                        gross_amount: await this.convertPaymentAmountToUsd(transaction.amount, transaction.currency),
                        provider: transaction.provider,
                        currency: CurrencyPreference.USD,
                        payment_currency: transaction.currency,
                        checkout_mode: this.getMetadataString(metadata.checkoutMode),
                        order_id: transaction.order?.id ?? this.getMetadataString(metadata.orderId) ?? null,
                        order_ids: this.getMetadataString(metadata.orderIds)
                            ?.split(",")
                            .map((id) => Number(id.trim()))
                            .filter((id) => Number.isInteger(id) && id > 0) ?? null,
                        seller: transaction.order?.seller ?? null,
                        buyer: transaction.user,
                        payment_status: transaction.status,
                    };
                }),
            ),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    private async getPlatformEarningsUsd(dateFilter?: { gte?: Date; lte?: Date; lt?: Date }) {
        const transactions = await this.prismaService.paymentTransaction.findMany({
            where: {
                ...(dateFilter ? { createdAt: dateFilter } : {}),
                status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED] },
            },
            select: {
                amount: true,
                currency: true,
                metadata: true,
            },
        });

        const fees = await Promise.all(
            transactions.map((transaction) => this.getTransactionPlatformFeeUsd(transaction)),
        );

        return this.roundMoney(fees.reduce((sum, fee) => sum + fee, 0));
    }

    private async getTransactionPlatformFeeUsd(transaction: {
        amount?: number;
        currency?: string;
        metadata: unknown;
    }) {
        const metadata = this.toMetadataObject(transaction.metadata);
        const grossFee = await this.getGrossPlatformFeeUsd(metadata, transaction.currency);
        const refundedFee = await this.getRefundedPlatformFeeUsd(metadata, transaction.currency);

        return this.roundMoney(Math.max(0, grossFee - refundedFee));
    }

    private async getGrossPlatformFeeUsd(metadata: Record<string, any>, transactionCurrency?: string) {
        const cartEntries = this.getCartFeeEntries(metadata);
        if (cartEntries.length) {
            const fees = await Promise.all(
                cartEntries.map((entry) => this.getEntryPlatformFeeUsd(entry, transactionCurrency)),
            );
            return this.roundMoney(fees.reduce((sum, fee) => sum + fee, 0));
        }

        return this.getFeeFromTotalAndPercentOrAmount(metadata, transactionCurrency);
    }

    private async getRefundedPlatformFeeUsd(metadata: Record<string, any>, transactionCurrency?: string) {
        const refunds = Array.isArray(metadata.returnRefunds) ? metadata.returnRefunds : [];
        if (!refunds.length) {
            return 0;
        }

        const cartEntries = this.getCartFeeEntries(metadata);
        const refundFees = await Promise.all(
            refunds.map(async (refund) => {
                const orderId = Number(refund?.orderId);
                const matchingEntry = cartEntries.find((entry) => Number(entry?.orderId) === orderId);
                const percent = this.toFiniteNumber(
                    matchingEntry?.platformFeePercent ?? metadata.platformFeePercent,
                );
                if (percent === null) {
                    return 0;
                }

                const amountUsd = this.toFiniteNumber(refund?.amountUsd);
                const refundBaseUsd =
                    amountUsd ??
                    (await this.convertPaymentAmountToUsd(
                        this.toFiniteNumber(refund?.amount) ?? 0,
                        refund?.currency ?? transactionCurrency,
                    ));

                return this.roundMoney((refundBaseUsd * percent) / 100);
            }),
        );

        return this.roundMoney(refundFees.reduce((sum, fee) => sum + fee, 0));
    }

    private getCartFeeEntries(metadata: Record<string, any>) {
        if (Array.isArray(metadata.cartTransfers) && metadata.cartTransfers.length) {
            return metadata.cartTransfers;
        }

        return Array.isArray(metadata.cartSplitPlan) ? metadata.cartSplitPlan : [];
    }

    private async getEntryPlatformFeeUsd(entry: Record<string, any>, transactionCurrency?: string) {
        return this.getFeeFromTotalAndPercentOrAmount(entry, entry.currency ?? transactionCurrency);
    }

    private async getFeeFromTotalAndPercentOrAmount(
        source: Record<string, any>,
        sourceCurrency?: string,
    ) {
        const totalUsd = this.toFiniteNumber(source.totalUsd ?? source.orderTotalUsd ?? source.orderAmountUsd);
        const percent = this.toFiniteNumber(source.platformFeePercent);
        if (totalUsd !== null && percent !== null) {
            return this.roundMoney((totalUsd * percent) / 100);
        }

        const feeAmountCents = this.toFiniteNumber(source.platformFeeAmountCents);
        if (feeAmountCents !== null) {
            return this.convertPaymentAmountToUsd(feeAmountCents / 100, sourceCurrency);
        }

        const feeAmount = this.toFiniteNumber(source.platformFeeAmount);
        if (feeAmount !== null) {
            return this.convertPaymentAmountToUsd(feeAmount, sourceCurrency);
        }

        return 0;
    }

    private async convertPaymentAmountToUsd(amount: number, currency?: string) {
        const fromCurrency = this.currencyPreferenceFromString(currency);
        if (fromCurrency === CurrencyPreference.USD) {
            return this.roundMoney(amount);
        }

        return this.currencyService.convertAsync(amount, fromCurrency, CurrencyPreference.USD);
    }

    private currencyPreferenceFromString(currency?: string | null): CurrencyPreference {
        const normalized = String(currency || CurrencyPreference.USD).toUpperCase();
        return Object.values(CurrencyPreference).includes(normalized as CurrencyPreference)
            ? (normalized as CurrencyPreference)
            : CurrencyPreference.USD;
    }

    private toMetadataObject(metadata: unknown): Record<string, any> {
        return metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? (metadata as Record<string, any>)
            : {};
    }

    private getMetadataString(value: unknown) {
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
    }

    private toFiniteNumber(value: unknown) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    private roundMoney(value: number) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    private async getRecentlyJoinedUsers() {
        return this.prismaService.baseUser.findMany({
            where: { role: "USER" },
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                email: true,
                is_blocked: true,
                seller_tier: true,
                createdAt: true,
                profile: {
                    select: {
                        full_name: true,
                        phone: true,
                        avatar_url: true,
                    },
                },
            },
        });
    }

    private formatActivityRow(key: string, label: string, value: number, previousValue: number) {
        const percentage = this.calculateChangePercentage(value, previousValue);

        return {
            key,
            label,
            value,
            previousValue,
            percentage,
            direction: percentage > 0 ? "HIGHER" : percentage < 0 ? "LOWER" : "SAME",
        };
    }

    private calculateChangePercentage(value: number, previousValue: number) {
        if (previousValue === 0) {
            return value > 0 ? 100 : 0;
        }

        return Number((((value - previousValue) / previousValue) * 100).toFixed(2));
    }

    private getDateFilter(period: AdminPeriod) {
        if (period === AdminPeriod.ALL) {
            return undefined;
        }

        const now = new Date();
        const start = new Date(now);

        if (period === AdminPeriod.TODAY) {
            start.setHours(0, 0, 0, 0);
        } else if (period === AdminPeriod.LAST_24_HOURS) {
            start.setDate(start.getDate() - 1);
        } else if (period === AdminPeriod.LAST_WEEK) {
            start.setDate(start.getDate() - 7);
        } else if (period === AdminPeriod.LAST_FORTNIGHT) {
            start.setDate(start.getDate() - 14);
        } else if (period === AdminPeriod.LAST_MONTH) {
            start.setMonth(start.getMonth() - 1);
        } else if (period === AdminPeriod.LAST_YEAR) {
            start.setFullYear(start.getFullYear() - 1);
        }

        return { gte: start, lte: now };
    }

    private getPreviousDateFilter(period: AdminPeriod) {
        if (period === AdminPeriod.ALL) {
            return undefined;
        }

        const current = this.getDateFilter(period);
        if (!current) {
            return undefined;
        }

        const duration = current.lte.getTime() - current.gte.getTime();
        const previousEnd = new Date(current.gte);
        const previousStart = new Date(previousEnd.getTime() - duration);

        return { gte: previousStart, lt: previousEnd };
    }
}
