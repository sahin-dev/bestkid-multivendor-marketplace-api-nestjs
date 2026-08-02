import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus } from "generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SellerEarningsPeriod, SellerEarningsQueryDto } from "./dtos/seller-earnings-query.dto";

@Injectable()
export class SellerService {
    constructor(private readonly prismaService: PrismaService) {}

    async getOptions(sellerId: number) {
        const [customerOrders, returnOrders, deliveryOptions, earningsAggregate] = await Promise.all([
            this.prismaService.order.count({ where: { sellerId } }),
            this.prismaService.returnRequest.count({
                where: { orderItem: { order: { sellerId } } },
            }),
            this.prismaService.sellerDeliveryOption.findUnique({ where: { sellerId } }),
            this.prismaService.order.aggregate({
                where: {
                    sellerId,
                    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
                },
                _sum: { total: true },
            }),
        ]);

        return {
            options: [
                { key: "customer_orders", label: "Customer Orders", count: customerOrders },
                { key: "return_orders", label: "Return Orders", count: returnOrders },
                { key: "earnings", label: "Earnings", amount: earningsAggregate._sum.total ?? 0 },
                {
                    key: "delivery_options",
                    label: "Delivery Options",
                    configured: Boolean(deliveryOptions),
                },
            ],
        };
    }

    async getReadiness(sellerId: number) {
        const seller = await this.prismaService.baseUser.findUnique({
            where: { id: sellerId },
            select: {
                stripe_account_id: true,
                stripe_onboarding_complete: true,
                delivery_option: true,
            },
        });
        if (!seller) {
            throw new NotFoundException(`Seller with ID ${sellerId} not found`);
        }

        const deliveryConfigured = this.isDeliveryConfigured(seller.delivery_option);
        const stripeConnected = Boolean(seller.stripe_onboarding_complete);

        return {
            stripe_connected: stripeConnected,
            stripe_account_id: seller.stripe_account_id ?? null,
            delivery_configured: deliveryConfigured,
            can_create_product: stripeConnected,
            can_publish_product: stripeConnected && deliveryConfigured,
            blockers: [
                ...(stripeConnected ? [] : ["STRIPE_ACCOUNT_REQUIRED"]),
                ...(deliveryConfigured ? [] : ["DELIVERY_INFORMATION_MISSING"]),
            ],
            actions: {
                connect_stripe: !stripeConnected,
                setup_delivery: !deliveryConfigured,
            },
        };
    }

    async getEarnings(sellerId: number, query: SellerEarningsQueryDto) {
        const { page = 1, limit = 10, period = SellerEarningsPeriod.TODAY } = query;
        const skip = (page - 1) * limit;
        const dateFilter = this.getDateFilter(period);

        const where = {
            sellerId,
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
        };

        const [aggregate, orders, total] = await Promise.all([
            this.prismaService.order.aggregate({
                where,
                _sum: { total: true },
            }),
            this.prismaService.order.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true, avatar_url: true } },
                        },
                    },
                    items: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            this.prismaService.order.count({ where }),
        ]);

        return {
            period,
            earnings: aggregate._sum.total ?? 0,
            payment_history: orders.map((order) => ({
                order_id: order.id,
                customer: {
                    id: order.user.id,
                    name: order.user.profile?.full_name ?? order.user.email,
                    avatar_url: order.user.profile?.avatar_url ?? null,
                },
                paid_at: order.createdAt,
                status: order.status,
                amount: order.total,
                item_count: order.items.length,
            })),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    private getDateFilter(period: SellerEarningsPeriod) {
        if (period === SellerEarningsPeriod.ALL) {
            return null;
        }

        const now = new Date();
        const start = new Date(now);

        if (period === SellerEarningsPeriod.TODAY) {
            start.setHours(0, 0, 0, 0);
        } else if (period === SellerEarningsPeriod.LAST_24_HOURS) {
            start.setDate(start.getDate() - 1);
        } else if (period === SellerEarningsPeriod.LAST_WEEK) {
            start.setDate(start.getDate() - 7);
        } else if (period === SellerEarningsPeriod.LAST_FORTNIGHT) {
            start.setDate(start.getDate() - 14);
        } else if (period === SellerEarningsPeriod.LAST_MONTH) {
            start.setMonth(start.getMonth() - 1);
        } else if (period === SellerEarningsPeriod.LAST_YEAR) {
            start.setFullYear(start.getFullYear() - 1);
        }

        return { gte: start };
    }

    private isDeliveryConfigured(deliveryOption: any) {
        if (!deliveryOption) {
            return false;
        }

        const hasDomestic =
            Boolean(deliveryOption.domestic_partner) &&
            deliveryOption.domestic_cost !== null &&
            deliveryOption.domestic_days_min !== null &&
            deliveryOption.domestic_days_max !== null;
        const hasInternational =
            Boolean(deliveryOption.international_partner) &&
            deliveryOption.international_cost !== null &&
            deliveryOption.international_days_min !== null &&
            deliveryOption.international_days_max !== null;

        return hasDomestic || hasInternational;
    }
}
