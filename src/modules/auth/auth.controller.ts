import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { RegisterUserDto } from "./dtos/register.dto";
import { AuthService } from "./providers/auth.service";
import { SigninDto } from "./dtos/signin.dto";
import { User } from "./models/User";
import { verifyOtpDto } from "./dtos/verifyOtp.dto";
import { plainToInstance } from "class-transformer";
import { RegisterUserResponseDto } from "./dtos/RegisterUserResponseDto";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Public } from "src/common/decorators";
import { ResendOtpDto } from "./dtos/ResendOtp.dto";

@Controller("auth")
export class AuthController {

    constructor(private readonly authService: AuthService) { }

    @Post("register")
    @Public()
    async register(@Body() registerUserDto: RegisterUserDto) {

        const registrationResponse = await this.authService.registerUser(registerUserDto)

        console.log(registrationResponse)
        return plainToInstance(RegisterUserResponseDto, registrationResponse, {
            excludeExtraneousValues: true
        })
    }


    @Post("login")
    @Public()
    @HttpCode(HttpStatus.OK)
    async login(@Body() signinDto: SigninDto) {
        return this.authService.login(signinDto)
    }

    @Post("verify-email")
    @HttpCode(HttpStatus.OK)
    @Public()
    async verifyOtp(@Body() verifyOtpDto: verifyOtpDto) {
        const verifiedOtp = await this.authService.verifyOtp(verifyOtpDto)

        return verifiedOtp
    }

    @Post("resend-otp")
    @Public()
    @HttpCode(HttpStatus.OK)
    async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
        const resendOtpResponse = await this.authService.resendOtp(resendOtpDto.email)

        return resendOtpResponse
    }



    @Get("me")
    @ApiBearerAuth("access-token")
    async getAuthenticatedUser(@Req() request: Request) {

        const user = request["user"] as User

        return await this.authService.getAuthenticatedUser(user.id)
    }

}