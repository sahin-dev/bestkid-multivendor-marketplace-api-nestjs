import { BadRequestException, Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { OtpPurpose } from "generated/prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { UUIdProvider } from "./uuid.provider";

@Injectable()
export class OtpService {
    constructor(private readonly prismaService: PrismaService, private readonly uuid: UUIdProvider) { }

    async create(userId: number, purpose: OtpPurpose, expiry: Date) {
        const code = randomInt(100000, 1000000).toString()
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

    async verifyOtp(requestId: string, code: string, purpose: OtpPurpose): Promise<any> {
        const otp = await this.prismaService.otpVerification.findUnique({ where: { requestId } })

        if (!otp || otp.purpose !== purpose || otp.used || otp.expiresAt < new Date() || otp.attempts >= otp.maxAttempts) {
            throw new BadRequestException('Otp invalid')
        }

        if (otp.otp !== code) {
            await this.prismaService.otpVerification.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
            throw new BadRequestException('Otp invalid')
        }

        // The used:false guard makes a code single-use even across concurrent requests
        const consumed = await this.prismaService.otpVerification.updateMany({
            where: { id: otp.id, used: false },
            data: { verified: true, used: true },
        })
        if (consumed.count === 0) {
            throw new BadRequestException('Otp invalid')
        }

        const { otp: _code, ...verifiedOtp } = otp
        return { ...verifiedOtp, verified: true, used: true }
    }

    /**
     * Spends a verified password-reset request. It can only be spent once, and only until the
     * original OTP expiry, so a leaked requestId cannot be replayed to reset the password later.
     */
    async consumeVerifiedResetRequest(requestId: string) {
        const otp = await this.prismaService.otpVerification.findFirst({
            where: { requestId, purpose: OtpPurpose.RESET_PASSWORD, verified: true, expiresAt: { gte: new Date() } },
        })
        if (!otp) {
            return null
        }

        const { count } = await this.prismaService.otpVerification.deleteMany({ where: { id: otp.id } })
        return count > 0 ? otp : null
    }
}