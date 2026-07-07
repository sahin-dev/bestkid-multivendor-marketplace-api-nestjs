import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UpdateProfileDto } from "./dtos/updateProfile.dto";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePasswordDto } from "./dtos/UpdatePasswordDto";
import { EncoderProvider } from "../auth/providers/encoder.provider";
import { FileUploadService } from "../file-upload/file-upload.service";

@Injectable()
export class ProfileService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly encoder: EncoderProvider,
        private readonly fileUploadService: FileUploadService,
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


        return this.withProfileMetadata(user);
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
            const uploaded = await this.fileUploadService.uploadFile(file);
            profileData.avatar_url = uploaded.filePath;
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

        const updatedUser = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            omit: { password: true },
            include: { profile: true },
        });

        return this.withProfileMetadata(updatedUser);
    }

    async updatePassword(userId: number, updatePasswordDto: UpdatePasswordDto) {
        const user = await this.prismaService.baseUser.findUnique({ where: { id: userId } });

        if (!user) {
            throw new NotFoundException("user not found!");
        }
        const newPassword = updatePasswordDto.newPassword ?? updatePasswordDto.newpassword;
        if (!newPassword) {
            throw new BadRequestException("New password is required!");
        }
        if (newPassword !== updatePasswordDto.confirmPassword) {
            throw new BadRequestException("Password does not matched!");
        }

        const isCurrentPasswordValid = await this.encoder.compare(updatePasswordDto.currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new BadRequestException("Invalid current password");
        }

        const hashedPassword = await this.encoder.hashPassword(newPassword, 10);

        const updatedUser = await this.prismaService.baseUser.update({
            where: { id: userId },
            data: { password: hashedPassword },
            omit: { password: true },
            include: { profile: true },
        });

        return this.withProfileMetadata(updatedUser);
    }

    private withProfileMetadata<T extends { seller_tier?: string | null } | null>(user: T) {
        if (!user) {
            return user;
        }

        return {
            ...user,
            selling_tier: this.formatSellerTier(user.seller_tier),
            email_update_restricted: true,
            email_update_restricted_reason:
                "Email updates are restricted because the email address is linked to authentication, security verification, and order records.",
        };
    }

    private formatSellerTier(tier?: string | null) {
        const labels = {
            BASIC_SELLER: "Basic Seller",
            STANDARD_SELLER: "Standard Seller",
            PREMIUM_SELLER: "Premium Seller",
        };

        return tier ? (labels[tier] ?? tier) : null;
    }
}
