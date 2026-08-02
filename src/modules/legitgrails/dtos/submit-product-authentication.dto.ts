import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SubmitProductAuthenticationDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "Nike", description: "Brand of the product being authenticated" })
    brand: string;

    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    @ApiProperty({
        type: [String],
        example: [
            "https://cdn.bestkid.test/verification/front.png",
            "https://cdn.bestkid.test/verification/back.png",
            "https://cdn.bestkid.test/verification/label.png",
        ],
        description: "Verification photos: front, back, sides, brand label/logo, serial number, and box/proof of purchase if available",
    })
    image_urls: string[];

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Seller/admin note sent with the authentication request" })
    notes?: string;

    @IsString()
    @IsOptional()
    @ApiPropertyOptional({ description: "Requested turnaround/service level if supported by LegitGrails" })
    turnaround?: string;
}
