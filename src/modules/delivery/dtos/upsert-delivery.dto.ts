import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";

export class UpsertDeliveryDto {
    // Domestic
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "Domestic delivery partner/company name" })
    domestic_partner?: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, description: "Domestic delivery cost" })
    domestic_cost?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @ApiProperty({ required: false, description: "Domestic min delivery days" })
    domestic_days_min?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @ApiProperty({ required: false, description: "Domestic max delivery days" })
    domestic_days_max?: number;

    // International
    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: "International delivery partner/company name" })
    international_partner?: string;

    @IsNumber()
    @IsPositive()
    @IsOptional()
    @ApiProperty({ required: false, description: "International delivery cost" })
    international_cost?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @ApiProperty({ required: false, description: "International min delivery days" })
    international_days_min?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    @ApiProperty({ required: false, description: "International max delivery days" })
    international_days_max?: number;
}
