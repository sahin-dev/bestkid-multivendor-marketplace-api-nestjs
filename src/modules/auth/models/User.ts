import { BaseUser, UserRole } from "generated/prisma/client";
import { UserResponseDto } from "../dtos/UserResponseDto";
import { instanceToPlain, plainToInstance } from "class-transformer";

export class User implements BaseUser{

    id: number;
    email: string;
    full_name: string;
    password: string;
    phone: string;
    email_verifird: boolean;
    is_blocked: boolean;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;

    public static maptoDto(user:User){

       return plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues:true
       })

    }

}