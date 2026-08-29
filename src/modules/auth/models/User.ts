import { BaseUser, CurrencyPreference, LanguagePreference, SellerTier, UserRole } from "generated/prisma/client";
import { UserResponseDto } from "../dtos/UserResponseDto";
import { plainToInstance } from "class-transformer";

export class User implements BaseUser {
    id: number;
    email: string;
    password: string;
    email_verifird: boolean;
    is_blocked: boolean;
    profile_id: number | null;
    role: UserRole;
    fcmToken: string | null;
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
    language_preference: LanguagePreference;
    currency_preference: CurrencyPreference;
    seller_tier: SellerTier;
    createdAt: Date;
    updatedAt: Date;

    public static maptoDto(user: User) {
        return plainToInstance(UserResponseDto, user, {
            excludeExtraneousValues: true,
        });
    }
}
