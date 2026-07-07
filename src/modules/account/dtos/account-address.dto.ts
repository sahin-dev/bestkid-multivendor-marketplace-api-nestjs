import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateAccountAddressDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "Home" })
    address_name: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "25 Ivan Vazov Street, Plovdiv 4000, Bulgaria" })
    address: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Plovdiv" })
    city?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "4000" })
    postal_code?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Bulgaria" })
    country?: string;

    @IsBoolean()
    @IsOptional()
    @ApiPropertyOptional({ default: false })
    is_default?: boolean;
}

export class UpdateAccountAddressDto {
    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Office" })
    address_name?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "25 Ivan Vazov Street, Plovdiv 4000, Bulgaria" })
    address?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Plovdiv" })
    city?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "4000" })
    postal_code?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ example: "Bulgaria" })
    country?: string;

    @IsBoolean()
    @IsOptional()
    @ApiPropertyOptional()
    is_default?: boolean;
}
