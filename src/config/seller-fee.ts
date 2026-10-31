import { BadRequestException } from "@nestjs/common";
import { SellerTier } from "generated/prisma/client";

const FEE_PERCENT_SETTING: Record<SellerTier, string> = {
    [SellerTier.BASIC_SELLER]: "STRIPE_BASIC_SELLER_FEE_PERCENT",
    [SellerTier.STANDARD_SELLER]: "STRIPE_STANDARD_SELLER_FEE_PERCENT",
    [SellerTier.PREMIUM_SELLER]: "STRIPE_PREMIUM_SELLER_FEE_PERCENT",
};

/** The platform's commission for a seller tier, as a percentage. */
export function getSellerFeePercent(sellerTier: SellerTier) {
    const setting = FEE_PERCENT_SETTING[sellerTier];
    const percent = Number(process.env[setting] ?? 10);

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new BadRequestException(`${setting} must be a number between 0 and 100.`);
    }

    return percent;
}
