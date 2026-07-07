import { Injectable } from "@nestjs/common";
import { OrderStatus } from "generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AdminPeriod } from "./dtos/admin-period-query.dto";
import { AdminEarningsQueryDto } from "./dtos/admin-earnings-query.dto";

@Injectable()
export class AdminService {
    constructor(private readonly prismaService: PrismaService) {}

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
            this.prismaService.order.aggregate({
                where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] } },
                _sum: { total: true },
            }),
            this.prismaService.contactRequest.count(),
        ]);

        return {
            totalUsers,
            totalEarnings: totalEarnings._sum.total ?? 0,
            totalSupport,
        };
    }

    async getActivity(period: AdminPeriod = AdminPeriod.TODAY) {
        const current = this.getDateFilter(period);
        const previous = this.getPreviousDateFilter(period);

        const [newUsers, totalEarnings, newSupport, prevUsers, prevEarnings, prevSupport] = await Promise.all([
            this.prismaService.baseUser.count({ where: { role: "USER", createdAt: current } }),
            this.prismaService.order.aggregate({
                where: {
                    createdAt: current,
                    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
                },
                _sum: { total: true },
            }),
            this.prismaService.contactRequest.count({ where: { createdAt: current } }),
            this.prismaService.baseUser.count({ where: { role: "USER", createdAt: previous } }),
            this.prismaService.order.aggregate({
                where: {
                    createdAt: previous,
                    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
                },
                _sum: { total: true },
            }),
            this.prismaService.contactRequest.count({ where: { createdAt: previous } }),
        ]);

        return {
            period,
            rows: [
                this.formatActivityRow("NEW_USERS_JOINED", "New Users Joined", newUsers, prevUsers),
                this.formatActivityRow(
                    "TOTAL_EARNINGS",
                    "Total Earnings",
                    totalEarnings._sum.total ?? 0,
                    prevEarnings._sum.total ?? 0,
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
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
        };

        const [aggregate, previousAggregate, data, total] = await Promise.all([
            this.prismaService.order.aggregate({
                where,
                _sum: { total: true },
            }),
            previous
                ? this.prismaService.order.aggregate({
                      where: {
                          createdAt: previous,
                          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
                      },
                      _sum: { total: true },
                  })
                : Promise.resolve({ _sum: { total: 0 } }),
            this.prismaService.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    total: true,
                    createdAt: true,
                    seller: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true } },
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true } },
                        },
                    },
                },
            }),
            this.prismaService.order.count({ where }),
        ]);

        const earnings = aggregate._sum.total ?? 0;
        const previousEarnings = previousAggregate._sum.total ?? 0;
        const percentage = this.calculateChangePercentage(earnings, previousEarnings);

        return {
            period,
            matrix: {
                earnings,
                previousEarnings,
                percentage,
                direction: percentage > 0 ? "HIGHER" : percentage < 0 ? "LOWER" : "SAME",
            },
            transactions: data.map((order, index) => ({
                sl: skip + index + 1,
                pay_on: order.createdAt,
                txn_id: `TXN${String(order.id).padStart(8, "0")}`,
                amount: order.total,
                order_id: order.id,
                seller: order.seller,
                buyer: order.user,
            })),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
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
