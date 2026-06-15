import { UserService } from "src/modules/auth/providers/user.service";
import { RegisterUserDto } from "../dtos/register.dto";
import { SigninDto } from "../dtos/signin.dto";
import { AuthProvider } from "./AuthProvider";
import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { OtpService } from "src/common/providres/OtpGenerator.provider";
import { SMTPProvider } from "src/common/providres/smtp.provider";
import { OtpPurpose } from "generated/prisma/enums";
import otpEmailTemplate from "src/common/templates/emailVerification.template";
import { verifyOtpDto } from "../dtos/verifyOtp.dto";
import { User } from "../models/User";

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name)
    
    constructor(private readonly userService:UserService,
         private readonly authProvider:AuthProvider,
         private readonly otpService:OtpService,
         private readonly smtpProvider:SMTPProvider
        ){}

    async registerUser(registerUserDto:RegisterUserDto){
        const isEmailAlreadyUsed = await this.userService.isUserExist(registerUserDto.email)
        
        if(isEmailAlreadyUsed){
            throw new ConflictException("Email already exist!")
        }

        if(registerUserDto.password !== registerUserDto.confirmPassword){
            throw new BadRequestException("password does not matched!")
        }

        const user =  await this.userService.saveUser(registerUserDto)
        const createdOtp = await this.otpService.create(user.id, OtpPurpose.EMAIL_VERIFICATION,new Date(Date.now() + 15 * 60 * 1000))
        try{
            this.sendEmailVerificationEmail( user.full_name, user.email, createdOtp.otp)
        }catch(err){
            this.logger.error(err)
            this.logger.log("sending verification email failed!")
        }
       

        return {user, email_verification_id:createdOtp.requestId}

    }

    async login(singinDto:SigninDto):Promise<string | Record<string, any>>{
        const tokenOrUser = await this.authProvider.authenticate(singinDto.email, singinDto.password)

        return tokenOrUser
    }

    private async sendEmailVerificationEmail( username:string, email:string, otp:string){
         
        this.smtpProvider.sendMail(email, "Email Verification", otpEmailTemplate({appname:"BestKid",name:username, otp}))
    }

    async verifyOtp(verifyOtpDto:verifyOtpDto){

        const otpVerification = await  this.otpService.verifyOtp(verifyOtpDto.requestId, verifyOtpDto.otp)

        return otpVerification

    }

    async getAuthenticatedUser(userId:number){
        return await this.userService.getUserById(userId)
    }

}