import { Expose } from "class-transformer";
import { ValidateNested } from "class-validator";
import { UserRole } from "generated/prisma/enums";
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
    @ValidateNested()
    profile: UserProfileResponseDto

    @Expose()
    createdAt: Date;

    @Expose()
    updatedAt: Date;

}