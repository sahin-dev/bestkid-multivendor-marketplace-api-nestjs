import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UpdateProfileDto } from "./dtos/updateProfile.dto";
import { PrismaService } from "../prisma/prisma.service";
import path from "path";
import { UpdatePasswordDto } from "./dtos/UpdatePasswordDto";
import { EncoderProvider } from "../auth/providers/encoder.provider";

@Injectable()
export class ProfileService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly encoder: EncoderProvider,
    ) {}

    async getUserProfile(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            omit: { password: true },
            include: { profile: true },
        });

        if (!user) {
            throw new NotFoundException("User not found!");
        }

        return user;
    }

    async updateProfile(userId: number, updateProfileDto: UpdateProfileDto, file?: Express.Multer.File) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user) {
            throw new NotFoundException("User not found!");
        }

        const profileData: Record<string, any> = {};

        if (updateProfileDto.full_name) {
            profileData.full_name = updateProfileDto.full_name;
        }
        if (updateProfileDto.phone) {
            profileData.phone = updateProfileDto.phone;
        }
        if (file) {
            profileData.avatar_url = path.join("uploads", file.originalname);
        }

        if (user.profile_id) {
            // Update existing profile
            await this.prismaService.profile.update({
                where: { id: user.profile_id },
                data: profileData,
            });
        } else {
            // Create profile and link it
            const profile = await this.prismaService.profile.create({
                data: {
                    full_name: profileData.full_name ?? "",
                    phone: profileData.phone ?? "",
                    avatar_url: profileData.avatar_url,
                    userId: userId,
                },
            });
            await this.prismaService.baseUser.update({
                where: { id: userId },
                data: { profile_id: profile.id },
            });
        }

        return this.prismaService.baseUser.findUnique({
            where: { id: userId },
            omit: { password: true },
            include: { profile: true },
        });
    }

    async updatePassword(userId: number, updatePasswordDto: UpdatePasswordDto) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id: userId } });

        if (!user) {
            throw new NotFoundException("user not found!");
        }
        if (updatePasswordDto.newpassword !== updatePasswordDto.confirmPassword) {
            throw new BadRequestException("Password does not matched!");
        }

        const isCurrentPasswordValid = await this.encoder.compare(updatePasswordDto.currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new BadRequestException("Invalid current password");
        }

        const hashedPassword = await this.encoder.hashPassword(updatePasswordDto.newpassword, 10);

        const updatedUser = await this.prismaService.baseUser.update({
            where: { id: userId },
            data: { password: hashedPassword },
            omit: { password: true },
            include: { profile: true },
        });

        return updatedUser;
    }
}