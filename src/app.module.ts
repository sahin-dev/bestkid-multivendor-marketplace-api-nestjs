import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import dbConfig from './config/db.config';
import mailerConfig from './config/mailer.config';
import jwtConfig from './config/jwt.config';
import stripeConfig from './config/stripe.config';
import legitgrailsConfig from './config/legitgrails.config';
import firebaseConfig from './config/firebase.config';
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
import { AccountModule } from './modules/account/account.module';
import { SellerModule } from './modules/seller/seller.module';
import { AdminModule } from './modules/admin/admin.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { LegitGrailsModule } from './modules/legitgrails/legitgrails.module';
import { CurrencyConversionService } from './modules/currency/currency.service';

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [dbConfig, mailerConfig, jwtConfig, stripeConfig, legitgrailsConfig, firebaseConfig] }),
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
    AccountModule,
    SellerModule,
    AdminModule,
    CouponModule,
    WishlistModule,
    PaymentModule,
    LegitGrailsModule,
  ],
  controllers: [AppController],
  providers: [AppService, CurrencyConversionService],
})
export class AppModule {}
