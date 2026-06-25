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
        const createdOtp = await this.otpService.create(user.id, OtpPurpose.EMAIL_VERIFICATION, new Date(Date.now() + 15 * 60 * 1000))
        try {
            this.sendEmailVerificationEmail(user.profile?.full_name ?? user.email, user.email, createdOtp.otp)
        } catch (err) {
            this.logger.error(err)
            this.logger.log("sending verification email failed!")
        }

        return { user, email_verification_id: createdOtp.requestId }
    }

    async login(singinDto: SigninDto): Promise<string | Record<string, any>> {
        const tokenOrUser = await this.authProvider.authenticate(singinDto.email, singinDto.password)
        return tokenOrUser
    }

    async resendOtp(email: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) {
            throw new NotFoundException("User not found!")
        }
        const createdOtp = await this.otpService.create(user.id, OtpPurpose.EMAIL_VERIFICATION, new Date(Date.now() + 15 * 60 * 1000))
        try {
            this.sendEmailVerificationEmail(user.profile?.full_name ?? user.email, user.email, createdOtp.otp)
        } catch (err) {
            this.logger.error(err)
            this.logger.log("sending verification email failed!")
        }
        return { email_verification_id: createdOtp.requestId }
    }

    async verifyOtp(verifyOtpDto: verifyOtpDto) {
        this.logger.debug(verifyOtpDto)
        const otpVerification = await this.otpService.verifyOtp(verifyOtpDto.requestId, verifyOtpDto.otp)
        return otpVerification
    }

    async getAuthenticatedUser(userId: number) {
        return await this.userService.getUserById(userId)
    }

    // ─── Forgot Password Flow ────────────────────────────────────────────────────

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.userService.getUserByEmail(dto.email)
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

    async verifyResetOtp(dto: VerifyResetOtpDto) {
        // Delegates to the shared OTP service; verifyOtp marks it verified+used
        // We need a "verify-only" approach: we verify but keep track via requestId
        const otp = await this.otpService.verifyOtp(dto.requestId, dto.otp)
        return { message: "OTP verified. You may now reset your password.", requestId: otp.requestId }
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

    // ─── Private Helpers ─────────────────────────────────────────────────────────

    private async sendEmailVerificationEmail(username: string, email: string, otp: string) {
        this.smtpProvider.sendMail(email, "Email Verification", otpEmailTemplate({ appname: "BestKid", name: username, otp }))
    }
}