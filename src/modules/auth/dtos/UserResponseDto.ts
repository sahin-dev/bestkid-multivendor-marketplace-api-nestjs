import { Expose } from "class-transformer";
import { UserRole } from "generated/prisma/enums";

export class UserResponseDto {
    @Expose()
    id: number;

    @Expose()
    email: string;

    @Expose()
    full_name: string;

    @Expose()
    phone: string;

    @Expose()
    email_verifird: boolean;

    @Expose()
    is_blocked: boolean;

    @Expose()
    role: UserRole;

    @Expose()
    createdAt: Date;

    @Expose()
    updatedAt: Date;

}