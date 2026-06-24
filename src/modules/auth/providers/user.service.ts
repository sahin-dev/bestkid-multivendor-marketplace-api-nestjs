import { Injectable } from "@nestjs/common";
import { RegisterUserDto } from "src/modules/auth/dtos/register.dto";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { User } from "../models/User";
import { EncoderProvider } from "./encoder.provider";
import { UserRole } from "generated/prisma/enums";

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
                    email: createUser.email,
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
        return await this.prismaService.baseUser.findUnique({
            where: { email },
            include: { profile: true },
        });
    }

    async isUserExist(email: string): Promise<boolean> {
        const user = await this.prismaService.baseUser.findUnique({ where: { email } });
        return !!user;
    }

    async emailVerified(userId: number) {
        await this.prismaService.baseUser.update({
            where: { id: userId },
            data: { email_verifird: true },
        });
    }

    async getUserById(userId: number) {
        return this.prismaService.baseUser.findUnique({
            where: { id: userId },
            omit: { password: true },
            include: { profile: true },
        });
    }
}