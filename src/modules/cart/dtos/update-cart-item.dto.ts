import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class UpdateCartItemDto {
    @IsInt()
    @Min(1)
    @ApiProperty({ description: "New quantity (must be >= 1)" })
    quantity: number;
}
