import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { ReturnStatus } from "generated/prisma/client";

export enum ReturnTab {
    RETURN_REQUESTS = "RETURN_REQUESTS",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
}

export enum SellerReturnTab {
    IN_REVIEW = "IN_REVIEW",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    REJECTED = "REJECTED",
}

export class ReturnQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 1 })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 10 })
    limit?: number = 10;

    @IsOptional()
    @IsEnum(ReturnStatus)
    @ApiPropertyOptional({ enum: ReturnStatus })
    status?: ReturnStatus;

    @IsOptional()
    @IsEnum(ReturnTab)
    @ApiPropertyOptional({ enum: ReturnTab, description: "UI tab filter for My Returns" })
    tab?: ReturnTab;

    @IsOptional()
    @IsEnum(SellerReturnTab)
    @ApiPropertyOptional({ enum: SellerReturnTab, description: "Seller return-order UI tab filter" })
    sellerTab?: SellerReturnTab;
}
