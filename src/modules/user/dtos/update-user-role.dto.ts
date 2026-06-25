import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { UserRole } from "generated/prisma/client";

export class UpdateUserRoleDto {
    @IsEnum(UserRole)
    @IsNotEmpty()
    @ApiProperty({ enum: UserRole, description: "New role of the user" })
    role: UserRole;
}
