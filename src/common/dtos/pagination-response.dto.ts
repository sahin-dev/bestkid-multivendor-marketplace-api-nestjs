import { Expose } from "class-transformer";

export class PaginationResponseDto {

    @Expose()
    total: number
}