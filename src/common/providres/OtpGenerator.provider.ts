import { BadRequestException, Injectable } from "@nestjs/common";
import { OtpPurpose, OtpVerification } from "generated/prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { UUIdProvider } from "./uuid.provider";

@Injectable()
export class OtpService {
    constructor(private readonly prismaService: PrismaService, private readonly uuid: UUIdProvider) { }

    async create(userId: number, purpose: OtpPurpose, expiry: Date) {
        const code = Math.round(100000 + Math.random() * 900000).toString()
        const randomUUid = this.uuid.getUUid()

        const otpObject = await this.prismaService.otpVerification.create({
            data: {
                otp: code,
                userId,
                purpose,
                requestId: randomUUid,
                expiresAt: expiry
            }
        })

        return otpObject
    }

    async verifyOtp(requestId: string, code: string): Promise<any> {
        const otp = await this.prismaService.otpVerification.findUnique({ where: { requestId, expiresAt: { gte: new Date() } } })

        if (!otp || otp.otp !== code || otp.used) {
            throw new BadRequestException('Otp invalid')
        }
        const verifiedOtp = await this.prismaService.otpVerification.update({ where: { id: otp.id }, data: { verified: true, used: true }, omit: { otp: true } })

        return verifiedOtp
    }

    private isExpired(dateTime: Date) {
        const expirationTIme = new Date(dateTime)
        const currentTime = new Date(Date.now())

        if (currentTime > expirationTIme) {
            return false
        }

        return true
    }
}