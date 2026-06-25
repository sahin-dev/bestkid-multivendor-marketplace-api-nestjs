import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import dbConfig from './config/db.config';
import mailerConfig from './config/mailer.config';
import jwtConfig from './config/jwt.config';
import stripeConfig from './config/stripe.config';
import { ProfileModule } from './modules/profile/profile.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { UserModule } from './modules/user/user.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { HomeModule } from './modules/home/home.module';
import { CartModule } from './modules/cart/cart.module';
import { ReturnModule } from './modules/return/return.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ContentModule } from './modules/content/content.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [dbConfig, mailerConfig, jwtConfig, stripeConfig] }),
    PrismaModule,
    AuthModule,
    ProfileModule,
    FileUploadModule,
    CategoryModule,
    ProductModule,
    OrderModule,
    UserModule,
    StripeModule,
    DeliveryModule,
    HomeModule,
    CartModule,
    ReturnModule,
    ChatModule,
    NotificationModule,
    ContentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}