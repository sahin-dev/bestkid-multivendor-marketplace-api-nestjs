import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import stripeConfig, { StripeConfig } from "src/config/stripe.config";
import Stripe from "stripe";

@Injectable()
export class StripeService {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor(
        private readonly prismaService: PrismaService,
        @Inject(stripeConfig.KEY) private readonly stripeConfiguration: ConfigType<typeof StripeConfig>,
    ) {
        this.stripe = new Stripe(this.stripeConfiguration.stripe_key!, {
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

        if (!user) throw new BadRequestException("User not found");

        let accountId = user.stripe_account_id;

        // Create Stripe account only if it doesn't exist yet
        if (!accountId) {
            const account = await this.stripe.accounts.create({
                type: "express",
                email: user.email,
                capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
            });
            accountId = account.id;
            await this.prismaService.baseUser.update({
                where: { id: userId },
                data: { stripe_account_id: accountId },
            });
        }

        const appBaseUrl = process.env.APP_URL ?? "http://localhost:3000";
        const accountLink = await this.stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl ?? `${appBaseUrl}/stripe/onboard`,
            return_url: returnUrl ?? `${appBaseUrl}/stripe/callback`,
            type: "account_onboarding",
        });

        return { url: accountLink.url, stripe_account_id: accountId };
    }

    /**
     * Called when Stripe redirects back after onboarding. Checks account status.
     */
    async handleCallback(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id: userId } });
        if (!user || !user.stripe_account_id) {
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
        return {
            stripe_account_id: user?.stripe_account_id ?? null,
            stripe_onboarding_complete: user?.stripe_onboarding_complete ?? false,
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

        return { received: true };
    }

    /**
     * Admin: list all sellers with their Stripe status.
     */
    async listAllSellerAccounts(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prismaService.baseUser.findMany({
                where: { role: "SELLER" },
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    stripe_account_id: true,
                    stripe_onboarding_complete: true,
                    profile: { select: { full_name: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
            this.prismaService.baseUser.count({ where: { role: "SELLER" } }),
        ]);
        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }
}
