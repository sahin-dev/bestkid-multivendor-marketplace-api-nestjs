import { BadGatewayException, BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import stripeConfig, { StripeConfig } from "src/config/stripe.config";
import Stripe from "stripe";
import { OrderService } from "../order/order.service";
import { CreateStripeCheckoutSessionDto } from "../order/dtos/checkout-flow.dto";

@Injectable()
export class StripeService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly orderService: OrderService,
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
            addressId: dto.addressId,
            couponCode: dto.couponCode,
        });
        const amountTotal = checkoutSummary.price_details.total;
        const amountInCents = Math.round(amountTotal * 100);

        if (amountInCents <= 0) {
            throw new BadRequestException("Checkout total must be greater than zero.");
        }

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
                userId: String(userId),
                addressId: String(dto.addressId),
                sellerIds: dto.sellerIds?.join(",") ?? "",
                couponCode: dto.couponCode ?? "",
                total: String(amountTotal),
            },
        });

        return {
            session_id: session.id,
            url: session.url,
            currency: "eur",
            amount_total: amountTotal,
            checkout_summary: checkoutSummary,
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
        } catch (err) {
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
            await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        }

        return { received: true };
    }

    private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
        const userId = Number(session.metadata?.userId);
        const addressId = Number(session.metadata?.addressId);
        const sellerIds = session.metadata?.sellerIds
            ? session.metadata.sellerIds
                  .split(",")
                  .map((sellerId) => Number(sellerId.trim()))
                  .filter((sellerId) => Number.isInteger(sellerId) && sellerId > 0)
            : undefined;
        const couponCode = session.metadata?.couponCode || undefined;

        if (!userId || !addressId) {
            this.logger.warn(`Skipping checkout.session.completed ${session.id}: missing userId or addressId metadata.`);
            return;
        }

        try {
            await this.orderService.checkoutFromCart(userId, {
                sellerIds,
                addressId,
                couponCode,
                acceptedTerms: true,
            });
            this.logger.log(`Created orders for paid checkout session ${session.id}.`);
        } catch (err) {
            if (err?.message === "Cart is empty") {
                this.logger.warn(`Checkout session ${session.id} was already processed or cart is empty.`);
                return;
            }
            this.logger.error(`Failed to create orders for checkout session ${session.id}`, err?.stack ?? err);
            throw err;
        }
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
