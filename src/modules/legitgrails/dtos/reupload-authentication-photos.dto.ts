import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from "class-validator";

export class ReuploadPhotoDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: "overall-picture", description: "index_code LegitGrails flagged in the current photos_to_resubmit" })
    index_code: string;

    @IsString()
    @IsNotEmpty()
    @ValidateIf((dto: ReuploadPhotoDto) => !dto.is_unable_to_provide)
    @ApiPropertyOptional({ example: "https://cdn.bestkid.test/verification/overall-picture-2.png", description: "Replacement photo URL" })
    url?: string;

    @IsBoolean()
    @IsOptional()
    @ApiPropertyOptional({ description: "Set true instead of a url when this photo genuinely cannot be provided" })
    is_unable_to_provide?: boolean;
}

export class ReuploadAuthenticationPhotosDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReuploadPhotoDto)
    @ArrayMinSize(1)
    @ApiProperty({
        type: [ReuploadPhotoDto],
        description: "A resolution for every index_code in the order's current photos_to_resubmit",
    })
    photos: ReuploadPhotoDto[];

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    @ApiPropertyOptional({ description: "Optional note sent with the update, up to 1000 characters" })
    note?: string;
}
