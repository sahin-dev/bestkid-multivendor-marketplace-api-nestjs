import { BadGatewayException, BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import stripeConfig, { StripeConfig } from "src/config/stripe.config";
import Stripe from "stripe";
import { OrderService } from "../order/order.service";
import { PaymentService } from "../payment/payment.service";
import { CreateBuyNowCheckoutSessionDto, CreateStripeCheckoutSessionDto } from "../order/dtos/checkout-flow.dto";

@Injectable()
export class StripeService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly orderService: OrderService,
        private readonly paymentService: PaymentService,
        @Inject(stripeConfig.KEY) private readonly stripeConfiguration: ConfigType<typeof StripeConfig>,
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
    async onboardSeller(userId: number, returnUrl?: string, refreshUrl?: string) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

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
            returnUrl ?? `${appBaseUrl}/stripe/callback`,
        );

        return { url: accountLink.url, stripe_account_id: accountId };
    }

    private async createStripeAccount(email: string) {
        try {
            return await this.stripe.accounts.create({
                type: "express",
                email,
                capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
            });
        } catch (err) {
            this.throwStripeOnboardingError(err, "create connected account");
        }
    }

    private async createStripeAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
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

    private throwStripeOnboardingError(err: unknown, action: string): never {
        const stripeError = err as Partial<Stripe.errors.StripeError> | undefined;
        const message = stripeError?.message ?? "Stripe rejected the onboarding request.";

        this.logger.error(`Failed to ${action}: ${message}`, err instanceof Error ? err.stack : undefined);

        if (stripeError?.type?.startsWith("Stripe")) {
            throw new BadRequestException(`Stripe onboarding failed: ${message}`);
        }

        throw new BadGatewayException(`Stripe onboarding failed while trying to ${action}.`);
    }

    async createCheckoutSession(userId: number, dto: CreateStripeCheckoutSessionDto) {
        if (!dto.acceptedTerms) {
            throw new BadRequestException("You must agree to the Terms & Conditions and Privacy Policy before payment.");
        }

        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const checkoutSummary = await this.orderService.getCheckoutSummary(userId, {
            sellerIds: dto.sellerIds,
            cartItemIds: dto.cartItemIds,
            addressId: dto.addressId,
            couponCode: dto.couponCode,
        });
        const amountTotal = checkoutSummary.price_details.total;
        const amountInCents = Math.round(amountTotal * 100);

        if (amountInCents <= 0) {
            throw new BadRequestException("Checkout total must be greater than zero.");
        }

        // Step 1: Create pending orders (before Stripe session)
        const orderResult = await this.orderService.createPendingCartOrders(userId, {
            sellerIds: dto.sellerIds,
            cartItemIds: dto.cartItemIds,
            addressId: dto.addressId,
            couponCode: dto.couponCode,
            acceptedTerms: true,
        });

        const orderIds = orderResult.orders.map((o) => o.id).join(",");

        // Step 2: Create Stripe checkout session with orderId in metadata
        const session = await this.stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            success_url: dto.successUrl,
            cancel_url: dto.cancelUrl,
            customer_email: user.email,
            client_reference_id: String(userId),
            line_items: [
                {
                    price_data: {
                        currency: "eur",
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
                couponId: orderResult.coupon_id ? String(orderResult.coupon_id) : "",
                total: String(amountTotal),
            },
        });

        // Step 3: Create pending payment transaction
        await this.paymentService.createPendingTransaction({
            userId,
            amount: amountTotal,
            currency: "eur",
            stripeSessionId: session.id,
            metadata: {
                checkoutMode: "cart",
                orderIds: orderIds,
                cartId: String(orderResult.cart_id),
            },
        });

        return {
            session_id: session.id,
            url: session.url,
            currency: "eur",
            amount_total: amountTotal,
            checkout_summary: checkoutSummary,
            pending_orders: orderResult.orders,
        };
    }

    async createBuyNowCheckoutSession(userId: number, dto: CreateBuyNowCheckoutSessionDto) {
        if (!dto.acceptedTerms) {
            throw new BadRequestException("You must agree to the Terms & Conditions and Privacy Policy before payment.");
        }
        if (!dto.addressId && (!dto.shippingAddress || !dto.city || !dto.country)) {
            throw new BadRequestException("Select a shipping address before payment.");
        }

        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const checkoutSummary = await this.orderService.getBuyNowCheckoutSummary(userId, dto);
        const amountTotal = checkoutSummary.price_details.total;
        if (amountTotal === null) {
            throw new BadRequestException("Select a shipping address before payment.");
        }
        const amountInCents = Math.round(amountTotal * 100);
        const item = checkoutSummary.seller_groups[0].items[0];

        if (amountInCents <= 0) {
            throw new BadRequestException("Checkout total must be greater than zero.");
        }

        // Step 1: Create pending buy-now order (before Stripe session)
        const orderResult = await this.orderService.createPendingBuyNowOrder(userId, {
            productId: dto.productId,
            addressId: dto.addressId,
            shippingAddress: dto.shippingAddress,
            city: dto.city,
            postalCode: dto.postalCode,
            country: dto.country,
            acceptedTerms: true,
        });

        const orderId = orderResult.order.id;

        // Step 2: Create Stripe checkout session with orderId in metadata
        const session = await this.stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            success_url: dto.successUrl,
            cancel_url: dto.cancelUrl,
            customer_email: user.email,
            client_reference_id: String(userId),
            line_items: [
                {
                    price_data: {
                        currency: "eur",
                        product_data: {
                            name: item.product.name,
                            description: "Buy Now checkout",
                            images: item.product.image_url ? [item.product.image_url] : undefined,
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
                total: String(amountTotal),
            },
        });

        // Step 3: Create pending payment transaction
        await this.paymentService.createPendingTransaction({
            userId,
            orderId,
            amount: amountTotal,
            currency: "eur",
            stripeSessionId: session.id,
            metadata: {
                checkoutMode: "buy_now",
                orderId: String(orderId),
                productId: String(dto.productId),
            },
        });

        return {
            session_id: session.id,
            url: session.url,
            currency: "eur",
            amount_total: amountTotal,
            checkout_summary: checkoutSummary,
            pending_order: orderResult.order,
        };
    }

    /**
     * Called when Stripe redirects back after onboarding. Checks account status.
     */
    async handleCallback(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }
        if (!user.stripe_account_id) {
            throw new BadRequestException("No Stripe account linked.");
        }

        const account = await this.stripe.accounts.retrieve(user.stripe_account_id);
        const isComplete = account.details_submitted;

        await this.prismaService.baseUser.update({
            where: { id: userId },
            data: { stripe_onboarding_complete: isComplete },
        });

        return {
            stripe_onboarding_complete: isComplete,
            stripe_account_id: user.stripe_account_id,
            message: isComplete ? "Stripe onboarding complete!" : "Stripe onboarding not yet complete.",
        };
    }

    /**
     * Get the onboarding status for the current seller.
     */
    async getStatus(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { stripe_account_id: true, stripe_onboarding_complete: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }
        return {
            stripe_account_id: user.stripe_account_id ?? null,
            stripe_onboarding_complete: user.stripe_onboarding_complete ?? false,
        };
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
        } catch (err:any) {
            throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
        }

        if (event.type === "account.updated") {
            const account = event.data.object as Stripe.Account;
            if (account.details_submitted) {
                await this.prismaService.baseUser.updateMany({
                    where: { stripe_account_id: account.id },
                    data: { stripe_onboarding_complete: true },
                });
                this.logger.log(`Stripe account ${account.id} onboarding completed via webhook.`);
            }
        }

        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            await this.paymentService.markSucceeded(session.id, session.payment_intent?.toString(), session.customer?.toString());
            await this.handleCheckoutSessionCompleted(session);
        }

        return { received: true };
    }

    private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
        if (session.payment_status !== "paid") {
            this.logger.warn(`Skipping checkout.session.completed ${session.id}: payment_status is ${session.payment_status ?? "unknown"}.`);
            return;
        }

        if (session.metadata?.checkoutMode === "buy_now") {
            await this.handleBuyNowCheckoutSessionCompleted(session);
            return;
        }

        const orderIds = session.metadata?.orderIds
            ? session.metadata.orderIds
                  .split(",")
                  .map((id) => Number(id.trim()))
                  .filter((id) => Number.isInteger(id) && id > 0)
            : [];
        const cartId = Number(session.metadata?.cartId);

        if (orderIds.length === 0) {
            this.logger.warn(`Skipping checkout.session.completed ${session.id}: missing orderIds metadata.`);
            return;
        }

        try {
            // Step 1: Confirm each order (PENDING -> CONFIRMED)
            // For cart orders, don't set stripe_checkout_session_id (unique constraint allows only one order per session)
            for (const orderId of orderIds) {
                await this.orderService.confirmOrder(orderId, undefined, false);
            }

            // Step 2: Link payment transaction to orders
            await this.paymentService.linkOrderToSession(session.id, orderIds[0]);

            // Step 3: Delete cart items for this cart
            if (cartId) {
                await this.prismaService.cartItem.deleteMany({
                    where: { cartId },
                });
            }

            // Step 4: Mark products as sold
            for (const orderId of orderIds) {
                await this.orderService.markProductsSoldForOrder(orderId);
            }

            this.logger.log(`Confirmed ${orderIds.length} orders for paid checkout session ${session.id}.`);
        } catch (err: any) {
            this.logger.error(`Failed to process checkout session ${session.id}`, err?.stack ?? err);
            throw err;
        }
    }

    private async handleBuyNowCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
        if (session.payment_status !== "paid") {
            this.logger.warn(`Skipping buy_now checkout.session.completed ${session.id}: payment_status is ${session.payment_status ?? "unknown"}.`);
            return;
        }

        const orderId = Number(session.metadata?.orderId);

        if (!orderId) {
            this.logger.warn(`Skipping buy_now checkout.session.completed ${session.id}: missing orderId metadata.`);
            return;
        }

        try {
            // Step 1: Confirm order (PENDING -> CONFIRMED) with session ID (buy-now has 1:1 mapping)
            await this.orderService.confirmOrder(orderId, session.id, true);

            // Step 2: Link payment transaction to order
            await this.paymentService.linkOrderToSession(session.id, orderId);

            // Step 3: Mark product as sold
            await this.orderService.markProductsSoldForOrder(orderId);

            this.logger.log(`Confirmed Buy Now order ${orderId} for paid checkout session ${session.id}.`);
        } catch (err: any) {
            this.logger.error(`Failed to process buy-now checkout session ${session.id}`, err?.stack ?? err);
            throw err;
        }
    }

    private numberFromMetadata(value?: string | null) {
        if (!value) {
            return undefined;
        }
        const numberValue = Number(value);
        return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
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
            this.prismaService.baseUser.count({ where: { stripe_account_id: { not: null } } }),
        ]);
        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }
}
