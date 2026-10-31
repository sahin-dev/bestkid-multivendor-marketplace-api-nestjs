import {
    BadGatewayException,
    BadRequestException,
    forwardRef,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import stripeConfig, { StripeConfig } from "src/config/stripe.config";
import { getSellerFeePercent } from "src/config/seller-fee";
import Stripe from "stripe";
import { OrderService } from "../order/order.service";
import { PaymentService } from "../payment/payment.service";
import {
    CreateBuyNowCheckoutSessionDto,
    CreateStripeCheckoutSessionDto,
} from "../order/dtos/checkout-flow.dto";
import { CurrencyPreference, NotificationType, OrderStatus, PaymentProvider, PaymentStatus, ReturnStatus, SellerTier } from "generated/prisma/client";
import { CurrencyConversionService } from "../currency/currency.service";
import { NotificationService } from "../notification/notification.service";

// Stripe's minimum session lifetime is 30 minutes. The hold on the items outlives the session, so
// an item cannot be resold while a buyer is still able to complete payment for it.
const CHECKOUT_SESSION_MINUTES = 31;
const CHECKOUT_RESERVATION_MINUTES = 40;
const ORDER_CANCELLATION_REFUND = "ORDER_CANCELLATION";

type SellerPaymentProfile = {
    id: number;
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
    seller_tier: SellerTier;
};

type PaymentSplit = {
    platformFeePercent: number;
    platformFeeAmount: number;
    sellerTransferAmount: number;
};

@Injectable()
export class StripeService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor(
        private readonly prismaService: PrismaService,
        @Inject(forwardRef(() => OrderService))
        private readonly orderService: OrderService,
        private readonly paymentService: PaymentService,
        private readonly currencyService: CurrencyConversionService,
        private readonly notificationService: NotificationService,
        @Inject(stripeConfig.KEY)
        private readonly stripeConfiguration: ConfigType<typeof StripeConfig>,
    ) {
        const stripeKey = this.stripeConfiguration.stripe_key?.trim();
        if (!stripeKey) {
            throw new Error("STRIPE_KEY is not configured.");
        }

        this.stripe = new Stripe(stripeKey, {
            apiVersion: "2026-06-24.dahlia" as any,
        });
    }

    /**
     * Create a Stripe Express account for the seller and return the onboarding URL.
     */
    async onboardSeller(
        userId: number,
        returnUrl?: string,
        refreshUrl?: string,
    ) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user)
            throw new NotFoundException(`User with ID ${userId} not found`);

        let accountId = user.stripe_account_id;

        // Create Stripe account only if it doesn't exist yet
        if (!accountId) {
            const account = await this.createStripeAccount(user.email);
            accountId = account.id;
            await this.prismaService.baseUser.update({
                where: { id: userId },
                data: { stripe_account_id: accountId },
            });
        }

        const appBaseUrl = process.env.APP_URL ?? "http://localhost:3000";
        const accountLink = await this.createStripeAccountLink(
            accountId,
            refreshUrl ?? `${appBaseUrl}/stripe/onboard`,
            this.withStripeAccountId(
                returnUrl ?? `${appBaseUrl}/stripe/callback`,
                accountId,
            ),
        );

        return { url: accountLink.url, stripe_account_id: accountId };
    }

    private async createStripeAccount(email: string) {
        try {
            return await this.stripe.accounts.create({
                type: "express",
                email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            });
        } catch (err) {
            this.throwStripeOnboardingError(err, "create connected account");
        }
    }

    private async createStripeAccountLink(
        accountId: string,
        refreshUrl: string,
        returnUrl: string,
    ) {
        try {
            return await this.stripe.accountLinks.create({
                account: accountId,
                refresh_url: refreshUrl,
                return_url: returnUrl,
                type: "account_onboarding",
            });
        } catch (err) {
            this.throwStripeOnboardingError(err, "create onboarding link");
        }
    }

    private withStripeAccountId(url: string, accountId: string) {
        const parsedUrl = new URL(url);
        parsedUrl.searchParams.set("accountId", accountId);
        return parsedUrl.toString();
    }

    private throwStripeOnboardingError(err: unknown, action: string): never {
        const stripeError = err as
            | Partial<Stripe.errors.StripeError>
            | undefined;
        const message =
            stripeError?.message ?? "Stripe rejected the onboarding request.";

        this.logger.error(
            `Failed to ${action}: ${message}`,
            err instanceof Error ? err.stack : undefined,
        );

        if (stripeError?.type?.startsWith("Stripe")) {
            throw new BadRequestException(
                `Stripe onboarding failed: ${message}`,
            );
        }

        throw new BadGatewayException(
            `Stripe onboarding failed while trying to ${action}.`,
        );
    }

    async createCheckoutSession(
        userId: number,
        dto: CreateStripeCheckoutSessionDto,
    ) {
        if (!dto.acceptedTerms) {
            throw new BadRequestException(
                "You must agree to the Terms & Conditions and Privacy Policy before payment.",
            );
        }

        if (dto.productId !== undefined) {
            if (dto.sellerIds?.length || dto.cartItemIds?.length) {
                throw new BadRequestException(
                    "Use either productId for Buy Now or sellerIds/cartItemIds for cart checkout, not both.",
                );
            }

            return this.createBuyNowCheckoutSession(userId, {
                productId: dto.productId,
                addressId: dto.addressId,
                shippingAddress: dto.shippingAddress,
                city: dto.city,
                postalCode: dto.postalCode,
                country: dto.country,
                couponCode: dto.couponCode,
                successUrl: dto.successUrl,
                cancelUrl: dto.cancelUrl,
                acceptedTerms: true,
            });
        }

        // Exact items win over a whole-seller selection
        const sellerIds = dto.cartItemIds?.length ? undefined : dto.sellerIds;

        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const checkoutSummary = await this.orderService.getCheckoutSummary(
            userId,
            {
                sellerIds,
                cartItemIds: dto.cartItemIds,
                addressId: dto.addressId,
                country: dto.country,
                couponCode: dto.couponCode,
            },
        );
        const checkoutSummaryUsd =
            await this.orderService.getCheckoutSummaryForPayment(userId, {
                sellerIds,
                cartItemIds: dto.cartItemIds,
                addressId: dto.addressId,
                country: dto.country,
                couponCode: dto.couponCode,
            });
        const paymentCurrency = this.normalizeStripeCurrency(
            checkoutSummary.currency ?? (await this.getUserCurrency(userId)),
        );
        const amountTotal = checkoutSummary.price_details.total;
        const amountInCents = Math.round(amountTotal * 100);

        if (amountInCents <= 0) {
            throw new BadRequestException(
                "Checkout total must be greater than zero.",
            );
        }

        const sellerPaymentProfiles = await this.getSellerPaymentProfiles(
            checkoutSummary.seller_groups.map((group) => group.seller.id),
        );
        this.assertSellersCanReceivePayments(sellerPaymentProfiles);
        const transferGroup = this.buildTransferGroup("cart", userId);

        // Step 1: Create pending orders (before Stripe session)
        const orderResult = await this.orderService.createPendingCartOrders(
            userId,
            {
                sellerIds,
                cartItemIds: dto.cartItemIds,
                addressId: dto.addressId,
                shippingAddress: dto.shippingAddress,
                city: dto.city,
                postalCode: dto.postalCode,
                country: dto.country,
                couponCode: dto.couponCode,
                acceptedTerms: true,
            },
            CHECKOUT_RESERVATION_MINUTES,
        );

        const orderIds = orderResult.orders.map((o) => o.id).join(",");
        const cartItemIds = orderResult.cart_item_ids.join(",");
        const orderBySellerId = new Map(
            orderResult.orders.map((order) => [order.sellerId, order]),
        );
        const cartSplitPlan = checkoutSummary.seller_groups.map((group) => {
            const seller = sellerPaymentProfiles.get(group.seller.id)!;
            const order = orderBySellerId.get(group.seller.id);
            if (!order) {
                throw new BadRequestException(
                    `Could not prepare payout split for seller ${group.seller.id}.`,
                );
            }

            const orderAmountCents = Math.round(group.total * 100);
            const orderTotalUsd =
                checkoutSummaryUsd.seller_groups.find(
                    (usdGroup) => usdGroup.seller.id === group.seller.id,
                )?.total ?? order.total;
            const split = this.calculatePaymentSplit(
                orderAmountCents,
                seller.seller_tier,
            );

            return {
                orderId: order.id,
                sellerId: group.seller.id,
                sellerTier: seller.seller_tier,
                stripeAccountId: seller.stripe_account_id,
                orderTotal: group.total,
                orderTotalUsd,
                currency: paymentCurrency,
                orderAmountCents,
                ...split,
            };
        });

        // Step 2: Create Stripe checkout session with orderId in metadata
        const session = await this.createSessionOrReleaseOrders(
            orderResult.orders.map((order) => order.id),
            {
            mode: "payment",
            payment_method_types: ["card"],
            expires_at: this.getSessionExpiry(),
            success_url: dto.successUrl,
            cancel_url: dto.cancelUrl,
            customer_email: user.email,
            client_reference_id: String(userId),
            payment_intent_data: {
                transfer_group: transferGroup,
            },
            line_items: [
                {
                    price_data: {
                        currency: paymentCurrency,
                        product_data: {
                            name: "BestKid checkout order",
                            description: `${checkoutSummary.cart_item_count} item(s) from ${checkoutSummary.seller_groups.length} seller(s)`,
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                checkoutMode: "cart",
                userId: String(userId),
                orderIds: orderIds,
                addressId: String(dto.addressId),
                cartId: String(orderResult.cart_id),
                cartItemIds,
                couponId: orderResult.coupon_id
                    ? String(orderResult.coupon_id)
                    : "",
                total: String(amountTotal),
                totalUsd: String(checkoutSummaryUsd.price_details.total),
                currency: paymentCurrency,
                transferGroup,
            },
            },
        );

        // Step 3: Create pending payment transaction
        await this.paymentService.createPendingTransaction({
            userId,
            amount: amountTotal,
            currency: paymentCurrency,
            stripeSessionId: session.id,
            metadata: {
                checkoutMode: "cart",
                orderIds: orderIds,
                cartId: String(orderResult.cart_id),
                cartItemIds,
                transferGroup,
                cartSplitPlan,
                totalUsd: checkoutSummaryUsd.price_details.total,
                currency: paymentCurrency,
            },
        });

        return {
            session_id: session.id,
            url: session.url,
            currency: paymentCurrency,
            amount_total: amountTotal,
            checkout_summary: checkoutSummary,
            pending_orders: orderResult.orders,
        };
    }

    async createBuyNowCheckoutSession(
        userId: number,
        dto: CreateBuyNowCheckoutSessionDto,
    ) {
        if (!dto.acceptedTerms) {
            throw new BadRequestException(
                "You must agree to the Terms & Conditions and Privacy Policy before payment.",
            );
        }
        if (
            !dto.addressId &&
            (!dto.shippingAddress || !dto.city || !dto.country)
        ) {
            throw new BadRequestException(
                "Select a shipping address before payment.",
            );
        }

        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const checkoutSummary =
            await this.orderService.getBuyNowCheckoutSummary(userId, dto);
        const checkoutSummaryUsd =
            await this.orderService.getBuyNowCheckoutSummaryForPayment(userId, dto);
        const paymentCurrency = this.normalizeStripeCurrency(
            checkoutSummary.currency ?? (await this.getUserCurrency(userId)),
        );
        const amountTotal = checkoutSummary.price_details.total;
        if (amountTotal === null) {
            throw new BadRequestException(
                "Select a shipping address before payment.",
            );
        }
        const amountInCents = Math.round(amountTotal * 100);
        const item = checkoutSummary.seller_groups[0].items[0];
        const sellerId = checkoutSummary.seller_groups[0].seller.id;
        const seller = await this.prismaService.baseUser.findUnique({
            where: { id: sellerId },
            select: {
                id: true,
                stripe_account_id: true,
                stripe_onboarding_complete: true,
                seller_tier: true,
            },
        });

        if (amountInCents <= 0) {
            throw new BadRequestException(
                "Checkout total must be greater than zero.",
            );
        }

        if (!seller?.stripe_onboarding_complete || !seller.stripe_account_id) {
            throw new BadRequestException(
                "Seller has not completed Stripe onboarding.",
            );
        }

        const { platformFeePercent, platformFeeAmount } =
            this.calculatePaymentSplit(amountInCents, seller.seller_tier);
        const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
            {
                transfer_data: {
                    destination: seller.stripe_account_id,
                },
            };
        if (platformFeeAmount > 0) {
            paymentIntentData.application_fee_amount = platformFeeAmount;
        }

        // Step 1: Create pending buy-now order (before Stripe session)
        const orderResult = await this.orderService.createPendingBuyNowOrder(
            userId,
            {
                productId: dto.productId,
                addressId: dto.addressId,
                shippingAddress: dto.shippingAddress,
                city: dto.city,
                postalCode: dto.postalCode,
                country: dto.country,
                couponCode: dto.couponCode,
                acceptedTerms: true,
            },
            CHECKOUT_RESERVATION_MINUTES,
        );

        const orderId = orderResult.order.id;

        // Step 2: Create Stripe checkout session with orderId in metadata
        const session = await this.createSessionOrReleaseOrders([orderId], {
            mode: "payment",
            payment_method_types: ["card"],
            expires_at: this.getSessionExpiry(),
            success_url: dto.successUrl,
            cancel_url: dto.cancelUrl,
            customer_email: user.email,
            client_reference_id: String(userId),
            payment_intent_data: paymentIntentData,
            line_items: [
                {
                    price_data: {
                        currency: paymentCurrency,
                        product_data: {
                            name: item.product.name,
                            description: "Buy Now checkout",
                            images: this.getStripeProductImages(
                                item.product.image_url,
                            ),
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                checkoutMode: "buy_now",
                userId: String(userId),
                orderId: String(orderId),
                productId: String(dto.productId),
                sellerId: String(sellerId),
                couponId: orderResult.coupon_id
                    ? String(orderResult.coupon_id)
                    : "",
                platformFeePercent: String(platformFeePercent),
                platformFeeAmount: String(platformFeeAmount / 100),
                total: String(amountTotal),
                totalUsd: String(checkoutSummaryUsd.price_details.total),
                currency: paymentCurrency,
            },
        });

        // Step 3: Create pending payment transaction
        await this.paymentService.createPendingTransaction({
            userId,
            orderId,
            amount: amountTotal,
            currency: paymentCurrency,
            stripeSessionId: session.id,
            metadata: {
                checkoutMode: "buy_now",
                orderId: String(orderId),
                productId: String(dto.productId),
                sellerId: String(sellerId),
                couponId: orderResult.coupon_id
                    ? String(orderResult.coupon_id)
                    : "",
                platformFeePercent: String(platformFeePercent),
                platformFeeAmount: String(platformFeeAmount / 100),
                totalUsd: checkoutSummaryUsd.price_details.total,
                currency: paymentCurrency,
            },
        });

        return {
            session_id: session.id,
            url: session.url,
            currency: paymentCurrency,
            amount_total: amountTotal,
            checkout_summary: checkoutSummary,
            pending_order: orderResult.order,
        };
    }

    private calculatePlatformFeeAmount(
        amountInCents: number,
        platformFeePercent: number,
    ) {
        return Math.min(
            amountInCents,
            Math.round((amountInCents * platformFeePercent) / 100),
        );
    }

    private calculatePaymentSplit(
        amountInCents: number,
        sellerTier: SellerTier,
    ): PaymentSplit {
        const platformFeePercent = getSellerFeePercent(sellerTier);
        const platformFeeAmount = this.calculatePlatformFeeAmount(
            amountInCents,
            platformFeePercent,
        );
        return {
            platformFeePercent,
            platformFeeAmount,
            sellerTransferAmount: Math.max(
                0,
                amountInCents - platformFeeAmount,
            ),
        };
    }

    private buildTransferGroup(mode: string, userId: number) {
        return `bestkid_${mode}_${userId}_${Date.now()}`;
    }

    private async getSellerPaymentProfiles(sellerIds: number[]) {
        const sellers = await this.prismaService.baseUser.findMany({
            where: { id: { in: [...new Set(sellerIds)] } },
            select: {
                id: true,
                stripe_account_id: true,
                stripe_onboarding_complete: true,
                seller_tier: true,
            },
        });

        return new Map<number, SellerPaymentProfile>(
            sellers.map((seller) => [seller.id, seller]),
        );
    }

    private assertSellersCanReceivePayments(
        sellers: Map<number, SellerPaymentProfile>,
    ) {
        for (const seller of sellers.values()) {
            if (
                !seller.stripe_onboarding_complete ||
                !seller.stripe_account_id
            ) {
                throw new BadRequestException(
                    `Seller ${seller.id} has not completed Stripe onboarding.`,
                );
            }
        }
    }

    private getStripeProductImages(imageUrl?: string | null) {
        const absoluteUrl = this.toStripeImageUrl(imageUrl);
        return absoluteUrl ? [absoluteUrl] : undefined;
    }

    private toStripeImageUrl(imageUrl?: string | null) {
        const trimmedUrl = imageUrl?.trim();
        if (!trimmedUrl) {
            return undefined;
        }

        if (/^https?:\/\//i.test(trimmedUrl)) {
            return trimmedUrl;
        }

        if (!trimmedUrl.startsWith("/")) {
            return undefined;
        }

        const baseUrl = (process.env.API_PUBLIC_URL ?? process.env.SWAGGER_SERVER_URL)?.trim();
        if (!baseUrl) {
            return undefined;
        }

        return `${baseUrl.replace(/\/+$/, "")}${trimmedUrl}`;
    }

    /**
     * Called when Stripe redirects back after onboarding. Checks account status.
     */
    async handleCallback(userId?: number, accountId?: string) {
        const trimmedAccountId = accountId?.trim();
        const user = trimmedAccountId
            ? await this.prismaService.baseUser.findFirst({
                  where: { stripe_account_id: trimmedAccountId },
              })
            : userId
              ? await this.prismaService.baseUser.findUnique({
                    where: { id: userId },
                })
              : null;

        if (!user) {
            throw new NotFoundException(
                trimmedAccountId
                    ? `User with Stripe account ${trimmedAccountId} not found`
                    : `User with ID ${userId} not found`,
            );
        }
        if (!user.stripe_account_id) {
            throw new BadRequestException("No Stripe account linked.");
        }

        return this.syncStripeAccountStatus(
            user.id,
            user.stripe_account_id,
        );
    }

    /**
     * Get the onboarding status for the current seller.
     */
    async getStatus(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: {
                id: true,
                stripe_account_id: true,
                stripe_onboarding_complete: true,
            },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }
        if (user.stripe_account_id) {
            return this.syncStripeAccountStatus(user.id, user.stripe_account_id);
        }
        return {
            stripe_account_id: user.stripe_account_id ?? null,
            stripe_onboarding_complete:
                user.stripe_onboarding_complete ?? false,
        };
    }

    private async syncStripeAccountStatus(userId: number, accountId: string) {
        const account = await this.stripe.accounts.retrieve(accountId);
        const isComplete = this.isStripeOnboardingComplete(account);

        await this.prismaService.baseUser.update({
            where: { id: userId },
            data: { stripe_onboarding_complete: isComplete },
        });

        return {
            stripe_onboarding_complete: isComplete,
            stripe_account_id: accountId,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            message: isComplete
                ? "Stripe onboarding complete!"
                : "Stripe onboarding not yet complete.",
        };
    }

    // details_submitted alone is not enough: Stripe rejects charges until the account is enabled
    private isStripeOnboardingComplete(account: Stripe.Account) {
        return Boolean(account.details_submitted && account.charges_enabled);
    }

    private getSessionExpiry() {
        return Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_MINUTES * 60;
    }

    private async createSessionOrReleaseOrders(
        orderIds: number[],
        params: Stripe.Checkout.SessionCreateParams,
    ) {
        try {
            return await this.stripe.checkout.sessions.create(params);
        } catch (err) {
            await this.orderService.cancelPendingPaymentOrders(
                orderIds,
                "Stripe checkout session could not be created.",
            );
            throw err;
        }
    }

    /**
     * Closes the Stripe sessions behind orders that are being abandoned, so a stale tab can no
     * longer take a payment for them.
     */
    async expireCheckoutSessions(orderIds: number[], buyerId: number) {
        const transactions = await this.paymentService.findOpenTransactionsForOrders(orderIds, buyerId);

        for (const transaction of transactions) {
            if (transaction.stripe_session_id) {
                try {
                    await this.stripe.checkout.sessions.expire(transaction.stripe_session_id);
                } catch (err: any) {
                    this.logger.warn(
                        `Could not expire Stripe session ${transaction.stripe_session_id}: ${err?.message}`,
                    );
                }
            }

            await this.paymentService.updateProviderStatus(transaction.id, {
                status: PaymentStatus.CANCELLED,
                paymentStatus: "expired",
            });
        }
    }

    /**
     * Handle Stripe webhook events (account.updated).
     */
    async handleWebhook(rawBody: Buffer, signature: string) {
        let event: Stripe.Event;
        try {
            event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                this.stripeConfiguration.webhook_key!,
            );
        } catch (err: any) {
            throw new BadRequestException(
                `Webhook signature verification failed: ${err.message}`,
            );
        }

        if (event.type === "account.updated") {
            const account = event.data.object as Stripe.Account;
            const isComplete = this.isStripeOnboardingComplete(account);
            await this.prismaService.baseUser.updateMany({
                where: { stripe_account_id: account.id },
                data: { stripe_onboarding_complete: isComplete },
            });
            this.logger.log(
                `Stripe account ${account.id} onboarding status synced via webhook: ${isComplete}.`,
            );
        }

        if (event.type === "checkout.session.completed") {
            await this.handleCheckoutSessionCompleted(
                event.data.object as Stripe.Checkout.Session,
            );
        }

        if (event.type === "checkout.session.expired") {
            await this.handleCheckoutSessionExpired(
                event.data.object as Stripe.Checkout.Session,
            );
        }

        if (event.type === "charge.dispute.created") {
            const dispute = event.data.object as Stripe.Dispute;
            this.logger.error(
                `Stripe dispute ${dispute.id} opened for charge ${dispute.charge} (${dispute.amount} ${dispute.currency}): respond in the Stripe dashboard.`,
            );
        }

        return { received: true };
    }

    private getSessionOrderIds(session: Stripe.Checkout.Session) {
        return session.metadata?.checkoutMode === "buy_now"
            ? (this.numberArrayFromMetadata(session.metadata?.orderId) ?? [])
            : (this.numberArrayFromMetadata(session.metadata?.orderIds) ?? []);
    }

    private async handleCheckoutSessionCompleted(
        session: Stripe.Checkout.Session,
    ) {
        if (session.payment_status !== "paid") {
            this.logger.warn(
                `Skipping checkout.session.completed ${session.id}: payment_status is ${session.payment_status ?? "unknown"}.`,
            );
            return;
        }

        const transaction = await this.paymentService.markSucceeded(
            session.id,
            session.payment_intent?.toString(),
            session.customer?.toString(),
        );

        const isBuyNow = session.metadata?.checkoutMode === "buy_now";
        const orderIds = this.getSessionOrderIds(session);

        if (orderIds.length === 0) {
            this.logger.warn(
                `Skipping checkout.session.completed ${session.id}: missing order metadata.`,
            );
            return;
        }

        try {
            // Step 1: Confirm orders and mark items sold
            const { confirmed, alreadySettled, rejected } =
                await this.orderService.finalizePaidOrders({
                    orderIds,
                    cartId: this.numberFromMetadata(session.metadata?.cartId),
                    cartItemIds: this.numberArrayFromMetadata(session.metadata?.cartItemIds),
                    couponId: this.numberFromMetadata(session.metadata?.couponId),
                    // Buy-now has a 1:1 mapping. A cart session spans several orders, and the
                    // column is unique, so for carts the session lives on the payment transaction.
                    stripeCheckoutSessionId: isBuyNow ? session.id : undefined,
                    paymentTransactionId: transaction?.id,
                });

            // Step 2: Link payment transaction to orders
            await this.paymentService.linkOrderToSession(session.id, orderIds[0]);

            // Step 3: The buyer paid for something that cannot be delivered: return that money
            for (const orderId of rejected) {
                const refund = await this.refundOrderPayment(orderId);
                if (refund.refunded) {
                    await this.orderService.notifyPaymentReturned(orderId, refund);
                }
            }

            // Step 4: Split the platform charge to each seller account
            const settled = [...confirmed, ...alreadySettled];
            if (!isBuyNow && settled.length) {
                await this.transferCartPaymentToSellers(session, settled);
            }

            this.logger.log(
                `Settled checkout session ${session.id}: ${confirmed.length} confirmed, ${rejected.length} refunded.`,
            );
        } catch (err: any) {
            this.logger.error(
                `Failed to process checkout session ${session.id}`,
                err?.stack ?? err,
            );
            throw err;
        }
    }

    private async handleCheckoutSessionExpired(
        session: Stripe.Checkout.Session,
    ) {
        await this.orderService.cancelPendingPaymentOrders(
            this.getSessionOrderIds(session),
            "Checkout session expired without payment.",
        );

        const transaction = await this.paymentService.findBySessionId(session.id);
        if (transaction?.status === PaymentStatus.PENDING) {
            await this.paymentService.updateProviderStatus(transaction.id, {
                status: PaymentStatus.CANCELLED,
                paymentStatus: "expired",
            });
        }
    }

    /**
     * Webhooks can be lost. Anything still open after its session must have ended is settled from
     * Stripe's own record, so a paid buyer always gets an order and abandoned items go back on sale.
     */
    @Cron(CronExpression.EVERY_10_MINUTES)
    async reconcileOpenCheckoutSessions() {
        const cutoff = new Date(Date.now() - (CHECKOUT_SESSION_MINUTES + 5) * 60 * 1000);
        const transactions = await this.prismaService.paymentTransaction.findMany({
            where: {
                provider: PaymentProvider.STRIPE,
                status: PaymentStatus.PENDING,
                createdAt: { lt: cutoff },
                stripe_session_id: { not: null },
            },
            orderBy: { createdAt: "asc" },
            take: 50,
        });

        for (const transaction of transactions) {
            try {
                const session = await this.stripe.checkout.sessions.retrieve(transaction.stripe_session_id!);
                if (session.payment_status === "paid") {
                    await this.handleCheckoutSessionCompleted(session);
                } else if (session.status !== "open") {
                    await this.handleCheckoutSessionExpired(session);
                }
            } catch (err: any) {
                this.logger.error(
                    `Failed to reconcile checkout session ${transaction.stripe_session_id}`,
                    err?.stack ?? err,
                );
            }
        }
    }

    private async transferCartPaymentToSellers(
        session: Stripe.Checkout.Session,
        orderIds: number[],
    ) {
        const paymentIntentId = session.payment_intent?.toString();
        if (!paymentIntentId) {
            this.logger.warn(
                `Skipping seller transfers for ${session.id}: missing payment intent.`,
            );
            return [];
        }

        const orders = await this.prismaService.order.findMany({
            where: { id: { in: orderIds } },
            include: {
                seller: {
                    select: {
                        id: true,
                        stripe_account_id: true,
                        stripe_onboarding_complete: true,
                        seller_tier: true,
                    },
                },
            },
        });

        const chargeId = await this.getPaymentIntentChargeId(paymentIntentId);
        const transferGroup =
            session.metadata?.transferGroup ??
            this.buildTransferGroup(
                "cart",
                Number(session.client_reference_id) || 0,
            );
        const transaction = await this.paymentService.findBySessionId(session.id);
        const transactionMetadata = this.toMetadataObject(transaction?.metadata);
        const cartSplitPlan = Array.isArray(transactionMetadata.cartSplitPlan)
            ? transactionMetadata.cartSplitPlan
            : [];
        // Stripe forgets idempotency keys after a day but retries webhooks for longer
        const transfers: any[] = Array.isArray(transactionMetadata.cartTransfers)
            ? [...transactionMetadata.cartTransfers]
            : [];

        for (const order of orders) {
            if (this.getCartTransferForOrder(transactionMetadata, order.id)) {
                continue;
            }

            if (
                !order.seller.stripe_onboarding_complete ||
                !order.seller.stripe_account_id
            ) {
                throw new BadRequestException(
                    `Seller ${order.sellerId} has not completed Stripe onboarding.`,
                );
            }

            const plannedSplit = cartSplitPlan.find(
                (plan) => Number(plan.orderId) === order.id,
            );
            const orderAmountCents =
                Number(plannedSplit?.orderAmountCents) ||
                Math.round(order.total * 100);
            const split = plannedSplit
                ? {
                      platformFeePercent: Number(plannedSplit.platformFeePercent) || 0,
                      platformFeeAmount: Number(plannedSplit.platformFeeAmount) || 0,
                      sellerTransferAmount: Number(plannedSplit.sellerTransferAmount) || 0,
                  }
                : this.calculatePaymentSplit(
                      orderAmountCents,
                      order.seller.seller_tier,
                  );
            if (split.sellerTransferAmount <= 0) {
                continue;
            }

            const transfer = await this.stripe.transfers.create(
                {
                    amount: split.sellerTransferAmount,
                    currency: session.currency ?? "usd",
                    destination: order.seller.stripe_account_id,
                    transfer_group: transferGroup,
                    ...(chargeId ? { source_transaction: chargeId } : {}),
                    metadata: {
                        checkoutSessionId: session.id,
                        paymentIntentId,
                        orderId: String(order.id),
                        sellerId: String(order.sellerId),
                        sellerTier: order.seller.seller_tier,
                        orderAmount: String(orderAmountCents / 100),
                        orderAmountUsd: String(plannedSplit?.orderTotalUsd ?? order.total),
                        platformFeePercent: String(split.platformFeePercent),
                        platformFeeAmount: String(
                            split.platformFeeAmount / 100,
                        ),
                    },
                },
                { idempotencyKey: `cart-transfer-${session.id}-${order.id}` },
            );

            transfers.push({
                orderId: order.id,
                sellerId: order.sellerId,
                transferId: transfer.id,
                amount: split.sellerTransferAmount / 100,
                amountCents: split.sellerTransferAmount,
                currency: session.currency ?? "usd",
                orderAmount: orderAmountCents / 100,
                orderAmountCents,
                orderAmountUsd: plannedSplit?.orderTotalUsd ?? order.total,
                platformFeePercent: split.platformFeePercent,
                platformFeeAmount: split.platformFeeAmount / 100,
                platformFeeAmountCents: split.platformFeeAmount,
            });
        }

        if (transfers.length) {
            await this.mergePaymentTransactionMetadata(session.id, {
                transferGroup,
                cartTransfers: transfers,
            });
        }

        return transfers;
    }

    private async getPaymentIntentChargeId(paymentIntentId: string) {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(
            paymentIntentId,
            {
                expand: ["latest_charge"],
            },
        );
        const latestCharge = paymentIntent.latest_charge;
        if (!latestCharge) {
            return undefined;
        }
        return typeof latestCharge === "string"
            ? latestCharge
            : latestCharge.id;
    }

    private numberFromMetadata(value?: string | null) {
        if (!value) {
            return undefined;
        }
        const numberValue = Number(value);
        return Number.isInteger(numberValue) && numberValue > 0
            ? numberValue
            : undefined;
    }

    private numberArrayFromMetadata(value?: string | null) {
        const ids = value
            ?.split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isInteger(item) && item > 0);
        return ids?.length ? ids : undefined;
    }

    private stringFromMetadata(value?: string | null) {
        return value?.trim() || undefined;
    }

    private async getUserCurrency(userId: number): Promise<CurrencyPreference> {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { currency_preference: true },
        });

        return user?.currency_preference ?? CurrencyPreference.USD;
    }

    private normalizeStripeCurrency(currency: CurrencyPreference | string) {
        return String(currency || CurrencyPreference.USD).toLowerCase();
    }

    private currencyPreferenceFromStripeCurrency(currency?: string | null): CurrencyPreference {
        const normalized = String(currency || CurrencyPreference.USD).toUpperCase();
        return Object.values(CurrencyPreference).includes(normalized as CurrencyPreference)
            ? (normalized as CurrencyPreference)
            : CurrencyPreference.USD;
    }

    private async convertUsdAmount(amount: number, currency: CurrencyPreference) {
        if (currency === CurrencyPreference.USD) {
            return Number(amount.toFixed(2));
        }

        return this.currencyService.convertAsync(amount, CurrencyPreference.USD, currency);
    }

    async refundReturnRequestPayment(
        returnRequestId: number,
        requestedAmount?: number,
    ) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnRequestId },
            include: {
                orderItem: {
                    include: {
                        order: {
                            include: {
                                seller: {
                                    select: {
                                        id: true,
                                        seller_tier: true,
                                        stripe_account_id: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException(
                `Return request with ID ${returnRequestId} not found`,
            );
        }

        if (request.refunded_at) {
            return {
                already_refunded: true,
                refund_amount:
                    request.refund_amount ??
                    requestedAmount ??
                    request.orderItem.price,
            };
        }

        const order = request.orderItem.order;
        const transaction = await this.paymentService.findPaidTransactionForOrder(order.id, order.userId);
        if (!transaction?.stripe_payment_intent_id) {
            throw new BadRequestException(
                `No paid Stripe transaction found for order ${order.id}.`,
            );
        }

        const metadata = this.toMetadataObject(transaction.metadata);
        const existingRefund = this.findReturnRefundMetadata(
            metadata,
            returnRequestId,
        );
        if (existingRefund) {
            return {
                already_refunded: true,
                stripe_refund_id: existingRefund.refundId,
                refund_amount:
                    existingRefund.amount ??
                    requestedAmount ??
                    request.orderItem.price,
            };
        }

        const refundAmountUsd = requestedAmount ?? Math.min(request.orderItem.price, order.total);
        if (refundAmountUsd > order.total) {
            throw new BadRequestException(
                "Refund amount exceeds the total paid for this order.",
            );
        }

        const refundCurrency = this.currencyPreferenceFromStripeCurrency(
            transaction.currency,
        );
        const refundAmount = await this.convertUsdAmount(
            refundAmountUsd,
            refundCurrency,
        );
        const refundAmountCents = Math.round(refundAmount * 100);
        if (refundAmountCents <= 0) {
            throw new BadRequestException(
                "Refund amount must be greater than zero.",
            );
        }

        const previousRefundedCents = this.getReturnRefunds(metadata).reduce(
            (sum, refund) => sum + (Number(refund.amountCents) || 0),
            0,
        );
        const transactionAmountCents = Math.round(transaction.amount * 100);
        if (
            previousRefundedCents + refundAmountCents >
            transactionAmountCents
        ) {
            throw new BadRequestException(
                "Refund amount exceeds the captured payment amount.",
            );
        }

        const checkoutMode = this.getMetadataString(metadata.checkoutMode);
        const isBuyNow =
            checkoutMode === "buy_now" ||
            Boolean(order.stripe_checkout_session_id);
        const refund = await this.stripe.refunds.create(
            {
                payment_intent: transaction.stripe_payment_intent_id,
                amount: refundAmountCents,
                ...(isBuyNow
                    ? { reverse_transfer: true, refund_application_fee: true }
                    : {}),
                metadata: {
                    returnRequestId: String(returnRequestId),
                    orderId: String(order.id),
                    orderItemId: String(request.orderItemId),
                },
            },
            { idempotencyKey: `return-refund-${returnRequestId}` },
        );

        let transferReversalId: string | undefined;
        if (!isBuyNow) {
            transferReversalId = await this.reverseCartSellerTransfer(
                metadata,
                {
                    idempotencyKey: `return-transfer-reversal-${returnRequestId}`,
                    orderId: order.id,
                    refundAmountCents,
                    sellerTier: order.seller.seller_tier,
                    metadata: {
                        returnRequestId: String(returnRequestId),
                        orderId: String(order.id),
                        orderItemId: String(request.orderItemId),
                    },
                },
            );
        }

        await this.recordRefund(transaction, metadata, {
            returnRequestId,
            orderId: order.id,
            orderItemId: request.orderItemId,
            refundId: refund.id,
            transferReversalId,
            amount: refundAmount,
            amountCents: refundAmountCents,
            amountUsd: refundAmountUsd,
            currency: transaction.currency,
            createdAt: new Date().toISOString(),
        });

        return {
            already_refunded: false,
            stripe_refund_id: refund.id,
            transfer_reversal_id: transferReversalId,
            refund_amount: refundAmount,
            refund_amount_usd: refundAmountUsd,
            currency: transaction.currency,
        };
    }

    /**
     * Returns everything the buyer has not already had back for an order: used when a paid order
     * is cancelled, or when a payment arrives for an order that can no longer be fulfilled.
     * Safe to repeat, because a redelivered webhook lands here too.
     */
    async refundOrderPayment(orderId: number) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: { seller: { select: { seller_tier: true } } },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        const transaction = await this.paymentService.findPaidTransactionForOrder(order.id, order.userId);
        if (!transaction?.stripe_payment_intent_id) {
            this.logger.warn(`No paid Stripe transaction found for order ${order.id}; nothing to refund.`);
            return { refunded: false };
        }

        const metadata = this.toMetadataObject(transaction.metadata);
        const orderRefunds = this.getReturnRefunds(metadata).filter(
            (refund) => Number(refund.orderId) === order.id,
        );
        if (orderRefunds.some((refund) => refund.kind === ORDER_CANCELLATION_REFUND)) {
            return { refunded: false, already_refunded: true };
        }

        const isBuyNow =
            this.getMetadataString(metadata.checkoutMode) === "buy_now" ||
            Boolean(order.stripe_checkout_session_id);
        const plannedSplit = this.getCartSplitPlan(metadata).find(
            (plan) => Number(plan.orderId) === order.id,
        );
        const orderAmountCents = isBuyNow
            ? Math.round(transaction.amount * 100)
            : Number(plannedSplit?.orderAmountCents) || Math.round(order.total * 100);
        const alreadyRefundedCents = orderRefunds.reduce(
            (sum, refund) => sum + (Number(refund.amountCents) || 0),
            0,
        );
        const refundAmountCents = orderAmountCents - alreadyRefundedCents;

        if (refundAmountCents <= 0) {
            return { refunded: false, already_refunded: true };
        }

        const refund = await this.stripe.refunds.create(
            {
                payment_intent: transaction.stripe_payment_intent_id,
                amount: refundAmountCents,
                ...(isBuyNow
                    ? { reverse_transfer: true, refund_application_fee: true }
                    : {}),
                metadata: { orderId: String(order.id) },
            },
            { idempotencyKey: `order-refund-${order.id}` },
        );

        const transferReversalId = isBuyNow
            ? undefined
            : await this.reverseCartSellerTransfer(metadata, {
                  idempotencyKey: `order-transfer-reversal-${order.id}`,
                  orderId: order.id,
                  refundAmountCents,
                  sellerTier: order.seller.seller_tier,
                  metadata: { orderId: String(order.id) },
              });

        const refundAmount = refundAmountCents / 100;
        await this.recordRefund(transaction, metadata, {
            kind: ORDER_CANCELLATION_REFUND,
            orderId: order.id,
            refundId: refund.id,
            transferReversalId,
            amount: refundAmount,
            amountCents: refundAmountCents,
            amountUsd: this.getOrderRefundUsd(order.total, orderAmountCents, refundAmountCents),
            currency: transaction.currency,
            createdAt: new Date().toISOString(),
        });

        return {
            refunded: true,
            stripe_refund_id: refund.id,
            refund_amount: refundAmount,
            currency: transaction.currency,
        };
    }

    /**
     * Pays the seller of a financed order. TBI settles with the platform outside Stripe and sends
     * no settlement signal, so an admin triggers this once the bank's money has arrived. It is
     * sent from the platform's Stripe balance, which must hold enough in the payment currency.
     */
    async payOutFinancedOrder(orderId: number) {
        const order = await this.prismaService.order.findUnique({
            where: { id: orderId },
            include: {
                seller: { select: { stripe_account_id: true } },
                items: { select: { returnRequests: { select: { status: true } } } },
            },
        });

        if (!order) {
            throw new NotFoundException(`Order with ID ${orderId} not found`);
        }
        if (order.seller_payout_at) {
            throw new BadRequestException("This seller has already been paid for this order.");
        }
        if (order.status !== OrderStatus.DELIVERED) {
            throw new BadRequestException("A seller is paid out once the order has been delivered.");
        }
        if (!order.seller.stripe_account_id) {
            throw new BadRequestException("This seller has no connected Stripe account.");
        }

        const returnInProgress = order.items
            .flatMap((item) => item.returnRequests)
            .some((request) => request.status !== ReturnStatus.COMPLETED && request.status !== ReturnStatus.REJECTED);
        if (returnInProgress) {
            throw new BadRequestException("Resolve the open return on this order before paying the seller.");
        }

        const transaction = await this.paymentService.findPaidTransactionForOrder(order.id, order.userId);
        if (transaction?.provider !== PaymentProvider.TBI_CREDIT) {
            throw new BadRequestException("Only TBI Credit orders are paid out manually.");
        }

        const payout = this.paymentService.getManualPayout(transaction, order);
        const amountCents = Math.round(payout.amount * 100);
        if (amountCents <= 0) {
            throw new BadRequestException("There is nothing to pay out for this order.");
        }

        const transfer = await this.stripe.transfers.create(
            {
                amount: amountCents,
                currency: payout.currency,
                destination: order.seller.stripe_account_id,
                metadata: {
                    orderId: String(order.id),
                    sellerId: String(order.sellerId),
                    paymentTransactionId: String(transaction.id),
                },
            },
            { idempotencyKey: `tbi-payout-${order.id}` },
        );

        await this.prismaService.order.update({
            where: { id: order.id },
            data: { seller_payout_at: new Date(), seller_payout_reference: transfer.id },
        });

        try {
            await this.notificationService.create(
                order.sellerId,
                "Payout Sent",
                `Your payout for order #${order.id} is on its way to your Stripe account.`,
                NotificationType.ORDER,
            );
        } catch (err: any) {
            this.logger.error("Failed to send payout notification", err?.stack ?? err);
        }

        return { order_id: order.id, transfer_id: transfer.id, amount: payout.amount, currency: payout.currency };
    }

    private getOrderRefundUsd(orderTotalUsd: number, orderAmountCents: number, refundAmountCents: number) {
        return Number(((orderTotalUsd * refundAmountCents) / orderAmountCents).toFixed(2));
    }

    private async recordRefund(
        transaction: { id: number; amount: number },
        metadata: Record<string, any>,
        refundRecord: Record<string, any>,
    ) {
        const refunds = [...this.getReturnRefunds(metadata), refundRecord];
        const refundedCents = refunds.reduce(
            (sum, refund) => sum + (Number(refund.amountCents) || 0),
            0,
        );
        const isFullyRefunded = refundedCents >= Math.round(transaction.amount * 100);

        await this.prismaService.paymentTransaction.update({
            where: { id: transaction.id },
            data: {
                status: isFullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.SUCCEEDED,
                payment_status: isFullyRefunded ? "refunded" : "partially_refunded",
                metadata: { ...metadata, returnRefunds: refunds },
            },
        });
    }

    private getCartSplitPlan(metadata: Record<string, any>): any[] {
        return Array.isArray(metadata.cartSplitPlan) ? metadata.cartSplitPlan : [];
    }

    /**
     * The buyer's refund has already gone through by the time this runs, so a failed reversal (for
     * example an empty seller balance) must not surface as a failed refund. It is reported for
     * manual recovery from the seller instead.
     */
    private async reverseCartSellerTransfer(
        metadata: Record<string, any>,
        params: {
            idempotencyKey: string;
            orderId: number;
            refundAmountCents: number;
            sellerTier: SellerTier;
            metadata: Record<string, string>;
        },
    ) {
        const transfer = this.getCartTransferForOrder(metadata, params.orderId);
        if (!transfer?.transferId) {
            this.logger.warn(
                `No seller transfer found to reverse for refunded order ${params.orderId}.`,
            );
            return undefined;
        }

        const split = this.calculatePaymentSplit(
            params.refundAmountCents,
            params.sellerTier,
        );
        if (split.sellerTransferAmount <= 0) {
            return undefined;
        }

        try {
            const reversal = await this.stripe.transfers.createReversal(
                transfer.transferId,
                {
                    amount: split.sellerTransferAmount,
                    metadata: params.metadata,
                },
                { idempotencyKey: params.idempotencyKey },
            );

            return reversal.id;
        } catch (err: any) {
            this.logger.error(
                `Buyer was refunded but transfer ${transfer.transferId} for order ${params.orderId} could not be reversed: ${err?.message}`,
            );
            return undefined;
        }
    }

    private async mergePaymentTransactionMetadata(
        sessionId: string,
        patch: Record<string, any>,
    ) {
        const transaction =
            await this.prismaService.paymentTransaction.findUnique({
                where: { stripe_session_id: sessionId },
            });
        if (!transaction) {
            this.logger.warn(
                `No payment transaction found for stripe session ${sessionId} to record metadata.`,
            );
            return null;
        }

        const metadata = this.toMetadataObject(transaction.metadata);
        return this.prismaService.paymentTransaction.update({
            where: { id: transaction.id },
            data: {
                metadata: {
                    ...metadata,
                    ...patch,
                },
            },
        });
    }

    private getCartTransferForOrder(
        metadata: Record<string, any>,
        orderId: number,
    ) {
        const transfers = Array.isArray(metadata.cartTransfers)
            ? metadata.cartTransfers
            : [];
        return transfers.find(
            (transfer) => Number(transfer.orderId) === orderId,
        );
    }

    private getReturnRefunds(metadata: Record<string, any>) {
        return Array.isArray(metadata.returnRefunds)
            ? metadata.returnRefunds
            : [];
    }

    private findReturnRefundMetadata(
        metadata: Record<string, any>,
        returnRequestId: number,
    ) {
        return this.getReturnRefunds(metadata).find(
            (refund) => Number(refund.returnRequestId) === returnRequestId,
        );
    }

    private toMetadataObject(metadata: unknown): Record<string, any> {
        if (
            metadata &&
            typeof metadata === "object" &&
            !Array.isArray(metadata)
        ) {
            return metadata as Record<string, any>;
        }
        return {};
    }

    private getMetadataString(value: unknown) {
        return typeof value === "string" ? value : undefined;
    }

    /**
     * Admin: list all sellers with their Stripe status.
     */
    async listAllSellerAccounts(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prismaService.baseUser.findMany({
                where: { stripe_account_id: { not: null } },
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    seller_tier: true,
                    stripe_account_id: true,
                    stripe_onboarding_complete: true,
                    profile: { select: { full_name: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
            this.prismaService.baseUser.count({
                where: { stripe_account_id: { not: null } },
            }),
        ]);
        return {
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }
}
