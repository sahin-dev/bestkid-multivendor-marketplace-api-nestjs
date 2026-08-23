import { registerAs } from "@nestjs/config"

export const StripeConfig = () => ({
    stripe_key:process.env.STRIPE_KEY,
    webhook_key:process.env.STRIPE_WEBHOOK,
    platform_fee_percent: process.env.STRIPE_PLATFORM_FEE_PERCENT,
})

export default registerAs("stripe", StripeConfig)
