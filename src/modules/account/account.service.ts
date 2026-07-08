import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CurrencyPreference, LanguagePreference, OrderStatus, ReturnStatus } from "generated/prisma/client";
import { EncoderProvider } from "../auth/providers/encoder.provider";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountAddressDto, UpdateAccountAddressDto } from "./dtos/account-address.dto";

@Injectable()
export class AccountService {
    private readonly activeOrderStatuses = [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
    ];

    constructor(
        private readonly prismaService: PrismaService,
        private readonly encoder: EncoderProvider,
    ) {}

    async getSettings(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            omit: { password: true },
            include: {
                profile: true,
                addresses: { orderBy: [{ is_default: "desc" }, { createdAt: "desc" }] },
            },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return {
            ...user,
            connected_account: this.mapConnectedAccount(user),
        };
    }

    async getHeaderSummary(userId: number) {
        const [user, wishlistCount, unreadNotificationCount, cart] = await Promise.all([
            this.prismaService.baseUser.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    profile: { select: { full_name: true, avatar_url: true } },
                },
            }),
            this.prismaService.wishlistItem.count({ where: { userId } }),
            this.prismaService.notification.count({ where: { userId, isRead: false } }),
            this.prismaService.cart.findUnique({
                where: { userId },
                include: { cartItems: { select: { quantity: true } } },
            }),
        ]);

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return {
            user,
            counts: {
                wishlist: wishlistCount,
                cart: cart?.cartItems.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
                notifications: unreadNotificationCount,
            },
        };
    }

    async getBuyingSummary(userId: number) {
        const [activeOrders, completedOrders, cancelledOrders, returnRequests, acceptedReturns, rejectedReturns] =
            await Promise.all([
                this.prismaService.order.count({
                    where: { userId, status: { in: this.activeOrderStatuses } },
                }),
                this.prismaService.order.count({ where: { userId, status: OrderStatus.DELIVERED } }),
                this.prismaService.order.count({ where: { userId, status: OrderStatus.CANCELLED } }),
                this.prismaService.returnRequest.count({ where: { userId, status: ReturnStatus.PENDING } }),
                this.prismaService.returnRequest.count({
                    where: {
                        userId,
                        status: { in: [ReturnStatus.APPROVED, ReturnStatus.PROCESSING, ReturnStatus.COMPLETED] },
                    },
                }),
                this.prismaService.returnRequest.count({ where: { userId, status: ReturnStatus.REJECTED } }),
            ]);

        return {
            orders: {
                active: activeOrders,
                complete: completedOrders,
                canceled: cancelledOrders,
            },
            returns: {
                return_requests: returnRequests,
                accepted: acceptedReturns,
                rejected: rejectedReturns,
            },
        };
    }

    async listAddresses(userId: number) {
        await this.ensureUserExists(userId);
        return this.prismaService.userAddress.findMany({
            where: { userId },
            orderBy: [{ is_default: "desc" }, { createdAt: "desc" }],
        });
    }

    async createAddress(userId: number, dto: CreateAccountAddressDto) {
        await this.ensureUserExists(userId);

        const addressCount = await this.prismaService.userAddress.count({ where: { userId } });
        const shouldSetDefault = dto.is_default === true || addressCount === 0;

        return this.prismaService.$transaction(async (tx) => {
            if (shouldSetDefault) {
                await tx.userAddress.updateMany({
                    where: { userId },
                    data: { is_default: false },
                });
            }

            return tx.userAddress.create({
                data: {
                    userId,
                    address_name: dto.address_name,
                    address: dto.address,
                    city: dto.city,
                    postal_code: dto.postal_code,
                    country: dto.country,
                    is_default: shouldSetDefault,
                },
            });
        });
    }

    async updateAddress(userId: number, addressId: number, dto: UpdateAccountAddressDto) {
        await this.ensureAddressBelongsToUser(userId, addressId);

        return this.prismaService.$transaction(async (tx) => {
            if (dto.is_default === true) {
                await tx.userAddress.updateMany({
                    where: { userId, id: { not: addressId } },
                    data: { is_default: false },
                });
            }

            return tx.userAddress.update({
                where: { id: addressId },
                data: dto,
            });
        });
    }

    async deleteAddress(userId: number, addressId: number) {
        const address = await this.ensureAddressBelongsToUser(userId, addressId);

        await this.prismaService.$transaction(async (tx) => {
            await tx.userAddress.delete({ where: { id: addressId } });

            if (address.is_default) {
                const nextAddress = await tx.userAddress.findFirst({
                    where: { userId },
                    orderBy: { createdAt: "desc" },
                });

                if (nextAddress) {
                    await tx.userAddress.update({
                        where: { id: nextAddress.id },
                        data: { is_default: true },
                    });
                }
            }
        });

        return { message: "Address deleted successfully" };
    }

    async updateLanguagePreference(userId: number, language: LanguagePreference) {
        return this.updatePreference(userId, { language_preference: language });
    }

    async updateCurrencyPreference(userId: number, currency: CurrencyPreference) {
        return this.updatePreference(userId, { currency_preference: currency });
    }

    async getConnectedAccount(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: {
                stripe_account_id: true,
                stripe_onboarding_complete: true,
            },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return this.mapConnectedAccount(user);
    }

    async deleteAccount(userId: number, password: string) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        const isPasswordValid = await this.encoder.compare(password, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException("Invalid password");
        }

        const restriction = await this.getDeleteRestriction(userId);
        if (restriction.restricted) {
            throw new ConflictException(restriction);
        }

        await this.prismaService.$transaction(async (tx) => {
            await tx.userAddress.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.otpVerification.deleteMany({ where: { userId } });
            await tx.recentlyView.deleteMany({ where: { userId } });
            await tx.wishlistItem.deleteMany({ where: { userId } });
            await tx.sellerDeliveryOption.deleteMany({ where: { sellerId: userId } });

            const cart = await tx.cart.findUnique({ where: { userId } });
            if (cart) {
                await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
                await tx.cart.delete({ where: { id: cart.id } });
            }

            const chatRooms = await tx.chatRoom.findMany({
                where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
                select: { id: true },
            });
            const chatRoomIds = chatRooms.map((room) => room.id);
            if (chatRoomIds.length > 0) {
                await tx.chatMessage.deleteMany({ where: { chatRoomId: { in: chatRoomIds } } });
                await tx.chatRoom.deleteMany({ where: { id: { in: chatRoomIds } } });
            }

            await tx.productReview.deleteMany({ where: { userId } });

            const products = await tx.product.findMany({
                where: { userId },
                select: { id: true },
            });
            const productIds = products.map((product) => product.id);
            if (productIds.length > 0) {
                await tx.cartItem.deleteMany({ where: { productId: { in: productIds } } });
                await tx.recentlyView.deleteMany({ where: { productId: { in: productIds } } });
                await tx.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });
                await tx.productReview.deleteMany({ where: { productId: { in: productIds } } });
                await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } });
                await tx.product.deleteMany({ where: { id: { in: productIds } } });
            }

            const orders = await tx.order.findMany({
                where: { OR: [{ userId }, { sellerId: userId }] },
                select: { id: true },
            });
            const orderIds = orders.map((order) => order.id);
            if (orderIds.length > 0) {
                await tx.returnRequest.deleteMany({
                    where: { orderItem: { orderId: { in: orderIds } } },
                });
                await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
                await tx.order.deleteMany({ where: { id: { in: orderIds } } });
            }

            await tx.returnRequest.deleteMany({ where: { userId } });

            await tx.baseUser.delete({ where: { id: userId } });

            if (user.profile_id) {
                await tx.profile.delete({ where: { id: user.profile_id } });
            }
        });

        return { message: "Account deleted successfully" };
    }

    private async updatePreference(
        userId: number,
        data: { language_preference?: LanguagePreference; currency_preference?: CurrencyPreference },
    ) {
        return this.prismaService.baseUser.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                language_preference: true,
                currency_preference: true,
            },
        });
    }

    private async ensureUserExists(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return user;
    }

    private async ensureAddressBelongsToUser(userId: number, addressId: number) {
        const address = await this.prismaService.userAddress.findFirst({
            where: { id: addressId, userId },
        });

        if (!address) {
            throw new NotFoundException("Address not found");
        }

        return address;
    }

    private async getDeleteRestriction(userId: number) {
        const [activeOrders, pendingReturns] = await Promise.all([
            this.prismaService.order.count({
                where: {
                    OR: [{ userId }, { sellerId: userId }],
                    status: { in: this.activeOrderStatuses },
                },
            }),
            this.prismaService.returnRequest.count({
                where: {
                    status: ReturnStatus.PENDING,
                    OR: [
                        { userId },
                        {
                            orderItem: {
                                order: { sellerId: userId },
                            },
                        },
                    ],
                },
            }),
        ]);

        return {
            restricted: activeOrders > 0 || pendingReturns > 0,
            reason:
                activeOrders > 0 || pendingReturns > 0
                    ? "Your account cannot be deleted while you have active ongoing orders or active return requests."
                    : null,
            active_orders: activeOrders,
            pending_returns: pendingReturns,
        };
    }

    private mapConnectedAccount(user: {
        stripe_account_id?: string | null;
        stripe_onboarding_complete?: boolean | null;
    }) {
        return {
            provider: "stripe",
            connected: Boolean(user.stripe_account_id && user.stripe_onboarding_complete),
            account_id: user.stripe_account_id ?? null,
            onboarding_complete: user.stripe_onboarding_complete ?? false,
        };
    }
}
