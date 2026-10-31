import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { RegisterUserDto } from "src/modules/auth/dtos/register.dto";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { User } from "../models/User";
import { EncoderProvider } from "./encoder.provider";
import { ProductStatus, UserRole } from "generated/prisma/enums";

@Injectable()
export class UserService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly encoder: EncoderProvider,
    ) {}

    async saveUser(createUser: RegisterUserDto): Promise<any> {
        const hashedPassword = await this.encoder.hashPassword(createUser.password, 10);

        // Create user and profile in a transaction
        const result = await this.prismaService.$transaction(async (tx) => {
            const user = await tx.baseUser.create({
                data: {
                    email: createUser.email.trim().toLowerCase(),
                    password: hashedPassword,
                    role: UserRole.USER,
                },
            });

            const profile = await tx.profile.create({
                data: {
                    full_name: createUser.fullName,
                    phone: createUser.phone,
                    userId: user.id,
                },
            });

            const updatedUser = await tx.baseUser.update({
                where: { id: user.id },
                data: {
                    profile_id: profile.id,
                },
                include: { profile: true },
            });

            return updatedUser;
        });

        return result;
    }

    async getUserByEmail(email: string) {
        return await this.prismaService.baseUser.findFirst({
            where: { email: { equals: email.trim(), mode: "insensitive" } },
            include: { profile: true },
        });
    }

    async isUserExist(email: string): Promise<boolean> {
        const user = await this.getUserByEmail(email);
        return !!user;
    }

    async emailVerified(userId: number) {
        return this.prismaService.baseUser.update({
            where: { id: userId },
            data: { email_verifird: true },
            include: { profile: true },
        });
    }

    async getUserById(userId: number) {
        return this.prismaService.baseUser.findUnique({
            where: { id: userId },
            omit: { password: true },
            include: { profile: true },
        });
    }

    async getUserByIdIncludingPassword(userId: number) {
        return this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
    }

    async updatePassword(userId: number, hashedPassword: string) {
        return this.prismaService.baseUser.update({
            where: { id: userId },
            data: { password: hashedPassword, password_changed_at: new Date() },
        });
    }

    /**
     * Removes a user's personal data while keeping the orders and payments other parties and the
     * accounting records still depend on. Orders and payment rows must outlive the account.
     */
    async anonymizeUser(userId: number) {
        const unusablePassword = await this.encoder.hashPassword(randomBytes(32).toString("hex"), 10);

        await this.prismaService.$transaction(async (tx) => {
            await tx.userAddress.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.otpVerification.deleteMany({ where: { userId } });
            await tx.recentlyView.deleteMany({ where: { userId } });
            await tx.wishlistItem.deleteMany({ where: { userId } });
            await tx.sellerDeliveryOption.deleteMany({ where: { sellerId: userId } });
            await tx.cartItem.deleteMany({ where: { cart: { userId } } });
            await tx.cart.deleteMany({ where: { userId } });
            await tx.chatRoom.updateMany({
                where: { buyerId: userId },
                data: { buyer_deleted_at: new Date() },
            });
            await tx.chatRoom.updateMany({
                where: { sellerId: userId },
                data: { seller_deleted_at: new Date() },
            });

            // Pull the seller's listings from sale, and take their items out of other buyers' carts
            await tx.cartItem.deleteMany({ where: { product: { userId } } });
            await tx.wishlistItem.deleteMany({ where: { product: { userId } } });
            await tx.product.updateMany({
                where: { userId, status: ProductStatus.ACTIVE },
                data: { status: ProductStatus.INACTIVE, reserved_until: null, reserved_by_user_id: null },
            });

            await tx.profile.updateMany({
                where: { userId },
                data: { full_name: "Deleted user", phone: "", avatar_url: null, country: null },
            });
            await tx.baseUser.update({
                where: { id: userId },
                data: {
                    email: `deleted-user-${userId}@deleted.bestkid.invalid`,
                    password: unusablePassword,
                    password_changed_at: new Date(),
                    is_blocked: true,
                    fcmToken: null,
                },
            });
        });
    }

    async updateFcmToken(userId: number, fcmToken?: string | null) {
        const normalizedToken = fcmToken?.trim();

        return this.prismaService.baseUser.update({
            where: { id: userId },
            data: { fcmToken: normalizedToken || null },
        });
    }
}
