import { UserService } from "src/modules/auth/providers/user.service";
import { RegisterUserDto } from "../dtos/register.dto";
import { SigninDto } from "../dtos/signin.dto";
import { AuthProvider } from "./AuthProvider";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OtpService } from "src/common/providres/OtpGenerator.provider";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpPurpose } from "generated/prisma/enums";
import otpEmailTemplate from "src/common/templates/emailVerification.template";
import { verifyOtpDto } from "../dtos/verifyOtp.dto";
import { ForgotPasswordDto } from "../dtos/ForgotPasswordDto";
import { VerifyResetOtpDto } from "../dtos/VerifyResetOtpDto";
import { ResetPasswordDto } from "../dtos/ResetPasswordDto";
import { EncoderProvider } from "./encoder.provider";

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name)

    constructor(
        private readonly userService: UserService,
        private readonly authProvider: AuthProvider,
        private readonly otpService: OtpService,
        private readonly smtpProvider: SMTPProvider,
        private readonly encoder: EncoderProvider,
    ) { }

    async registerUser(registerUserDto: RegisterUserDto) {
        const isEmailAlreadyUsed = await this.userService.isUserExist(registerUserDto.email)

        if (isEmailAlreadyUsed) {
            throw new ConflictException("Email already exist!")
        }

        if (registerUserDto.password !== registerUserDto.confirmPassword) {
            throw new BadRequestException("password does not matched!")
        }

        const user = await this.userService.saveUser(registerUserDto)
        const createdOtp = await this.createEmailVerificationOtp(user)

        return { user, email_verification_id: createdOtp.requestId }
    }

    async login(singinDto: SigninDto): Promise<string | Record<string, any>> {
        const tokenOrUser = await this.authProvider.authenticate(singinDto.email, singinDto.password)

        if (this.isEmailUnverifiedPayload(tokenOrUser)) {
            const user = await this.userService.getUserByEmail(singinDto.email)
            if (!user) {
                throw new NotFoundException("User not found!")
            }

            const createdOtp = await this.createEmailVerificationOtp(user)
            return { ...tokenOrUser, email_verification_id: createdOtp.requestId }
        }

        if (typeof tokenOrUser === "string" && singinDto.fcmToken) {
            const user = await this.userService.getUserByEmail(singinDto.email)
            if (user) {
                await this.userService.updateFcmToken(user.id, singinDto.fcmToken)
            }
        }

        return tokenOrUser
    }

    async adminLogin(signinDto: SigninDto) {
        const user = await this.userService.getUserByEmail(signinDto.email)

        if (!user || user.role !== "ADMIN" || user.is_blocked) {
            return this.getAdminAccessDeniedPayload()
        }

        const isPasswordValid = await this.encoder.compare(signinDto.password, user.password)
        if (!isPasswordValid) {
            return this.getAdminAccessDeniedPayload()
        }

        if (!user.email_verifird) {
            return {
                access_denied: true,
                reason: "EMAIL_UNVERIFIED",
                message: "Your admin email address is not verified.",
            }
        }

        const token = this.authProvider.signToken({
            id: user.id,
            role: user.role,
            email: user.email,
        })

        if (signinDto.fcmToken) {
            await this.userService.updateFcmToken(user.id, signinDto.fcmToken)
        }

        return {
            access_token: token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                profile: user.profile,
            },
        }
    }

    async resendOtp(email: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) {
            throw new NotFoundException("User not found!")
        }
        const createdOtp = await this.createEmailVerificationOtp(user)
        return { email_verification_id: createdOtp.requestId }
    }

    async verifyOtp(verifyOtpDto: verifyOtpDto) {
        this.logger.debug(verifyOtpDto)
        const otpVerification = await this.otpService.verifyOtp(verifyOtpDto.requestId, verifyOtpDto.otp)

        if (otpVerification?.purpose === OtpPurpose.EMAIL_VERIFICATION && otpVerification?.userId) {
            const user = await this.userService.emailVerified(otpVerification.userId)
            const accessToken = this.authProvider.signToken({
                id: user.id,
                role: user.role,
                email: user.email,
            })

            return { ...otpVerification, access_token: accessToken }
        }

        return otpVerification
    }

    async getAuthenticatedUser(userId: number) {
        return await this.userService.getUserById(userId)
    }

    // ─── Forgot Password Flow ────────────────────────────────────────────────────

    async forgotPassword(dto: ForgotPasswordDto) {
        return this.sendResetPasswordOtp(dto.email)
    }

    async adminForgotPassword(dto: ForgotPasswordDto) {
        return this.sendAdminResetPasswordOtp(dto.email)
    }

    async resendForgotPasswordOtp(dto: ForgotPasswordDto) {
        return this.sendResetPasswordOtp(dto.email)
    }

    async adminResendForgotPasswordOtp(dto: ForgotPasswordDto) {
        return this.sendAdminResetPasswordOtp(dto.email)
    }

    async verifyResetOtp(dto: VerifyResetOtpDto) {
        // Delegates to the shared OTP service; verifyOtp marks it verified+used
        // We need a "verify-only" approach: we verify but keep track via requestId
        const otp = await this.otpService.verifyOtp(dto.requestId, dto.otp)
        return { message: "OTP verified. You may now reset your password.", requestId: otp.requestId }
    }

    async adminVerifyResetOtp(dto: VerifyResetOtpDto) {
        const otp = await this.otpService.verifyOtp(dto.requestId, dto.otp)
        const user = otp.userId ? await this.userService.getUserByIdIncludingPassword(otp.userId) : null

        if (!user || user.role !== "ADMIN" || user.is_blocked) {
            throw new BadRequestException("Invalid admin reset request.")
        }

        return { message: "OTP verified. You may now reset your admin password.", requestId: otp.requestId }
    }

    async resetPassword(dto: ResetPasswordDto) {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException("Passwords do not match!")
        }

        // Find the verified OTP record using requestId
        const otp = await this.userService.findVerifiedResetOtp(dto.requestId)
        if (!otp || !otp.userId) {
            throw new BadRequestException("Invalid or expired reset request.")
        }

        const hashed = await this.encoder.hashPassword(dto.newPassword, 10)
        await this.userService.updatePassword(otp.userId, hashed)

        return { message: "Password has been reset successfully." }
    }

    async adminResetPassword(dto: ResetPasswordDto) {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException("Passwords do not match!")
        }

        const otp = await this.userService.findVerifiedResetOtp(dto.requestId)
        const user = otp?.userId ? await this.userService.getUserByIdIncludingPassword(otp.userId) : null

        if (!otp || !otp.userId || !user || user.role !== "ADMIN" || user.is_blocked) {
            throw new BadRequestException("Invalid or expired admin reset request.")
        }

        const hashed = await this.encoder.hashPassword(dto.newPassword, 10)
        await this.userService.updatePassword(otp.userId, hashed)

        return { message: "Admin password has been reset successfully." }
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────────

    private async sendEmailVerificationEmail(username: string, email: string, otp: string) {
        this.smtpProvider.sendMail(email, "Email Verification", otpEmailTemplate({ appname: "BestKid", name: username, otp }))
    }

    private async createEmailVerificationOtp(user: { id: number; email: string; profile?: { full_name?: string | null } | null }) {
        const createdOtp = await this.otpService.create(
            user.id,
            OtpPurpose.EMAIL_VERIFICATION,
            new Date(Date.now() + 15 * 60 * 1000),
        )

        try {
            this.sendEmailVerificationEmail(user.profile?.full_name ?? user.email, user.email, createdOtp.otp)
        } catch (err) {
            this.logger.error(err)
            this.logger.log("sending verification email failed!")
        }

        return createdOtp
    }

    private isEmailUnverifiedPayload(value: string | Record<string, any>): value is { email_unverified: true } {
        return typeof value !== "string" && value?.email_unverified === true
    }

    private async sendResetPasswordOtp(email: string) {
        const user = await this.userService.getUserByEmail(email)
        // For security, silently succeed even if email not found
        if (!user) {
            return { message: "If that email is registered, an OTP has been sent." }
        }

        const createdOtp = await this.otpService.create(
            user.id,
            OtpPurpose.RESET_PASSWORD,
            new Date(Date.now() + 15 * 60 * 1000),
        )

        try {
            this.smtpProvider.sendMail(
                user.email,
                "BestKid — Password Reset OTP",
                otpEmailTemplate({ appname: "BestKid", name: user.profile?.full_name ?? user.email, otp: createdOtp.otp }),
            )
        } catch (err) {
            this.logger.error(err)
        }

        return { message: "If that email is registered, an OTP has been sent.", requestId: createdOtp.requestId }
    }

    private async sendAdminResetPasswordOtp(email: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user || user.role !== "ADMIN" || user.is_blocked) {
            return { message: "If that admin email is registered, a verification code has been sent." }
        }

        const createdOtp = await this.otpService.create(
            user.id,
            OtpPurpose.RESET_PASSWORD,
            new Date(Date.now() + 15 * 60 * 1000),
        )

        try {
            this.smtpProvider.sendMail(
                user.email,
                "BestKid Admin - Password Reset OTP",
                otpEmailTemplate({ appname: "BestKid Admin", name: user.profile?.full_name ?? user.email, otp: createdOtp.otp }),
            )
        } catch (err) {
            this.logger.error(err)
        }

        return {
            message: "If that admin email is registered, a verification code has been sent.",
            requestId: createdOtp.requestId,
        }
    }

    private getAdminAccessDeniedPayload() {
        return {
            access_denied: true,
            reason: "INVALID_OR_BLOCKED_ADMIN",
            message:
                "Unfortunately, your admin credentials are blocked or invalid. Please contact the developer team for assistance.",
        }
    }
}
