import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { AuthenticationStatus } from "generated/prisma/client";

export class UpdateProductAuthStatusDto {
    @IsEnum(AuthenticationStatus)
    @IsNotEmpty()
    @ApiProperty({ enum: AuthenticationStatus, description: "Authentication status of the product" })
    status: AuthenticationStatus;
}
