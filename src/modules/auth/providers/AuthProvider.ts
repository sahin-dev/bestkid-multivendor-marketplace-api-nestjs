import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { EncoderProvider } from "./encoder.provider";
import { JwtService } from "@nestjs/jwt";
import { TokenPayload } from "src/modules/auth/types/TokenPayload.type";
import { User } from "../models/User";

@Injectable()
export class AuthProvider {


    constructor(private readonly prismaService: PrismaService,
        private readonly encoder: EncoderProvider,
        private readonly jwtService: JwtService
    ) {

    }

    public async authenticate(email: string, password: string): Promise<string | Record<string, any>> {
        const user = await this.prismaService.baseUser.findFirst({
            where: { email: { equals: email.trim(), mode: "insensitive" } },
        })

        // Same response either way, so login cannot be used to discover registered emails
        if (!user || !(await this.encoder.compare(password, user.password))) {
            throw new BadRequestException("Invalid email or password!")
        }

        if (user.is_blocked) {
            return { user_is_blocked: true };
        }

        if (user.email_verifird === false) {
            return { email_unverified: true }
        }

        const tokenPayload: TokenPayload = {
            id: user.id,
            role: user.role,
            email: user.email,

        }

        const token = this.generateJwtToken(tokenPayload)

        return token

    }

    public signToken(payload: TokenPayload): string {
        return this.generateJwtToken(payload)
    }

    private generateJwtToken(payload: TokenPayload): string {
        return this.jwtService.sign(payload)
    }

    public async verifyToken(token: string): Promise<User> {

        const payload: TokenPayload = this.jwtService.verify(token)

        const user = await this.prismaService.baseUser.findUnique({ where: { id: payload.id } })

        if (!user) {
            throw new UnauthorizedException("User is not valid!")
        }

        if (this.isIssuedBeforePasswordChange(payload, user.password_changed_at)) {
            throw new UnauthorizedException("Session has expired. Please log in again.")
        }

        return user
    }

    // iat has one-second resolution, so a token issued in the same second as the change stays valid
    private isIssuedBeforePasswordChange(payload: TokenPayload, passwordChangedAt: Date | null) {
        return Boolean(passwordChangedAt && payload.iat !== undefined && payload.iat < Math.floor(passwordChangedAt.getTime() / 1000))
    }

}
