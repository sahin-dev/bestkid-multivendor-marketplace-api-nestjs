import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class UpsertCompanyInfoDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Registered name of the company" })
    company_name: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Type of business" })
    business_type: string;

    @IsEmail()
    @IsNotEmpty()
    @ApiProperty({ description: "Contact email address" })
    contact_email: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Physical/Mailing address of the business" })
    contact_address: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Company website URL" })
    website: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: "Jurisdiction or country of registration" })
    jurisdiction: string;
}
