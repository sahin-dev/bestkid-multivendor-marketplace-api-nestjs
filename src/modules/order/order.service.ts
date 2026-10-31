import { forwardRef, Inject, Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BuyerOrderTab, OrderQueryDto, SellerOrderTab } from "./dtos/order-query.dto";
import { CheckoutDto } from "./dtos/checkout.dto";
import { ApplyCouponDto, BuyNowCheckoutSummaryDto, CheckoutSummaryQueryDto, CreateBuyNowCheckoutSessionDto } from "./dtos/checkout-flow.dto";
import { DeliveryService } from "../delivery/delivery.service";
import { AuthenticationStatus, CouponDiscountType, CouponUsageType, CurrencyPreference, OrderCancellationActor, OrderStatus, PaymentProvider, ProductStatus, NotificationType, Prisma } from "generated/prisma/client";
import { NotificationService } from "../notification/notification.service";
import { CreateReviewDto } from "../product/dtos/create-review.dto";
import { ChatService } from "../chat/chat.service";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";
import { CurrencyConversionService } from "../currency/currency.service";
import { PaymentService } from "../payment/payment.service";
import { StripeService } from "../stripe/stripe.service";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { getSellerFeePercent } from "src/config/seller-fee";
import { newSaleEmail, orderCancelledEmail, orderConfirmationEmail } from "src/common/templates/orderEmails.template";

type CurrencyFormattingOptions = {
    convertCurrency?: boolean;
};

type CancellationParams = {
    actor: OrderCancellationActor;
    actorId?: number;
    reason?: string;
    fromStatuses: OrderStatus[];
    toStatus?: OrderStatus;
};

// PENDING orders are unpaid checkouts: a seller only ever sees an order once it has been paid
const SELLER_VISIBLE_STATUSES = Object.values(OrderStatus).filter((status) => status !== OrderStatus.PENDING);

// A paid order that has not left the seller yet puts the unique item back on sale when cancelled
const RELISTABLE_STATUSES: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING];

// Moving money or restocking is done by the payment-aware paths, so an unpaid order can never be
// pushed into fulfilment by hand
const ADMIN_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
    [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.REFUNDED]: [],
};

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly deliveryService: DeliveryService,
        private readonly notificationService: NotificationService,
        private readonly chatService: ChatService,
        private readonly currencyService: CurrencyConversionService,
        private readonly paymentService: PaymentService,
        @Inject(forwardRef(() => StripeService))
        private readonly stripeService: StripeService,
        private readonly smtpProvider: SMTPProvider,
    ) {}

    async getCheckoutSummary(
        userId: number,
        dto: CheckoutSummaryQueryDto = {},
        options: CurrencyFormattingOptions = {},
    ) {
        const { cart_id, ...summary } = await this.buildCheckoutSummary(userId, dto);
        if (options.convertCurrency === false) {
            return summary;
        }

        return this.applyCheckoutSummaryCurrency(summary, await this.getUserCurrency(userId));
    }

    async getCheckoutSummaryForPayment(userId: number, dto: CheckoutSummaryQueryDto = {}) {
        const { cart_id, ...summary } = await this.buildCheckoutSummary(userId, dto);
        return summary;
    }

    async applyCoupon(userId: number, dto: ApplyCouponDto) {
        const summary = dto.productId
            ? await this.getBuyNowCheckoutSummary(userId, {
                  productId: dto.productId,
                  addressId: dto.addressId,
                  country: dto.country,
                  couponCode: dto.couponCode,
              })
            : await this.getCheckoutSummary(userId, dto);
        return {
            valid: true,
            message: summary.coupon?.message ?? "Coupon applied successfully.",
            coupon: summary.coupon,
            price_details: summary.price_details,
        };
    }

    async getBuyNowCheckoutSummary(userId: number, dto: BuyNowCheckoutSummaryDto) {
        const summary = await this.buildBuyNowCheckoutSummary(userId, dto);
        return this.applyCheckoutSummaryCurrency(summary, await this.getUserCurrency(userId));
    }

    async getBuyNowCheckoutSummaryForPayment(userId: number, dto: BuyNowCheckoutSummaryDto) {
        return this.buildBuyNowCheckoutSummary(userId, dto);
    }

    async findAllUserOrders(userId: number, query: OrderQueryDto) {
        const { page = 1, limit = 10, status, tab } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { userId };
        if (status) {
            whereClause.status = status;
        } else if (tab) {
            whereClause.status = { in: this.getStatusesForBuyerTab(tab) };
        }

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    seller: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true, avatar_url: true, country: true } },
                        },
                    },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, image_urls: true } },
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        const userCurrency = await this.getUserCurrency(userId);

        return {
            data: await Promise.all(data.map((order) => this.formatOrderCard(order, userCurrency))),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findAllSellerOrders(sellerId: number, query: OrderQueryDto) {
        const { page = 1, limit = 10, status, sellerTab } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = { sellerId, status: this.getSellerStatusFilter(status, sellerTab) };

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true, avatar_url: true, phone: true } },
                        },
                    },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, image_urls: true } },
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        const userCurrency = await this.getUserCurrency(sellerId);

        return {
            data: await Promise.all(data.map((order) => this.formatSellerOrderCard(order, userCurrency))),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findSellerOrdersByProduct(productId: number, sellerId: number, query: OrderQueryDto) {
        const { page = 1, limit = 10, status, sellerTab } = query;
        const skip = (page - 1) * limit;

        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, image_urls: true, userId: true },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        if (product.userId !== sellerId) {
            throw new ForbiddenException("You do not have permission to access orders for this product");
        }

        const whereClause: any = {
            sellerId,
            items: { some: { productId } },
            status: this.getSellerStatusFilter(status, sellerTab),
        };

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            profile: { select: { full_name: true, avatar_url: true, phone: true } },
                        },
                    },
                    items: {
                        include: {
                            product: { select: { id: true, name: true, image_urls: true } },
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        const userCurrency = await this.getUserCurrency(sellerId);

        return {
            data: await Promise.all(data.map((order) => this.formatSellerOrderCardForProduct(order, productId, userCurrency))),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findOrderById(orderId: number, userId?: number, isAdmin = false) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (userId !== undefined && !isAdmin && order.userId !== userId && order.sellerId !== userId) {
            throw new ForbiddenException("You do not have permission to access this order");
        }

        if (order.userId !== userId && !isAdmin && order.status === OrderStatus.PENDING) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        const currency = userId ? await this.getUserCurrency(userId) : CurrencyPreference.USD;
        return this.formatOrderDetail(order, currency);
    }

    async findSellerOrderById(orderId: number, sellerId: number) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (order.sellerId !== sellerId) {
            throw new ForbiddenException("You do not have permission to access this order");
        }

        if (order.status === OrderStatus.PENDING) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        return this.formatSellerOrderDetail(order, await this.getUserCurrency(sellerId));
    }

    async findOrCreateOrderChat(orderId: number, userId: number) {
        const order = await this.prismaService.order.findUnique({ where: { id: orderId } });
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (order.userId !== userId && order.sellerId !== userId) {
            throw new ForbiddenException("You do not have permission to access this order conversation");
        }

        return this.chatService.findOrCreateRoom(order.userId, order.sellerId);
    }

    async cancelOrder(orderId: number, userId: number, reason?: string) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            select: { userId: true },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (order.userId !== userId) {
            throw new ForbiddenException("You do not have permission to cancel this order");
        }

        const updated = await this.cancelOrderWithRefund(orderId, {
            actor: OrderCancellationActor.BUYER,
            actorId: userId,
            reason,
            fromStatuses: [OrderStatus.PENDING, OrderStatus.CONFIRMED],
        });

        // An unpaid checkout was never shown to the seller, so there is nothing to tell them
        if (updated.confirmed_at) {
            try {
                await this.notificationService.create(
                    updated.sellerId,
                    "Order Cancelled",
                    `Order #${updated.id} has been cancelled by the buyer.`,
                    NotificationType.ORDER,
                );
            } catch (e) {
                this.logger.error("Failed to send cancellation notification", e);
            }
        }

        return this.formatOrderDetail(updated, await this.getUserCurrency(userId));
    }

    async reviewOrderItem(userId: number, orderItemId: number, dto: CreateReviewDto) {
        await assertEntityExists(this.prismaService.baseUser, "User", userId);
        this.assertReviewTextWithinWordLimit(dto.review);

        const orderItem = await this.prismaService.orderItem.findUnique({
            where: { id: orderItemId },
            include: {
                order: true,
                product: true,
                review: true,
            },
        });

        if (!orderItem) {
            throw new NotFoundException(`Order item with ID ${orderItemId} not found`);
        }

        if (orderItem.order.userId !== userId) {
            throw new ForbiddenException("You do not own this order item");
        }

        if (orderItem.order.status !== OrderStatus.DELIVERED) {
            throw new BadRequestException("You can review an item only after the order is delivered");
        }

        if (orderItem.review) {
            throw new BadRequestException("This order item has already been reviewed");
        }

        const review = await this.prismaService.$transaction(async (tx) => {
            const created = await tx.productReview.create({
                data: {
                    productId: orderItem.productId,
                    orderItemId,
                    userId,
                    rating: dto.rating,
                    review: dto.review,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            profile: { select: { full_name: true, avatar_url: true } },
                        },
                    },
                },
            });

            const aggregates = await tx.productReview.aggregate({
                where: { productId: orderItem.productId },
                _count: { id: true },
                _avg: { rating: true },
            });

            await tx.product.update({
                where: { id: orderItem.productId },
                data: {
                    total_reviews: aggregates._count.id,
                    average_rating: aggregates._avg.rating ?? 0,
                },
            });

            return created;
        });

        return review;
    }

    async updateSellerOrderStatus(orderId: number, sellerId: number, status: OrderStatus) {
        const order = await this.prismaService.order.findFirst({
            where: { id: orderId, sellerId },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found for this seller`);
        }

        // Only a successful payment can confirm an order, so PENDING has no seller transitions
        const validTransitions: Record<OrderStatus, OrderStatus[]> = {
            [OrderStatus.PENDING]: [],
            [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
            [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
            [OrderStatus.DELIVERED]: [],
            [OrderStatus.CANCELLED]: [],
            [OrderStatus.REFUNDED]: [],
        };

        const allowed = validTransitions[order.status] || [];
        if (!allowed.includes(status)) {
            throw new BadRequestException(
                `Invalid status transition from ${order.status} to ${status} for seller.`,
            );
        }

        const updated =
            status === OrderStatus.CANCELLED
                ? await this.cancelOrderWithRefund(orderId, {
                      actor: OrderCancellationActor.SELLER,
                      actorId: sellerId,
                      fromStatuses: [order.status],
                  })
                : await this.advanceOrderStatus(orderId, order.status, status);

        // Notify buyer
        try {
            await this.notificationService.create(
                updated.userId,
                "Order Status Updated",
                `Your order #${updated.id} status has been changed to ${status}.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            this.logger.error("Failed to send status update notification", e);
        }

        return this.formatSellerOrderDetail(updated, await this.getUserCurrency(sellerId));
    }

    async findAllOrdersAdmin(query: OrderQueryDto) {
        const { page = 1, limit = 10, status, search } = query;
        const skip = (page - 1) * limit;

        const whereClause: any = {};
        if (status) {
            whereClause.status = status;
        }
        if (search?.trim()) {
            const orderId = Number(search.trim().replace(/^KDF0*/i, ""));
            whereClause.OR = [
                ...(Number.isInteger(orderId) && orderId > 0 && orderId < 2_147_483_647 ? [{ id: orderId }] : []),
                { user: { email: { contains: search.trim(), mode: "insensitive" } } },
                { seller: { email: { contains: search.trim(), mode: "insensitive" } } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prismaService.order.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: this.getOrderDetailInclude(),
                orderBy: {
                    createdAt: "desc",
                },
            }),
            this.prismaService.order.count({ where: whereClause }),
        ]);

        return {
            data: await Promise.all(data.map((order) => this.formatAdminOrder(order))),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findOrderByIdAdmin(orderId: number) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        return {
            ...(await this.formatOrderDetail(order, CurrencyPreference.USD)),
            ...(await this.formatAdminOrder(order)),
            cancellation: this.getCancellationSummary(order),
            next_statuses: ADMIN_STATUS_TRANSITIONS[order.status],
        };
    }

    async updateOrderStatusAdmin(orderId: number, status: OrderStatus) {
        const order = await this.prismaService.order.findUnique({ where: { id: orderId } });
        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (!ADMIN_STATUS_TRANSITIONS[order.status].includes(status)) {
            throw new BadRequestException(`Invalid status transition from ${order.status} to ${status}.`);
        }

        const updated =
            status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED
                ? await this.cancelOrderWithRefund(orderId, {
                      actor: OrderCancellationActor.ADMIN,
                      fromStatuses: [order.status],
                      toStatus: status,
                  })
                : await this.advanceOrderStatus(orderId, order.status, status);

        // Notify buyer and seller
        try {
            await this.notificationService.create(
                updated.userId,
                "Order Status Updated (Admin)",
                `Your order #${updated.id} status has been changed to ${status} by admin.`,
                NotificationType.ORDER,
            );
            await this.notificationService.create(
                updated.sellerId,
                "Order Status Updated (Admin)",
                `Order #${updated.id} status has been changed to ${status} by admin.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            this.logger.error("Failed to send status update notification", e);
        }

        return updated;
    }

    private async buildBuyNowCheckoutSummary(
        userId: number,
        dto: {
            productId: number;
            addressId?: number;
            shippingAddress?: string;
            city?: string;
            postalCode?: string;
            country?: string;
            couponCode?: string;
        },
    ) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: {
                profile: { select: { country: true } },
                addresses: { orderBy: [{ is_default: "desc" }, { createdAt: "desc" }] },
            },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        const { selectedAddress, buyerCountry } = this.resolveBuyerDestination(user, dto);
        const product = await this.prismaService.product.findUnique({
            where: { id: dto.productId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        profile: { select: { full_name: true, avatar_url: true, country: true } },
                        delivery_option: true,
                        stripe_onboarding_complete: true,
                    },
                },
            },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${dto.productId} not found`);
        }

        if (product.status !== ProductStatus.ACTIVE) {
            throw new BadRequestException(`Product ${product.name} is not active`);
        }

        if (product.authentication_status !== AuthenticationStatus.VERIFIED) {
            throw new BadRequestException(`Product ${product.name} has not been authenticated yet`);
        }

        if (!product.user.stripe_onboarding_complete) {
            throw new ForbiddenException(`Seller of product ${product.name} has not completed payment setup.`);
        }

        if (product.userId === userId) {
            throw new BadRequestException("You cannot buy your own product.");
        }

        this.assertNotReservedByOtherBuyer(product, userId);

        const sellerCountry = product.user.profile?.country ?? null;
        const delivery = this.deliveryService.resolveDelivery(
            product.user.delivery_option,
            buyerCountry,
            sellerCountry,
        );
        const unitPrice = this.roundMoney(product.discounted_price ?? product.original_price);
        const subtotal = unitPrice;
        const shippingFee = this.roundMoney(delivery.cost);
        const couponItem = { product, productId: product.id };
        const coupon = dto.couponCode
            ? await this.validateCouponForCart(dto.couponCode, [couponItem])
            : null;
        const discountAmount = coupon?.discount_amount ?? 0;
        const total = this.roundMoney(subtotal + shippingFee - discountAmount);

        return {
            selected_seller_ids: [product.userId],
            cart_item_count: 1,
            seller_groups: [
                {
                    seller: {
                        id: product.userId,
                        email: product.user.email,
                        name: product.user.profile?.full_name ?? product.user.email,
                        avatar_url: product.user.profile?.avatar_url ?? null,
                        country: sellerCountry,
                    },
                    delivery: {
                        type: delivery.type,
                        partner: delivery.partner,
                        cost: shippingFee,
                        days_min: delivery.days_min,
                        days_max: delivery.days_max,
                    },
                    items: [
                        {
                            id: null,
                            productId: product.id,
                            price: unitPrice,
                            line_total: subtotal,
                            product: {
                                id: product.id,
                                name: product.name,
                                image_urls: product.image_urls,
                                image_url: product.image_urls?.[0] ?? null,
                                categoryId: product.categoryId,
                                subCategoryId: product.subCategoryId,
                            },
                        },
                    ],
                    subtotal,
                    delivery_cost: shippingFee,
                    discount_amount: discountAmount,
                    total,
                },
            ],
            addresses: user.addresses,
            selected_address: selectedAddress,
            requires_address_selection: false,
            coupon: coupon
                ? {
                      id: coupon.id,
                      code: coupon.code,
                      discount_type: coupon.discount_type,
                      discount_value: coupon.discount_value,
                      discount_amount: coupon.discount_amount,
                      message: coupon.message,
                  }
                : null,
            price_details: {
                subtotal,
                shipping_fee: shippingFee,
                discount: discountAmount,
                total,
            },
            terms_required: true,
            payment: {
                provider: "stripe",
                next_action: "create_buy_now_checkout_session",
            },
        };
    }

    private async buildCheckoutSummary(
        userId: number,
        dto: { sellerIds?: number[]; cartItemIds?: number[]; addressId?: number; country?: string; couponCode?: string } = {},
    ) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: {
                profile: { select: { country: true } },
                addresses: { orderBy: [{ is_default: "desc" }, { createdAt: "desc" }] },
            },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        const { selectedAddress, buyerCountry } = this.resolveBuyerDestination(user, dto);

        const cart = await this.prismaService.cart.findUnique({
            where: { userId },
            include: {
                cartItems: {
                    include: {
                        product: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                        profile: { select: { full_name: true, avatar_url: true, country: true } },
                                        delivery_option: true,
                                        stripe_onboarding_complete: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!cart || cart.cartItems.length === 0) {
            throw new BadRequestException("Cart is empty");
        }

        const selectedSellerIds = this.normalizePositiveIntegerIds(dto.sellerIds);
        const selectedCartItemIds = this.normalizePositiveIntegerIds(dto.cartItemIds);
        if (selectedSellerIds.length && selectedCartItemIds.length) {
            throw new BadRequestException("Use either sellerIds or cartItemIds, not both.");
        }

        const checkoutItems = selectedCartItemIds.length
            ? cart.cartItems.filter((item) => selectedCartItemIds.includes(item.id))
            : selectedSellerIds.length
              ? cart.cartItems.filter((item) => selectedSellerIds.includes(item.product.userId))
              : cart.cartItems;

        if (checkoutItems.length === 0) {
            throw new BadRequestException(
                selectedCartItemIds.length
                    ? "No cart items found for the selected products."
                    : "No cart items found for the selected seller.",
            );
        }

        if (selectedCartItemIds.length && checkoutItems.length !== selectedCartItemIds.length) {
            throw new BadRequestException("One or more selected cart items were not found in your cart.");
        }

        for (const item of checkoutItems) {
            if (item.product.status !== ProductStatus.ACTIVE) {
                throw new BadRequestException(`Product ${item.product.name} is not active`);
            }
            if (item.product.authentication_status !== AuthenticationStatus.VERIFIED) {
                throw new BadRequestException(`Product ${item.product.name} has not been authenticated yet`);
            }
            if (item.product.userId === userId) {
                throw new BadRequestException(`You cannot checkout your own product: ${item.product.name}`);
            }
            if (!item.product.user.stripe_onboarding_complete) {
                throw new ForbiddenException(`Seller of product ${item.product.name} has not completed payment setup.`);
            }
            this.assertNotReservedByOtherBuyer(item.product, userId);
        }

        const coupon = dto.couponCode
            ? await this.validateCouponForCart(dto.couponCode, checkoutItems)
            : null;

        const sellerMap = new Map<number, typeof checkoutItems>();
        for (const item of checkoutItems) {
            const sellerId = item.product.userId;
            if (!sellerMap.has(sellerId)) {
                sellerMap.set(sellerId, []);
            }
            sellerMap.get(sellerId)!.push(item);
        }

        const groups = Array.from(sellerMap.entries()).map(([sellerId, items]) => {
            const seller = items[0].product.user;
            const sellerCountry = seller.profile?.country ?? null;
            const delivery = this.deliveryService.resolveDelivery(
                seller.delivery_option,
                buyerCountry,
                sellerCountry,
            );
            const subtotal = this.roundMoney(
                items.reduce((sum, item) => sum + this.getCartItemUnitPrice(item), 0),
            );
            const eligible_subtotal = coupon
                ? this.roundMoney(
                      items
                          .filter((item) => this.isCouponApplicableToItem(coupon, item))
                          .reduce((sum, item) => sum + this.getCartItemUnitPrice(item), 0),
                  )
                : 0;

            return {
                seller: {
                    id: sellerId,
                    email: seller.email,
                    name: seller.profile?.full_name ?? seller.email,
                    avatar_url: seller.profile?.avatar_url ?? null,
                    country: sellerCountry,
                },
                delivery: {
                    type: delivery.type,
                    partner: delivery.partner,
                    cost: this.roundMoney(delivery.cost),
                    days_min: delivery.days_min,
                    days_max: delivery.days_max,
                },
                items: items.map((item) => ({
                    id: item.id,
                    productId: item.productId,
                    price: this.getCartItemUnitPrice(item),
                    line_total: this.getCartItemUnitPrice(item),
                    product: {
                        id: item.product.id,
                        name: item.product.name,
                        image_urls: item.product.image_urls,
                        image_url: item.product.image_urls?.[0] ?? null,
                        categoryId: item.product.categoryId,
                        subCategoryId: item.product.subCategoryId,
                    },
                })),
                subtotal,
                delivery_cost: this.roundMoney(delivery.cost),
                eligible_subtotal,
                discount_amount: 0,
                total: 0,
            };
        });

        const subtotal = this.roundMoney(groups.reduce((sum, group) => sum + group.subtotal, 0));
        const shippingFee = this.roundMoney(groups.reduce((sum, group) => sum + group.delivery_cost, 0));
        const discountAmount = coupon?.discount_amount ?? 0;

        for (const group of groups) {
            group.discount_amount = coupon?.eligible_subtotal
                ? this.roundMoney(discountAmount * (group.eligible_subtotal / coupon.eligible_subtotal))
                : 0;
            group.total = this.roundMoney(group.subtotal + group.delivery_cost - group.discount_amount);
        }

        const total = this.roundMoney(groups.reduce((sum, group) => sum + group.total, 0));

        return {
            cart_id: cart.id,
            selected_seller_ids: Array.from(sellerMap.keys()),
            selected_cart_item_ids: checkoutItems.map((item) => item.id),
            cart_item_count: checkoutItems.length,
            seller_groups: groups.map(({ eligible_subtotal, ...group }) => group),
            addresses: user.addresses,
            selected_address: selectedAddress,
            coupon: coupon
                ? {
                      id: coupon.id,
                      code: coupon.code,
                      discount_type: coupon.discount_type,
                      discount_value: coupon.discount_value,
                      discount_amount: coupon.discount_amount,
                      message: coupon.message,
                  }
                : null,
            price_details: {
                subtotal,
                shipping_fee: shippingFee,
                discount: discountAmount,
                total,
            },
            terms_required: true,
            payment: {
                provider: "stripe",
                next_action: "create_checkout_session",
            },
        };
    }

    /**
     * An explicitly chosen address or typed-in country decides the delivery zone. The default
     * address and profile country are only a best guess for previews before the buyer chooses.
     */
    private resolveBuyerDestination(
        user: { addresses: any[]; profile?: { country: string | null } | null },
        dto: { addressId?: number; country?: string },
    ) {
        const fallbackAddress = user.addresses.find((address) => address.is_default) ?? user.addresses[0] ?? null;
        const selectedAddress = dto.addressId
            ? user.addresses.find((address) => address.id === dto.addressId)
            : fallbackAddress;

        if (dto.addressId && !selectedAddress) {
            throw new NotFoundException("Address not found");
        }

        const buyerCountry = dto.addressId
            ? selectedAddress.country
            : dto.country ?? selectedAddress?.country ?? user.profile?.country ?? null;

        return { selectedAddress, buyerCountry };
    }

    private assertNotReservedByOtherBuyer(
        product: { name: string; reserved_until: Date | null; reserved_by_user_id: number | null },
        userId: number,
    ) {
        if (product.reserved_until && product.reserved_until > new Date() && product.reserved_by_user_id !== userId) {
            throw new ConflictException(`${product.name} is currently being purchased by another buyer. Please try again shortly.`);
        }
    }

    private assertSellerDeliversToBuyer(delivery: { partner: string | null }) {
        if (!delivery.partner) {
            throw new BadRequestException("This seller does not deliver to the selected address.");
        }
    }

    private async validateCouponForCart(couponCode: string, cartItems: any[]) {
        const normalizedCode = couponCode.trim();
        const coupon = await this.prismaService.coupon.findFirst({
            where: { code: { equals: normalizedCode, mode: "insensitive" } } as any,
        });

        if (!coupon) {
            throw new BadRequestException("Invalid coupon code. Please try again.");
        }

        const now = new Date();
        if (!coupon.is_active || coupon.start_date > now || coupon.end_date < now) {
            throw new BadRequestException("Invalid coupon code. Please try again.");
        }

        if (
            coupon.usage_type === CouponUsageType.LIMITED &&
            coupon.usage_limit !== null &&
            coupon.used_count >= coupon.usage_limit
        ) {
            throw new BadRequestException("Coupon usage limit has been reached.");
        }

        const eligibleSubtotal = this.roundMoney(
            cartItems
                .filter((item) => this.isCouponApplicableToItem(coupon, item))
                .reduce((sum, item) => sum + this.getCartItemUnitPrice(item), 0),
        );

        if (eligibleSubtotal <= 0) {
            throw new BadRequestException("This coupon is not applicable to the current cart.");
        }

        const discountAmount =
            coupon.discount_type === CouponDiscountType.PERCENTAGE
                ? this.roundMoney((eligibleSubtotal * coupon.discount_value) / 100)
                : this.roundMoney(Math.min(coupon.discount_value, eligibleSubtotal));

        return {
            ...coupon,
            eligible_subtotal: eligibleSubtotal,
            discount_amount: Math.min(discountAmount, eligibleSubtotal),
            message:
                coupon.discount_type === CouponDiscountType.PERCENTAGE
                    ? `${coupon.discount_value}% discount applied to your order.`
                    : `${coupon.discount_value} discount applied to your order.`,
        };
    }

    private isCouponApplicableToItem(
        coupon: { categoryId?: number | null; subCategoryId?: number | null },
        item: any,
    ) {
        if (coupon.categoryId && item.product.categoryId !== coupon.categoryId) {
            return false;
        }
        if (coupon.subCategoryId && item.product.subCategoryId !== coupon.subCategoryId) {
            return false;
        }
        return true;
    }

    private getCartItemUnitPrice(item: any) {
        return this.roundMoney(item.product.discounted_price ?? item.product.original_price);
    }

    private normalizePositiveIntegerIds(ids?: number[]) {
        return [...new Set((ids ?? []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    }

    private async resolveCheckoutAddress(userId: number, dto: CheckoutDto) {
        if (dto.addressId) {
            const address = await this.prismaService.userAddress.findFirst({
                where: { id: dto.addressId, userId },
            });

            if (!address) {
                throw new NotFoundException("Address not found");
            }

            return {
                shippingAddress: address.address,
                city: address.city,
                postalCode: address.postal_code,
                country: address.country,
            };
        }

        if (!dto.shippingAddress || !dto.city || !dto.country) {
            throw new BadRequestException("Provide either addressId or shippingAddress, city, and country.");
        }

        return {
            shippingAddress: dto.shippingAddress,
            city: dto.city,
            postalCode: dto.postalCode,
            country: dto.country,
        };
    }

    private roundMoney(value: number) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    private async getUserCurrency(userId: number): Promise<CurrencyPreference> {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { currency_preference: true },
        });

        return user?.currency_preference ?? CurrencyPreference.USD;
    }

    private async convertUsdAmount(amount: number | null | undefined, currency: CurrencyPreference) {
        if (amount === null || amount === undefined) {
            return amount;
        }

        if (currency === CurrencyPreference.USD) {
            return this.roundMoney(amount);
        }

        return this.currencyService.convertAsync(amount, CurrencyPreference.USD, currency);
    }

    private async applyCheckoutSummaryCurrency(summary: any, currency: CurrencyPreference) {
        if (currency === CurrencyPreference.USD) {
            return {
                ...summary,
                currency,
                base_currency: CurrencyPreference.USD,
            };
        }

        const sellerGroups = await Promise.all(
            summary.seller_groups.map(async (group: any) => {
                const deliveryCost = await this.convertUsdAmount(group.delivery?.cost, currency);
                const items = await Promise.all(
                    group.items.map(async (item: any) => {
                        const price = await this.convertUsdAmount(item.price, currency);
                        return {
                            ...item,
                            price,
                            line_total: await this.convertUsdAmount(item.line_total, currency),
                        };
                    }),
                );

                return {
                    ...group,
                    delivery: group.delivery
                        ? {
                              ...group.delivery,
                              cost: deliveryCost,
                          }
                        : group.delivery,
                    items,
                    subtotal: await this.convertUsdAmount(group.subtotal, currency),
                    delivery_cost: await this.convertUsdAmount(group.delivery_cost, currency),
                    discount_amount: await this.convertUsdAmount(group.discount_amount, currency),
                    total: await this.convertUsdAmount(group.total, currency),
                };
            }),
        );

        return {
            ...summary,
            seller_groups: sellerGroups,
            coupon: summary.coupon
                ? {
                      ...summary.coupon,
                      discount_amount: await this.convertUsdAmount(summary.coupon.discount_amount, currency),
                  }
                : null,
            price_details: {
                ...summary.price_details,
                subtotal: await this.convertUsdAmount(summary.price_details?.subtotal, currency),
                shipping_fee: await this.convertUsdAmount(summary.price_details?.shipping_fee, currency),
                discount: await this.convertUsdAmount(summary.price_details?.discount, currency),
                total: await this.convertUsdAmount(summary.price_details?.total, currency),
            },
            currency,
            base_currency: CurrencyPreference.USD,
        };
    }

    /**
     * Create pending orders for cart checkout (before Stripe session is created).
     * Does NOT delete cart items — those are deleted only on webhook payment success.
     * Each item is held for the buyer for reservationMinutes, so it cannot be sold twice.
     */
    async createPendingCartOrders(userId: number, dto: CheckoutDto, reservationMinutes: number) {
        const checkoutAddress = await this.resolveCheckoutAddress(userId, dto);
        const summary = await this.buildCheckoutSummary(userId, {
            sellerIds: dto.sellerIds,
            cartItemIds: dto.cartItemIds,
            addressId: dto.addressId,
            country: checkoutAddress.country ?? undefined,
            couponCode: dto.couponCode,
        });

        summary.seller_groups.forEach((group) => this.assertSellerDeliversToBuyer(group.delivery));

        const productIds = summary.seller_groups.flatMap((group) => group.items.map((item) => item.productId));
        await this.replaceOpenCheckouts(userId, productIds);

        const createdOrders: any[] = [];

        await this.prismaService.$transaction(async (tx) => {
            await this.reserveProducts(tx, productIds, userId, reservationMinutes);

            for (const group of summary.seller_groups) {
                const order = await tx.order.create({
                    data: {
                        userId,
                        sellerId: group.seller.id,
                        status: OrderStatus.PENDING,
                        total: group.total,
                        delivery_partner: group.delivery.partner,
                        delivery_cost: group.delivery.cost,
                        delivery_days_min: group.delivery.days_min,
                        delivery_days_max: group.delivery.days_max,
                        shippingAddress: checkoutAddress.shippingAddress,
                        city: checkoutAddress.city,
                        postalCode: checkoutAddress.postalCode,
                        country: checkoutAddress.country,
                        items: {
                            create: group.items.map((item) => ({
                                productId: item.productId,
                                price: item.price,
                            })),
                        },
                    },
                    include: { items: true },
                });
                createdOrders.push(order);
            }
        });

        return {
            orders: createdOrders,
            cart_id: summary.cart_id,
            cart_item_ids: summary.selected_cart_item_ids,
            coupon_id: summary.coupon?.id,
        };
    }

    /**
     * Create a pending buy-now order (before Stripe session is created).
     */
    async createPendingBuyNowOrder(
        userId: number,
        dto: Omit<CreateBuyNowCheckoutSessionDto, "successUrl" | "cancelUrl">,
        reservationMinutes: number,
    ) {
        const checkoutAddress = await this.resolveCheckoutAddress(userId, dto);
        const summary = await this.buildBuyNowCheckoutSummary(userId, {
            productId: dto.productId,
            addressId: dto.addressId,
            shippingAddress: checkoutAddress.shippingAddress ?? undefined,
            city: checkoutAddress.city ?? undefined,
            postalCode: checkoutAddress.postalCode ?? undefined,
            country: checkoutAddress.country ?? undefined,
            couponCode: dto.couponCode,
        });

        const group = summary.seller_groups[0];
        const item = group.items[0];

        if (!group.delivery || group.total === null || group.delivery_cost === null) {
            throw new BadRequestException("Select a shipping address before checkout.");
        }

        this.assertSellerDeliversToBuyer(group.delivery);
        await this.replaceOpenCheckouts(userId, [item.productId]);

        const order = await this.prismaService.$transaction(async (tx) => {
            await this.reserveProducts(tx, [item.productId], userId, reservationMinutes);

            const createdOrder = await tx.order.create({
                data: {
                    userId,
                    sellerId: group.seller.id,
                    status: OrderStatus.PENDING,
                    total: group.total,
                    delivery_partner: group.delivery.partner,
                    delivery_cost: group.delivery_cost,
                    delivery_days_min: group.delivery.days_min,
                    delivery_days_max: group.delivery.days_max,
                    shippingAddress: checkoutAddress.shippingAddress,
                    city: checkoutAddress.city,
                    postalCode: checkoutAddress.postalCode,
                    country: checkoutAddress.country,
                    items: {
                        create: {
                            productId: item.productId,
                            price: item.price,
                        },
                    },
                },
                include: { items: true },
            });
            return createdOrder;
        });

        return { order, coupon_id: summary.coupon?.id };
    }

    /**
     * Applies a successful payment. Safe to call repeatedly for the same payment: orders that were
     * already settled are reported, not changed, so a redelivered webhook cannot rewind an order
     * that has since shipped. Orders that can no longer be fulfilled come back in `rejected`,
     * and the caller is responsible for returning that money.
     */
    async finalizePaidOrders(params: {
        orderIds: number[];
        cartId?: number;
        cartItemIds?: number[];
        couponId?: number;
        stripeCheckoutSessionId?: string;
        paymentTransactionId?: number;
    }) {
        const orderIds = [...new Set(params.orderIds.filter((id) => Number.isInteger(id) && id > 0))];
        if (!orderIds.length) {
            throw new BadRequestException("No orders were provided for payment finalization.");
        }

        const confirmed: any[] = [];
        const alreadySettled: number[] = [];
        const rejected: number[] = [];

        for (const orderId of orderIds) {
            const outcome = await this.settleOrder(orderId, params.stripeCheckoutSessionId);
            if (outcome.result === "confirmed") {
                confirmed.push(outcome.order);
            } else if (outcome.result === "already_settled") {
                alreadySettled.push(orderId);
            } else {
                rejected.push(orderId);
            }
        }

        if (rejected.length) {
            await this.cancelPendingPaymentOrders(rejected, "The item was no longer available when payment completed.");
        }

        if (confirmed.length) {
            if (params.cartId) {
                await this.prismaService.cartItem.deleteMany({
                    where: {
                        cartId: params.cartId,
                        productId: { in: confirmed.flatMap((order) => order.items.map((item: any) => item.productId)) },
                    },
                });
            }

            if (params.couponId) {
                await this.prismaService.coupon.update({
                    where: { id: params.couponId },
                    data: { used_count: { increment: 1 } },
                });
            }

            const transaction = params.paymentTransactionId
                ? await this.paymentService.findById(params.paymentTransactionId)
                : null;

            await Promise.all(confirmed.map((order) => this.notifyOrderPaid(order, transaction)));
        }

        return {
            confirmed: confirmed.map((order) => order.id as number),
            alreadySettled,
            rejected,
        };
    }

    private async settleOrder(orderId: number, stripeCheckoutSessionId?: string) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: { items: true, seller: { select: { seller_tier: true } } },
        });

        if (!order) {
            return { result: "rejected" as const };
        }
        if (order.status !== OrderStatus.PENDING) {
            const wasCancelled = order.status === OrderStatus.CANCELLED;
            return { result: wasCancelled ? ("rejected" as const) : ("already_settled" as const) };
        }

        const now = new Date();
        const productIds = [...new Set(order.items.map((item) => item.productId))];
        const platformFeePercent = getSellerFeePercent(order.seller.seller_tier);

        try {
            const confirmedOrder = await this.prismaService.$transaction(async (tx) => {
                for (const productId of productIds) {
                    const sold = await tx.product.updateMany({
                        where: {
                            id: productId,
                            status: ProductStatus.ACTIVE,
                            authentication_status: AuthenticationStatus.VERIFIED,
                            OR: [
                                { reserved_until: null },
                                { reserved_until: { lt: now } },
                                { reserved_by_user_id: order.userId },
                            ],
                        },
                        data: { status: ProductStatus.SOLD, sold_at: now, reserved_until: null, reserved_by_user_id: null },
                    });

                    if (sold.count === 0) {
                        throw new ConflictException(`Product ${productId} is no longer available.`);
                    }
                }

                const claimed = await tx.order.updateMany({
                    where: { id: orderId, status: OrderStatus.PENDING },
                    data: {
                        status: OrderStatus.CONFIRMED,
                        confirmed_at: now,
                        platform_fee_percent: platformFeePercent,
                        seller_net_amount: this.roundMoney(order.total * (1 - platformFeePercent / 100)),
                        ...(stripeCheckoutSessionId ? { stripe_checkout_session_id: stripeCheckoutSessionId } : {}),
                    },
                });

                if (claimed.count === 0) {
                    throw new ConflictException(`Order ${orderId} was settled concurrently.`);
                }

                return { ...order, status: OrderStatus.CONFIRMED };
            });

            return { result: "confirmed" as const, order: confirmedOrder };
        } catch (error) {
            if (!(error instanceof ConflictException)) {
                throw error;
            }

            // Lost a race with a redelivery of this same payment: that is success, not a conflict
            const current = await this.prismaService.order.findUnique({
                where: { id: orderId },
                select: { status: true },
            });
            if (current && current.status !== OrderStatus.PENDING && current.status !== OrderStatus.CANCELLED) {
                return { result: "already_settled" as const };
            }

            this.logger.error(`Paid order ${orderId} could not be fulfilled: ${error.message}`);
            return { result: "rejected" as const };
        }
    }

    private async notifyOrderPaid(order: { id: number; userId: number; sellerId: number }, transaction: any) {
        try {
            await this.notificationService.create(
                order.userId,
                "Order Placed",
                `Your order #${order.id} has been placed successfully.`,
                NotificationType.ORDER,
            );
            await this.notificationService.create(
                order.sellerId,
                "New Order Received",
                `You have received a new order #${order.id}.`,
                NotificationType.ORDER,
            );
            await this.sendOrderPaidEmails(order.id, transaction);
        } catch (e) {
            this.logger.error("Failed to send order notification", e);
        }
    }

    private async sendOrderPaidEmails(orderId: number, transaction: any) {
        const order = await this.prismaService.order.findUniqueOrThrow({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });

        const shared = {
            orderReference: this.getDisplayOrderId(order.id),
            itemNames: order.items.map((item) => item.product.name),
            amount: this.formatChargedAmount(order, transaction),
            deliveryAddress: [order.shippingAddress, order.city, order.postalCode, order.country].filter(Boolean).join(", "),
        };
        const buyerName = order.user.profile?.full_name ?? order.user.email;
        const sellerName = order.seller.profile?.full_name ?? order.seller.email;

        await this.smtpProvider.sendMail(
            order.user.email,
            `Your BestKid order ${shared.orderReference} is confirmed`,
            orderConfirmationEmail({ ...shared, name: buyerName, otherPartyName: sellerName }),
        );
        await this.smtpProvider.sendMail(
            order.seller.email,
            `You sold an item: order ${shared.orderReference}`,
            newSaleEmail({ ...shared, name: sellerName, otherPartyName: buyerName }),
        );
    }

    // The order total is stored in USD, but the buyer is told what their card was really charged
    private formatChargedAmount(order: { id: number; total: number }, transaction: any) {
        const metadata = transaction?.metadata ?? {};
        const plan = Array.isArray(metadata.cartSplitPlan)
            ? metadata.cartSplitPlan.find((entry: any) => Number(entry.orderId) === order.id)
            : undefined;

        if (plan?.orderTotal !== undefined) {
            return this.formatMoney(Number(plan.orderTotal), plan.currency);
        }
        if (transaction && metadata.checkoutMode === "buy_now") {
            return this.formatMoney(transaction.amount, transaction.currency);
        }
        return this.formatMoney(order.total, "usd");
    }

    private formatMoney(amount: number, currency: string) {
        return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
    }

    /**
     * Tells a buyer their money went straight back because the order could not be fulfilled, for
     * example when a payment landed on an order that had already been cancelled.
     */
    async notifyPaymentReturned(orderId: number, refund: { refund_amount?: number; currency?: string }) {
        const order = await this.prismaService.order.findUniqueOrThrow({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });

        try {
            await this.notificationService.create(
                order.userId,
                "Order Cancelled",
                `Order #${order.id} could not be completed and your payment has been refunded.`,
                NotificationType.ORDER,
            );
        } catch (e) {
            this.logger.error("Failed to send refund notification", e);
        }

        await this.sendOrderCancelledEmail(order, this.getRefundNote(refund));
    }

    private getRefundNote(refund?: { refund_amount?: number; currency?: string }) {
        return refund?.refund_amount !== undefined && refund.currency
            ? `A refund of ${this.formatMoney(refund.refund_amount, refund.currency)} has been issued to your original payment method. Your bank may take a few days to show it.`
            : "If you were charged, your refund will be handled by our support team.";
    }

    private async sendOrderCancelledEmail(order: any, refundNote: string) {
        try {
            await this.smtpProvider.sendMail(
                order.user.email,
                `Your BestKid order ${this.getDisplayOrderId(order.id)} was cancelled`,
                orderCancelledEmail({
                    name: order.user.profile?.full_name ?? order.user.email,
                    orderReference: this.getDisplayOrderId(order.id),
                    itemNames: order.items.map((item: any) => item.product.name),
                    refundNote,
                }),
            );
        } catch (e) {
            this.logger.error("Failed to send cancellation email", e);
        }
    }

    async cancelPendingPaymentOrders(orderIds: number[], reason: string) {
        const normalizedOrderIds = [...new Set(orderIds.filter((id) => Number.isInteger(id) && id > 0))];
        if (!normalizedOrderIds.length) {
            return { count: 0 };
        }

        const orders = await this.prismaService.order.findMany({
            where: { id: { in: normalizedOrderIds }, status: OrderStatus.PENDING },
            include: { items: { select: { productId: true } } },
        });

        const result = await this.prismaService.order.updateMany({
            where: { id: { in: orders.map((order) => order.id) }, status: OrderStatus.PENDING },
            data: {
                status: OrderStatus.CANCELLED,
                cancelled_at: new Date(),
                cancelled_by_actor: OrderCancellationActor.SYSTEM,
                cancellation_reason: reason,
            },
        });

        for (const order of orders) {
            await this.releaseReservations(this.prismaService, order.items.map((item) => item.productId), order.userId);
        }

        return result;
    }

    /**
     * Takes an order out of fulfilment and returns the buyer's money. The status is claimed first,
     * so a seller shipping at the same moment cannot race the refund, and put back if the refund
     * fails, so an order is never marked refunded while the money is still held.
     */
    private async cancelOrderWithRefund(orderId: number, params: CancellationParams) {
        const toStatus = params.toStatus ?? OrderStatus.CANCELLED;
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: { items: { select: { productId: true } } },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }
        if (!params.fromStatuses.includes(order.status)) {
            throw new BadRequestException(`Order cannot be cancelled in its current status: ${order.status}`);
        }

        const wasPaid = order.status !== OrderStatus.PENDING;
        const transaction = wasPaid
            ? await this.paymentService.findPaidTransactionForOrder(order.id, order.userId)
            : null;
        const financedByTbi = transaction?.provider === PaymentProvider.TBI_CREDIT;

        if (financedByTbi && params.actor !== OrderCancellationActor.ADMIN) {
            throw new BadRequestException("This order was financed with TBI Credit. Please contact support to cancel it.");
        }

        let refund: { refund_amount?: number; currency?: string } | undefined;

        const claimed = await this.prismaService.order.updateMany({
            where: { id: orderId, status: order.status },
            data: {
                status: toStatus,
                cancelled_at: new Date(),
                cancelled_by_user_id: params.actorId,
                cancelled_by_actor: params.actor,
                cancellation_reason: params.reason,
            },
        });

        if (claimed.count === 0) {
            throw new ConflictException("This order was updated by someone else. Please refresh and try again.");
        }

        if (!wasPaid) {
            await this.stripeService.expireCheckoutSessions([orderId], order.userId);
        } else if (transaction && !financedByTbi) {
            try {
                refund = await this.stripeService.refundOrderPayment(orderId);
            } catch (error) {
                await this.prismaService.order.update({
                    where: { id: orderId },
                    data: {
                        status: order.status,
                        cancelled_at: null,
                        cancelled_by_user_id: null,
                        cancelled_by_actor: null,
                        cancellation_reason: null,
                    },
                });
                throw error;
            }
        } else if (financedByTbi) {
            this.logger.warn(`Order ${orderId} was cancelled by an admin: settle the refund with TBI manually.`);
        } else {
            this.logger.warn(`Paid order ${orderId} has no payment transaction, so nothing was refunded.`);
        }

        const productIds = order.items.map((item) => item.productId);
        if (RELISTABLE_STATUSES.includes(order.status)) {
            await this.prismaService.product.updateMany({
                where: { id: { in: productIds }, status: ProductStatus.SOLD },
                data: { status: ProductStatus.ACTIVE, sold_at: null },
            });
        } else if (!wasPaid) {
            await this.releaseReservations(this.prismaService, productIds, order.userId);
        }

        const updated = await this.prismaService.order.findUniqueOrThrow({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });

        if (wasPaid) {
            await this.sendOrderCancelledEmail(
                updated,
                financedByTbi
                    ? "Your financing will be cancelled by TBI Bank. Our support team will contact you if anything else is needed."
                    : this.getRefundNote(refund),
            );
        }

        return updated;
    }

    private async advanceOrderStatus(orderId: number, fromStatus: OrderStatus, toStatus: OrderStatus) {
        const claimed = await this.prismaService.order.updateMany({
            where: { id: orderId, status: fromStatus },
            data: { status: toStatus, ...this.getOrderTimelineUpdate(toStatus) },
        });

        if (claimed.count === 0) {
            throw new ConflictException("This order was updated by someone else. Please refresh and try again.");
        }

        return this.prismaService.order.findUniqueOrThrow({
            where: { id: orderId },
            include: this.getOrderDetailInclude(),
        });
    }

    /**
     * A buyer retrying checkout replaces their earlier attempt: its Stripe session is closed so it
     * can no longer be paid, and its hold on the items is released for the new attempt.
     */
    private async replaceOpenCheckouts(userId: number, productIds: number[]) {
        const openOrders = await this.prismaService.order.findMany({
            where: { userId, status: OrderStatus.PENDING, items: { some: { productId: { in: productIds } } } },
            select: { id: true },
        });

        if (!openOrders.length) {
            return;
        }

        const orderIds = openOrders.map((order) => order.id);
        await this.stripeService.expireCheckoutSessions(orderIds, userId);
        await this.cancelPendingPaymentOrders(orderIds, "Replaced by a newer checkout attempt.");
    }

    private async reserveProducts(tx: Prisma.TransactionClient, productIds: number[], userId: number, minutes: number) {
        const now = new Date();
        const reservedUntil = new Date(now.getTime() + minutes * 60 * 1000);

        for (const productId of new Set(productIds)) {
            const reserved = await tx.product.updateMany({
                where: {
                    id: productId,
                    status: ProductStatus.ACTIVE,
                    authentication_status: AuthenticationStatus.VERIFIED,
                    OR: [
                        { reserved_until: null },
                        { reserved_until: { lt: now } },
                        { reserved_by_user_id: userId },
                    ],
                },
                data: { reserved_until: reservedUntil, reserved_by_user_id: userId },
            });

            if (reserved.count === 0) {
                throw new ConflictException("This item was just purchased by another buyer and is no longer available.");
            }
        }
    }

    private async releaseReservations(
        client: Pick<Prisma.TransactionClient, "product">,
        productIds: number[],
        userId: number,
    ) {
        await client.product.updateMany({
            where: { id: { in: productIds }, reserved_by_user_id: userId },
            data: { reserved_until: null, reserved_by_user_id: null },
        });
    }

    private getSellerStatusFilter(status?: OrderStatus, sellerTab?: SellerOrderTab) {
        if (status) {
            return { in: SELLER_VISIBLE_STATUSES.filter((visible) => visible === status) };
        }
        if (sellerTab) {
            return { in: this.getStatusesForSellerTab(sellerTab) };
        }
        return { in: SELLER_VISIBLE_STATUSES };
    }

    private getStatusesForBuyerTab(tab: BuyerOrderTab) {
        const tabMap: Record<BuyerOrderTab, OrderStatus[]> = {
            [BuyerOrderTab.ACTIVE]: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.SHIPPED,
            ],
            [BuyerOrderTab.COMPLETE]: [OrderStatus.DELIVERED],
            [BuyerOrderTab.CANCELED]: [OrderStatus.CANCELLED],
        };

        return tabMap[tab];
    }

    private getStatusesForSellerTab(tab: SellerOrderTab) {
        const tabMap: Record<SellerOrderTab, OrderStatus[]> = {
            [SellerOrderTab.ORDER_PLACED]: [OrderStatus.CONFIRMED],
            [SellerOrderTab.CONFIRMED]: [OrderStatus.CONFIRMED],
            [SellerOrderTab.SHIPPED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED],
            [SellerOrderTab.DELIVERED]: [OrderStatus.DELIVERED],
            [SellerOrderTab.CANCELED]: [OrderStatus.CANCELLED],
        };

        return tabMap[tab];
    }

    private getOrderTimelineUpdate(status: OrderStatus) {
        const now = new Date();
        if (status === OrderStatus.CONFIRMED) {
            return { confirmed_at: now };
        }
        if (status === OrderStatus.PROCESSING) {
            return { processing_at: now };
        }
        if (status === OrderStatus.SHIPPED) {
            return { shipped_at: now };
        }
        if (status === OrderStatus.DELIVERED) {
            return { delivered_at: now };
        }
        return {};
    }

    private getOrderDetailInclude() {
        return {
            user: {
                select: {
                    id: true,
                    email: true,
                    profile: { select: { full_name: true, avatar_url: true, phone: true, country: true } },
                },
            },
            seller: {
                select: {
                    id: true,
                    email: true,
                    profile: { select: { full_name: true, avatar_url: true, phone: true, country: true } },
                },
            },
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            image_urls: true,
                            average_rating: true,
                            total_reviews: true,
                        },
                    },
                    returnRequests: { orderBy: { createdAt: "desc" as const }, take: 1 },
                    review: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    profile: { select: { full_name: true, avatar_url: true } },
                                },
                            },
                        },
                    },
                },
            },
        };
    }

    private async formatAdminOrder(order: any) {
        const transaction = await this.paymentService.findPaidTransactionForOrder(order.id, order.userId);
        const financedByTbi = transaction?.provider === PaymentProvider.TBI_CREDIT;

        return {
            id: order.id,
            display_id: this.getDisplayOrderId(order.id),
            status: order.status,
            status_label: this.getStatusLabel(order.status),
            createdAt: order.createdAt,
            total: order.total,
            currency: CurrencyPreference.USD,
            buyer: order.user,
            seller: order.seller,
            item_count: order.items.length,
            preview_item: order.items[0]?.product?.name ?? null,
            payment: transaction
                ? {
                      provider: transaction.provider,
                      status: transaction.status,
                      payment_status: transaction.payment_status,
                      amount: transaction.amount,
                      currency: transaction.currency,
                  }
                : null,
            platform_fee_percent: order.platform_fee_percent,
            seller_net_amount: order.seller_net_amount,
            payout: financedByTbi
                ? {
                      method: "MANUAL",
                      status: order.seller_payout_at
                          ? "PAID"
                          : order.status === OrderStatus.DELIVERED
                            ? "DUE"
                            : "NOT_DUE",
                      paid_at: order.seller_payout_at,
                      reference: order.seller_payout_reference,
                      ...this.paymentService.getManualPayout(transaction, order),
                  }
                : { method: "AUTOMATIC" },
        };
    }

    private async formatOrderCard(order: any, currency: CurrencyPreference) {
        return {
            id: order.id,
            display_id: this.getDisplayOrderId(order.id),
            status: order.status,
            status_label: this.getStatusLabel(order.status),
            status_tone: this.getStatusTone(order.status),
            createdAt: order.createdAt,
            total: await this.convertUsdAmount(order.total, currency),
            currency,
            item_count: order.items.length,
            seller: order.seller,
            preview_items: await Promise.all(
                order.items.slice(0, 2).map(async (item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.product?.name,
                    image_url: item.product?.image_urls?.[0] ?? null,
                    price: await this.convertUsdAmount(item.price, currency),
                })),
            ),
            actions: {
                can_view_details: true,
                can_cancel: this.canCancelOrder(order.status),
            },
        };
    }

    private async formatSellerOrderCard(order: any, currency: CurrencyPreference) {
        return {
            id: order.id,
            display_id: this.getDisplayOrderId(order.id),
            status: order.status,
            status_label: this.getStatusLabel(order.status),
            status_tone: this.getStatusTone(order.status),
            createdAt: order.createdAt,
            total: await this.convertUsdAmount(order.total, currency),
            currency,
            item_count: order.items.length,
            buyer: order.user,
            preview_items: await Promise.all(
                order.items.slice(0, 2).map(async (item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.product?.name,
                    image_url: item.product?.image_urls?.[0] ?? null,
                    price: await this.convertUsdAmount(item.price, currency),
                })),
            ),
            cancellation: this.getCancellationSummary(order),
            timeline: this.getTimelineSummary(order),
            actions: {
                can_view_details: true,
                can_update_status: this.canSellerUpdateStatus(order.status),
            },
        };
    }

    private async formatSellerOrderCardForProduct(order: any, productId: number, currency: CurrencyPreference) {
        const matchedItems = order.items.filter((item: any) => item.productId === productId);

        return {
            ...(await this.formatSellerOrderCard(order, currency)),
            matched_product_items: await Promise.all(
                matchedItems.map(async (item: any) => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.product?.name,
                    image_url: item.product?.image_urls?.[0] ?? null,
                    price: await this.convertUsdAmount(item.price, currency),
                    line_total: await this.convertUsdAmount(item.price, currency),
                })),
            ),
            matched_item_count: matchedItems.length,
        };
    }

    private async formatOrderDetail(order: any, currency: CurrencyPreference) {
        return {
            id: order.id,
            display_id: this.getDisplayOrderId(order.id),
            status: order.status,
            status_label: this.getStatusLabel(order.status),
            status_tone: this.getStatusTone(order.status),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            total: await this.convertUsdAmount(order.total, currency),
            currency,
            delivery: {
                partner: order.delivery_partner,
                cost: await this.convertUsdAmount(order.delivery_cost ?? 0, currency),
                days_min: order.delivery_days_min,
                days_max: order.delivery_days_max,
            },
            delivery_address: {
                address: order.shippingAddress,
                city: order.city,
                postal_code: order.postalCode,
                country: order.country,
            },
            buyer: order.user,
            seller: order.seller,
            cancellation: this.getCancellationSummary(order),
            timeline: this.getTimelineSummary(order),
            actions: {
                can_cancel: this.canCancelOrder(order.status),
            },
            items: await Promise.all(order.items.map((item: any) => this.formatOrderItem(item, order.status, currency))),
        };
    }

    private async formatSellerOrderDetail(order: any, currency: CurrencyPreference) {
        const chatRoomId = await this.getExistingChatRoomId(order.userId, order.sellerId);
        return {
            ...(await this.formatOrderDetail(order, currency)),
            chat_room_id: chatRoomId,
            ordered_by: order.user,
            actions: {
                can_update_status: this.canSellerUpdateStatus(order.status),
                can_message_buyer: true,
            },
            status_options: [
                OrderStatus.CONFIRMED,
                OrderStatus.SHIPPED,
                OrderStatus.DELIVERED,
                OrderStatus.CANCELLED,
            ],
        };
    }

    private async formatOrderItem(item: any, orderStatus: OrderStatus, currency: CurrencyPreference) {
        const latestReturn = item.returnRequests?.[0] ?? null;
        const price = await this.convertUsdAmount(item.price, currency);
        return {
            id: item.id,
            productId: item.productId,
            price,
            line_total: price,
            product: item.product
                ? {
                      id: item.product.id,
                      name: item.product.name,
                      image_urls: item.product.image_urls,
                      image_url: item.product.image_urls?.[0] ?? null,
                      average_rating: item.product.average_rating,
                      total_reviews: item.product.total_reviews,
                  }
                : null,
            review: item.review ?? null,
            return_request: latestReturn,
            actions: {
                can_review: orderStatus === OrderStatus.DELIVERED && !item.review,
                reviewed: Boolean(item.review),
                can_return: orderStatus === OrderStatus.DELIVERED && !latestReturn,
                return_requested: Boolean(latestReturn),
            },
        };
    }

    private getDisplayOrderId(orderId: number) {
        return `KDF${String(orderId).padStart(10, "0")}`;
    }

    private getStatusLabel(status: OrderStatus) {
        const labels: Record<OrderStatus, string> = {
            [OrderStatus.PENDING]: "Awaiting Payment",
            [OrderStatus.CONFIRMED]: "Confirmed",
            [OrderStatus.PROCESSING]: "Shipped",
            [OrderStatus.SHIPPED]: "Shipped",
            [OrderStatus.DELIVERED]: "Delivered",
            [OrderStatus.CANCELLED]: "Canceled",
            [OrderStatus.REFUNDED]: "Refunded",
        };

        return labels[status];
    }

    private getTimelineSummary(order: any) {
        return {
            confirmed_at: order.confirmed_at,
            processing_at: order.processing_at,
            shipped_at: order.shipped_at,
            delivered_at: order.delivered_at,
            cancelled_at: order.cancelled_at,
        };
    }

    private canSellerUpdateStatus(status: OrderStatus) {
        const finalStatuses: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED];
        return !finalStatuses.includes(status);
    }

    private async getExistingChatRoomId(buyerId: number, sellerId: number) {
        const room = await this.prismaService.chatRoom.findUnique({
            where: { buyerId_sellerId: { buyerId, sellerId } },
            select: { id: true },
        });
        return room?.id ?? null;
    }

    private getStatusTone(status: OrderStatus) {
        const tones: Record<OrderStatus, string> = {
            [OrderStatus.PENDING]: "info",
            [OrderStatus.CONFIRMED]: "primary",
            [OrderStatus.PROCESSING]: "warning",
            [OrderStatus.SHIPPED]: "warning",
            [OrderStatus.DELIVERED]: "success",
            [OrderStatus.CANCELLED]: "danger",
            [OrderStatus.REFUNDED]: "neutral",
        };

        return tones[status];
    }

    private canCancelOrder(status: OrderStatus) {
        return status === OrderStatus.PENDING || status === OrderStatus.CONFIRMED;
    }

    private getCancellationSummary(order: any) {
        if (order.status !== OrderStatus.CANCELLED) {
            return null;
        }

        const actor = order.cancelled_by_actor ?? OrderCancellationActor.SYSTEM;
        const labelMap: Record<OrderCancellationActor, string> = {
            [OrderCancellationActor.BUYER]: "You Canceled This Order",
            [OrderCancellationActor.SELLER]: "Seller Canceled This Order",
            [OrderCancellationActor.ADMIN]: "Admin Canceled This Order",
            [OrderCancellationActor.SYSTEM]: "This Order Was Canceled",
        };

        return {
            actor,
            message: labelMap[actor],
            cancelled_at: order.cancelled_at,
            cancelled_by_user_id: order.cancelled_by_user_id,
            reason: order.cancellation_reason,
        };
    }

    private assertReviewTextWithinWordLimit(review?: string) {
        if (!review) {
            return;
        }

        const wordCount = review.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 100) {
            throw new BadRequestException("Review cannot be longer than 100 words");
        }
    }
}
