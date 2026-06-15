import { registerAs } from "@nestjs/config"

export const StripeConfig = () => ({
    stripe_key:process.env.STRIPE_KEY,
    webhook_key:process.env.STRIPE_WEBHOOK
})

export default registerAs("stripe", StripeConfig)