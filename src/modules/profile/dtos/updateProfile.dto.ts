import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class UpdateProfileDto{

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    full_name?:string

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    phone?:string
}