import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, Min, ValidateNested } from "class-validator";

export class ReorderHomeBannerItemDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiProperty({ example: 1 })
    id: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @ApiProperty({ example: 0 })
    sort_order: number;
}

export class ReorderHomeBannersDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReorderHomeBannerItemDto)
    @ApiProperty({ type: [ReorderHomeBannerItemDto] })
    banners: ReorderHomeBannerItemDto[];
}
