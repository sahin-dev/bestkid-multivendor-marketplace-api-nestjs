import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentService } from "./payment.service";

@Module({
  imports: [PrismaModule],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
