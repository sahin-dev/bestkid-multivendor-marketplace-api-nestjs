import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUrl, IsArray, ArrayMinSize, ArrayUnique, IsIn, IsOptional, MaxLength } from "class-validator";

export class CreateWebhookDto {
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @ApiPropertyOptional({ example: "Live order events" })
    name?: string;

    @IsString()
    @IsUrl({ require_protocol: true, protocols: ["https"] })
    @MaxLength(2048)
    @ApiProperty({ example: "https://partner.example.com/webhooks/legitgrails" })
    url: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayUnique()
    @IsIn(["order-outcome", "update-photos"], { each: true })
    @ApiProperty({ enum: ["order-outcome", "update-photos"], example: ["order-outcome", "update-photos"] })
    events: ("order-outcome" | "update-photos")[];
}

export class WebhookEndpointDto {
    @ApiProperty({ example: "9f8768c4-b570-4167-8272-6e781f812d66" })
    id: string;

    @ApiPropertyOptional({ example: "Live order events" })
    name?: string | null;

    @ApiProperty({ example: "https://partner.example.com/webhooks/legitgrails" })
    url: string;

    @ApiProperty({ enum: ["order-outcome", "update-photos"], example: ["order-outcome", "update-photos"] })
    events: ("order-outcome" | "update-photos")[];

    @ApiProperty({ example: "2026-08-04T10:20:30.000Z" })
    created_at: string;
}

export class CreateWebhookResponseDto extends WebhookEndpointDto {
    @ApiProperty({ example: "<opaque-secret>" })
    signing_secret: string;
}
