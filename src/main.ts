import "./instrument"
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ResponseTransformerInterceptor } from './common/interceptors/responseTransformer.interceptor';
import { GlobalHttpExceptionHandler } from './common/exceptions/GlobalHttpExceptionHandler';
import { applySwaggerResponseExamples } from './common/swagger/response-examples';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
   
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
    index: false,
    redirect: false,
  });
  app.setBaseViewsDir(join(__dirname, "..", "views"));
  app.setViewEngine("hbs");

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  }))


  const reflector = app.get(Reflector)

  app.useGlobalFilters(new GlobalHttpExceptionHandler())
  app.useGlobalInterceptors(new ResponseTransformerInterceptor(reflector))


  const config = new DocumentBuilder()
    .setTitle('BestKid Api')
    .setDescription('Backend API for the BestKid multivendor marketplace. Use the Bearer auth control with a JWT returned from /auth/login or /auth/admin/login for protected endpoints.')
    .addServer(process.env.SWAGGER_SERVER_URL!)
    .setVersion('1.0')
    .addTag('Auth', 'Registration, login, OTP verification, and password reset flows')
    .addTag('Admin Dashboard', 'Admin dashboard cards, activity, and platform earnings')
    .addTag('Admin Coupons', 'Admin coupon management')
    .addTag('User Management', 'Admin user listing, blocking, and seller tier management')
    .addTag('Products', 'Product listing, moderation, variants, and reviews')
    .addTag('Categories', 'Product category and sub-category management')
    .addTag('Orders', 'Buyer cart checkout, coupon preview, seller orders, and admin order workflows')
    .addTag('Returns', 'Return request workflows')
    .addTag('Cart', 'Authenticated cart management')
    .addTag('Wishlist', 'Authenticated saved products')
    .addTag('Account Settings', 'Addresses, preferences, connected account, and account deletion')
    .addTag('Profile', 'Authenticated user/admin profile and password management')
    .addTag('Seller', 'Seller account options and seller earnings')
    .addTag('Delivery', 'Seller delivery options')
    .addTag('Content', 'FAQ, legal documents, company info, and help/support requests')
    .addTag('Notifications', 'Notification list and read state')
    .addTag('Chat', 'Chat rooms and messages')
    .addTag('Stripe', 'Stripe buyer checkout sessions, seller onboarding, and admin connected accounts')
    .addTag('Uploads', 'File upload and deletion')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'access-token',) // name for the auth scheme
    .build();

  const documentFactory = () => {
    const document = SwaggerModule.createDocument(app, config);
    applySwaggerResponseExamples(document);
    return document;
  };
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
