import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { ProductStatus } from "generated/prisma/client";

export class UpdateProductStatusDto {
    @IsEnum(ProductStatus)
    @ApiProperty({
        enum: ProductStatus,
        example: ProductStatus.ACTIVE,
        description: "New sale status for the product",
    })
    status: ProductStatus;
}
