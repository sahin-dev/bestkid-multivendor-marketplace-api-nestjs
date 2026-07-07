import { Expose, Transform } from "class-transformer";
import { ValidateNested } from "class-validator";
import { CurrencyPreference, LanguagePreference, SellerTier, UserRole } from "generated/prisma/enums";
import { SanitizeUrl } from "src/common/decorators";

export class UserProfileResponseDto {
    @Expose()
    full_name: string;

    @Expose()
    phone: string;

    @Expose()
    avatar_url: string;
}

export class UserResponseDto {
    @Expose()
    id: number;

    @Expose()
    email: string;


    @Expose()
    email_verifird: boolean;

    @Expose()
    is_blocked: boolean;

    @Expose()
    role: UserRole;

    @Expose()
    language_preference: LanguagePreference;

    @Expose()
    currency_preference: CurrencyPreference;

    @Expose()
    stripe_account_id: string;

    @Expose()
    stripe_onboarding_complete: boolean;

    @Expose()
    seller_tier: SellerTier;

    @Expose()
    @Transform(({ obj }) => obj.selling_tier ?? formatSellerTier(obj.seller_tier))
    selling_tier: string | null;

    @Expose()
    email_update_restricted: boolean;

    @Expose()
    email_update_restricted_reason: string;

    @Expose()
    @ValidateNested()
    profile: UserProfileResponseDto

    @Expose()
    createdAt: Date;

    @Expose()
    updatedAt: Date;

}

function formatSellerTier(tier?: SellerTier | null) {
    if (!tier) return null;

    const labels: Record<SellerTier, string> = {
        [SellerTier.BASIC_SELLER]: "Basic Seller",
        [SellerTier.STANDARD_SELLER]: "Standard Seller",
        [SellerTier.PREMIUM_SELLER]: "Premium Seller",
    };

    return labels[tier] ?? null;
}
