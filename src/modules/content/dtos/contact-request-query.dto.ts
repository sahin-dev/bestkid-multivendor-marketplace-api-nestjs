import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { ContactStatus } from "generated/prisma/client";

export enum ContactStatusFilter {
    ALL = "ALL",
    TO_DO = "TO_DO",
    RESOLVED = "RESOLVED",
}

export class ContactRequestQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 1 })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiPropertyOptional({ default: 10 })
    limit?: number = 10;

    @IsOptional()
    @IsEnum(ContactStatusFilter)
    @ApiPropertyOptional({ enum: ContactStatusFilter })
    status?: ContactStatusFilter;
}

export function toContactStatus(status?: ContactStatusFilter) {
    if (!status || status === ContactStatusFilter.ALL) {
        return undefined;
    }

    return status as unknown as ContactStatus;
}
