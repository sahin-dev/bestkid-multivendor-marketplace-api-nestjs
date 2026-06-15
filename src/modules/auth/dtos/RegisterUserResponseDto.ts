import { ValidateNested } from "class-validator";
import { UserResponseDto } from "./UserResponseDto";
import { Expose, Type } from "class-transformer";

export class RegisterUserResponseDto{

    @ValidateNested()
    @Type(() => UserResponseDto)
    @Expose()
    user:UserResponseDto

    @Expose()
    email_verification_id:string
}