import { Transform } from "class-transformer"
import { IsNotEmpty, IsOptional, Max, Min } from "class-validator"

export class PaginationDto {

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsNotEmpty()
    @Min(1)
    page: number = 1

    @IsOptional()
    @Transform(({ value }) => Number(value))
    @IsNotEmpty()
    @Min(1)
    limit: number = 20
}