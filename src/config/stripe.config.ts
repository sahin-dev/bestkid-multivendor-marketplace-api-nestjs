import { registerAs } from "@nestjs/config";

export const StripeConfig = () => ({
    stripe_key: process.env.STRIPE_KEY,
    webhook_key: process.env.STRIPE_WEBHOOK,
    platform_fee_percent: process.env.STRIPE_PLATFORM_FEE_PERCENT,
    basic_seller_fee_percent: process.env.STRIPE_BASIC_SELLER_FEE_PERCENT,
    standard_seller_fee_percent: process.env.STRIPE_STANDARD_SELLER_FEE_PERCENT,
    premium_seller_fee_percent: process.env.STRIPE_PREMIUM_SELLER_FEE_PERCENT,
});

export default registerAs("stripe", StripeConfig);
