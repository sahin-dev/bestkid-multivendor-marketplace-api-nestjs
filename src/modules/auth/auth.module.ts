import { DynamicModule, Module } from '@nestjs/common';
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



@Module({
  providers:[AuthService, UserService, AuthProvider, EncoderProvider, SMTPProvider, OtpService, UUIdProvider,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },],
  controllers:[AuthController],
  exports:[],
  imports:[PrismaModule, JwtModule.register({
    global:true,
    secret:"MySecret",
    signOptions:{expiresIn:"365d"}
  })
]
})
export class AuthModule {
 

}