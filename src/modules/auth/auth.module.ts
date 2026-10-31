import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './providers/auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UserService } from './providers/user.service';
import { AuthProvider } from './providers/AuthProvider';
import { PrismaService } from '../prisma/prisma.service';
import { EncoderProvider } from './providers/encoder.provider';
import { SMTPProvider } from 'src/common/providres/smtp.provider';
import { OtpService } from 'src/common/providres/OtpGenerator.provider';
import { UUIdProvider } from 'src/common/providres/uuid.provider';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guards';
import jwtConfig from 'src/config/jwt.config';
import type { ConfigType } from '@nestjs/config';



@Module({
  providers:[AuthService, UserService, AuthProvider, EncoderProvider, SMTPProvider, OtpService, UUIdProvider,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },],
  controllers:[AuthController],
  exports:[UserService, EncoderProvider, AuthProvider],
  imports:[PrismaModule, JwtModule.registerAsync({
    global:true,
    inject:[jwtConfig.KEY],
    useFactory:(config:ConfigType<typeof jwtConfig>)=>{
      if(!config.jwt_secret){
        throw new Error("JWT_SECRET is not configured.")
      }

      return {
        secret:config.jwt_secret,
        signOptions:{expiresIn:(config.expires_in ?? "7d") as any, algorithm:"HS256"},
        verifyOptions:{algorithms:["HS256"]},
      }
    },
  })
]
})
export class AuthModule {
 

}