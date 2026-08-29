import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UploadedPhotoDto {
    @ApiProperty({ enum: ["uploaded"] })
    status: "uploaded";

    @ApiProperty({ example: "https://media.example.com/example-overall" })
    url: string;

    @ApiProperty({ example: "overall-picture.jpg" })
    original_name: string;
}

export class FailedPhotoUploadDto {
    @ApiProperty({ enum: ["failed"] })
    status: "failed";

    @ApiProperty({ example: "inside-label.jpg" })
    original_name: string;

    @ApiProperty()
    error: {
        code: string;
        message: string;
    };
}

export type PhotoUploadResultDto = UploadedPhotoDto | FailedPhotoUploadDto;
