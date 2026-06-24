import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import dbConfig from './config/db.config';
import mailerConfig from './config/mailer.config';
import jwtConfig from './config/jwt.config';
import { ProfileModule } from './modules/profile/profile.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [

    ConfigModule.forRoot({isGlobal:true, load:[dbConfig, mailerConfig, jwtConfig]}),

    PrismaModule,
    AuthModule,
    ProfileModule,
    FileUploadModule,
    CategoryModule,
    ProductModule,
    OrderModule,
    UserModule
    // AuthModule.forRoot({
    //   user: {
    //     identifierFields: ['email', 'username'],
    //     signupFields: {
    //       required: ['email', 'password', 'name'],
    //     },
    //   },

    //   password: {
    //     minLength: 8,
    //     requireSpecialChar: true,
    //   },

    //   emailVerification: {
    //     enabled: true,
    //     mode: 'mandatory',
    //   },

    //   jwt: {
    //     secret: 'super-secret',
    //     expiresIn: '1d',
    //   },
    // }),
    
  ],
  controllers:[AppController],
  providers:[AppService]
})
export class AppModule{
 
}