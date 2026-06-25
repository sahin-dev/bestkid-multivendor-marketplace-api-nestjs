import { BaseUser, UserRole } from "generated/prisma/client";
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
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
    createdAt: Date;
    updatedAt: Date;

    public static maptoDto(user: User) {
        return plainToInstance(UserResponseDto, user, {
            excludeExtraneousValues: true,
        });
    }
}