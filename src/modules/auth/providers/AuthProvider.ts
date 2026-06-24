import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
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
        const user = await this.prismaService.baseUser.findUnique({ where: { email } })
        if (!user) {
            throw new NotFoundException("User bot found!")
        }
        if (user.is_blocked) {
            return { "user_is_blocked": true };
        }

        if (user.email_verifird === false) {
            return { "email_unverified": true }
        }

        if (!(await this.encoder.compare(password, user.password))) {
            throw new BadRequestException("Invalid username or password!")
        }

        const tokenPayload: TokenPayload = {
            id: user.id,
            role: user.role,
            email: user.email,

        }

        const token = this.jwtService.sign(tokenPayload)

        return token

    }

    public async verifyToken(token: string): Promise<User> {

        const payload: TokenPayload = this.jwtService.verify(token)

        const user = await this.prismaService.baseUser.findUnique({ where: { id: payload.id } })

        if (!user) {
            throw new UnauthorizedException("User is not valid!")
        }

        return user
    }

}