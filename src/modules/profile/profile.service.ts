import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UpdateProfileDto } from "./dtos/updateProfile.dto";
import { PrismaService } from "../prisma/prisma.service";
import path from "path";
import { UpdatePasswordDto } from "./dtos/UpdatePasswordDto";
import { EncoderProvider } from "../auth/providers/encoder.provider";

@Injectable()
export class ProfileService {

    constructor(private readonly prismaService:PrismaService, private readonly encoder:EncoderProvider){}


    async getUserProfile(userId:number){
        const profile =  await this.prismaService.baseUser.findUnique({where:{id:userId}})

        if(!profile){
            throw new NotFoundException("User not found!")
        }

        return profile
    }


    async updateProfile(userId:number, updateProfileDto:UpdateProfileDto, file?:Express.Multer.File){
        const user = await this.prismaService.baseUser.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("User not found!")
        }

        const updateData:Record<string, any> = {
            full_name:updateProfileDto.full_name || user.full_name,
            phone: updateProfileDto.phone || user.phone
        }

        if(file){
            updateData.profile_image_url = path.join("uploads", file.originalname)
        }

        const updatedUser = await this.prismaService.baseUser.update({where:{id:user.id},data:updateData})

        return updatedUser

    }

    async updatePassword(userId:number, updatePasswordDto:UpdatePasswordDto){

        const user  =await this.prismaService.baseUser.findUnique({where:{id:userId}})

        if(!user){
            throw new NotFoundException("user not found!")
        }
        if(updatePasswordDto.newpassword !== updatePasswordDto.confirmPassword){
            throw new BadRequestException("Password does not matched!")
        }

        if(await (this.encoder.compare(updatePasswordDto.currentPassword, user.password))){
            throw new BadRequestException("Invalid password")
        }

        const hashedPassword = await this.encoder.hashPassword(updatePasswordDto.newpassword, 10)


        const updatedProfile = await this.prismaService.baseUser.update({where:{id:userId}, data:{
            password: hashedPassword
        }})

        return updatedProfile

    }

}