import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RegisterDeviceTokenDto {
    @ApiProperty({ description: "Device registration token from Firebase or Expo." })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ description: "Optional platform name such as Android, iOS, or Web.", required: false, default: "ANDROID" })
    @IsOptional()
    @IsString()
    platform?: string;
}

export class UnregisterDeviceTokenDto {
    @ApiProperty({ description: "Device registration token to revoke." })
    @IsString()
    @IsNotEmpty()
    token: string;
}
