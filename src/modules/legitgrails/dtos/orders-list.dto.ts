import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OrderListItemDto {
    @ApiProperty({ example: "6a21d480-38ac-4cc3-9c0c-bd0145b687af" })
    id: string;

    @ApiPropertyOptional({ example: "listing-10442" })
    external_id?: string | null;

    @ApiPropertyOptional()
    order_number?: string | null;

    @ApiProperty({ enum: ["queued", "processing", "update-photos", "completed", "error"] })
    status: string;

    @ApiPropertyOptional({ enum: ["authentic", "fake", "unable-to-verify", "canceled"] })
    outcome?: string | null;

    @ApiPropertyOptional({ example: "2026-08-05T09:30:00.000Z" })
    due_date?: string | null;

    @ApiPropertyOptional({ example: "2026-08-04T10:12:42.000Z" })
    updated_at?: string | null;
}

export class OrdersListDto {
    @ApiProperty({ type: [OrderListItemDto] })
    data: OrderListItemDto[];

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 10 })
    limit: number;

    @ApiProperty({ example: 25 })
    total: number;
}
