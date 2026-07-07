import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { SellerTier } from "generated/prisma/client";

export class UpdateSellerTierDto {
    @IsEnum(SellerTier)
    @IsNotEmpty()
    @ApiProperty({ enum: SellerTier, description: "Seller tier to assign to the user" })
    seller_tier: SellerTier;
}
