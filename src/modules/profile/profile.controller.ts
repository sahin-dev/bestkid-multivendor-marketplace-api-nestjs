import { Body, Controller, Get, Patch, Put, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from "@nestjs/swagger";
import { UpdateProfileDto } from "./dtos/updateProfile.dto";
import { ProfileService } from "./profile.service";
import { User } from "../auth/models/User";
import { plainToInstance } from "class-transformer";
import { UserResponseDto } from "../auth/dtos/UserResponseDto";
import { UpdatePasswordDto } from "./dtos/UpdatePasswordDto";

@Controller("profile")
@ApiBearerAuth("access-token")
export class ProfileController{

    constructor(private readonly profileService:ProfileService){}

    @Get()
    getUserProfile(@Req() request:Request){

        const user = request['user'] as User

        const profile = this.profileService.getUserProfile(user.id)

        return plainToInstance(UserResponseDto, profile, {
            excludeExtraneousValues:true
        })
    }

    @Patch()
    @ApiOperation({ summary: "Update the authenticated user's profile" })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: UpdateProfileDto })
    @UseInterceptors(FileInterceptor('file'))
    updateUserProfile(@Req() request:Request, @Body()updateProfileDto:UpdateProfileDto, @UploadedFile() file?:Express.Multer.File){

        const user = request['user'] as User

        const updatedProfile = this.profileService.updateProfile(user.id,updateProfileDto, file)

        return plainToInstance(UserResponseDto, updatedProfile, {
            excludeExtraneousValues:true
        })
    }   

    @Patch("update-password")
    @ApiOperation({ summary: "Change the authenticated user's password" })
    @ApiBody({ type: UpdatePasswordDto })
    async updatePassword(@Req() request:Request, @Body() updatePasswordDto:UpdatePasswordDto){

        const user = request['user'] as User

        const updatedProfile = await this.profileService.updatePassword(user.id, updatePasswordDto)

        return plainToInstance(UserResponseDto, updatedProfile, {
            excludeExtraneousValues:true
        })
    }



}