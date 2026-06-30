import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { RegisterUserDto } from "./dtos/register.dto";
import { AuthService } from "./providers/auth.service";
import { SigninDto } from "./dtos/signin.dto";
import { User } from "./models/User";
import { verifyOtpDto } from "./dtos/verifyOtp.dto";
import { plainToInstance } from "class-transformer";
import { RegisterUserResponseDto } from "./dtos/RegisterUserResponseDto";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "src/common/decorators";
import { ResendOtpDto } from "./dtos/ResendOtp.dto";
import { ForgotPasswordDto } from "./dtos/ForgotPasswordDto";
import { VerifyResetOtpDto } from "./dtos/VerifyResetOtpDto";
import { ResetPasswordDto } from "./dtos/ResetPasswordDto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {

    constructor(private readonly authService: AuthService) { }

    @Post("register")
    @Public()
    @ApiOperation({ summary: "Register a new user — returns OTP requestId for email verification" })
    @ApiBody({ type: RegisterUserDto })
    async register(@Body() registerUserDto: RegisterUserDto) {
        const registrationResponse = await this.authService.registerUser(registerUserDto)
        return plainToInstance(RegisterUserResponseDto, registrationResponse, {
            excludeExtraneousValues: true
        })
    }

    @Post("login")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Login — returns JWT or { email_unverified: true } or { user_is_blocked: true }" })
    @ApiBody({ type: SigninDto })
    async login(@Body() signinDto: SigninDto) {
        return this.authService.login(signinDto)
    }

    @Post("verify-email")
    @HttpCode(HttpStatus.OK)
    @Public()
    @ApiOperation({ summary: "Verify email OTP" })
    @ApiBody({ type: verifyOtpDto })
    async verifyOtp(@Body() verifyOtpDto: verifyOtpDto) {
        return this.authService.verifyOtp(verifyOtpDto)
    }

    @Post("resend-otp")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Resend email verification OTP" })
    @ApiBody({ type: ResendOtpDto })
    async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
        return this.authService.resendOtp(resendOtpDto.email)
    }

    // ─── Forgot Password Flow ────────────────────────────────────────────────────

    @Post("forgot-password")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Send password reset OTP to email" })
    @ApiBody({ type: ForgotPasswordDto })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto)
    }

    @Post("verify-reset-otp")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Verify the password reset OTP" })
    @ApiBody({ type: VerifyResetOtpDto })
    async verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
        return this.authService.verifyResetOtp(dto)
    }

    @Post("reset-password")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Reset password using verified OTP requestId" })
    @ApiBody({ type: ResetPasswordDto })
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto)
    }

    // ─── Authenticated ───────────────────────────────────────────────────────────

    @Get("me")
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Get currently authenticated user" })
    async getAuthenticatedUser(@Req() request: Request) {
        const user = request["user"] as User
        return await this.authService.getAuthenticatedUser(user.id)
    }
}