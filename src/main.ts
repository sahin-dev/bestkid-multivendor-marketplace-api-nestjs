import "./instrument"
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';
import { ResponseTransformerInterceptor } from './common/interceptors/responseTransformer.interceptor';
import { GlobalHttpExceptionHandler } from './common/exceptions/GlobalHttpExceptionHandler';
import { applySwaggerResponseExamples } from './common/swagger/response-examples';
import { corsOriginDelegate } from './config/cors.config';

function setupSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('BestKid Api')
    .setDescription('Backend API for the BestKid multivendor marketplace. Use the Bearer auth control with a JWT returned from /auth/login or /auth/admin/login for protected endpoints.')
    .addServer(process.env.API_PUBLIC_URL ?? process.env.SWAGGER_SERVER_URL ?? 'http://localhost:3000')
    .setVersion('1.0')
    .addTag('Auth', 'Registration, login, OTP verification, and password reset flows')
    .addTag('Admin Dashboard', 'Admin dashboard cards, activity, and platform earnings')
    .addTag('Admin Coupons', 'Admin coupon management')
    .addTag('User Management', 'Admin user listing, blocking, and seller tier management')
    .addTag('Products', 'Product listing, moderation, and reviews. Each product is a single, unique, authenticated item.')
    .addTag('Categories', 'Product category and sub-category management')
    .addTag('Orders', 'Buyer cart checkout, coupon preview, seller orders, and admin order workflows')
    .addTag('Returns', 'Return request workflows')
    .addTag('Cart', 'Authenticated cart management')
    .addTag('Wishlist', 'Authenticated saved products')
    .addTag('Account Settings', 'Addresses, preferences, connected account, and account deletion')
    .addTag('Profile', 'Authenticated user/admin profile and password management')
    .addTag('Seller', 'Seller account options and seller earnings')
    .addTag('Admin Home Banners', 'Admin homepage banner carousel management')
    .addTag('Delivery', 'Seller delivery options')
    .addTag('Content', 'FAQ, legal documents, company info, and help/support requests')
    .addTag('Notifications', 'Notification list and read state')
    .addTag('Chat', 'Chat rooms and messages')
    .addTag('Stripe', 'Stripe buyer checkout sessions, seller onboarding, and admin connected accounts')
    .addTag('TBI Credit', 'TBI Fusion Pay installment calculations, applications, and status updates')
    .addTag('LegitGrails', 'Product authentication submissions and webhook results')
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
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const isProduction = process.env.NODE_ENV === 'production';

  // Rate limiting keys on the client IP, which the reverse proxy passes in X-Forwarded-For
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  app.disable('x-powered-by');

  app.use(helmet({
    // Product images are hotlinked by the website and dashboard from another origin
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: isProduction ? undefined : false,
  }));
  app.use(compression());
  app.useBodyParser('json', { limit: '2mb' });

  app.enableCors({
    origin: corsOriginDelegate,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
    index: false,
    redirect: false,
    maxAge: '30d',
    setHeaders: (res) => {
      // Uploaded files are data: never let a browser execute them on the API origin
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
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

  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    setupSwagger(app);
  }

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error(error instanceof Error ? error.message : error);
  process.exit(1);
});
