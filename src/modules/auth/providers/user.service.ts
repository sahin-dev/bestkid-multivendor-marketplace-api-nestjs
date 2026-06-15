import { Injectable } from "@nestjs/common";
import { RegisterUserDto } from "src/modules/auth/dtos/register.dto";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { User } from "../models/User";
import { EncoderProvider } from "./encoder.provider";
import { UserRole } from "generated/prisma/enums";

@Injectable()
export class UserService {

    constructor(private readonly prismaService:PrismaService, private readonly encoder:EncoderProvider){}

    async saveUser(createUser:RegisterUserDto):Promise<User>{
        const user = new User()
        user.email = createUser.email
        user.full_name = createUser.fullName
        user.password = await this.encoder.hashPassword(createUser.password, 10)
        user.role = UserRole.USER
        user.phone = createUser.phone
       
        return await this.prismaService.baseUser.create({data:user})
    }

    async getUserByEmail(email:string){
        return await this.prismaService.baseUser.findUnique({where:{email}})
    }

    async isUserExist(email:string):Promise<boolean>{
        const user = await this.prismaService.baseUser.findUnique({where:{email}})

        if(user){
            return true
        }

        return false;
    }
    
    async emailVerified(userId:number){
        const user = await this.prismaService.baseUser.update({where:{id:userId}, data:{email_verifird:true}})
    }

    async getUserById(userId:number){
        return this.prismaService.baseUser.findUnique({where:{id:userId}, omit:{password:true}})
    }


}