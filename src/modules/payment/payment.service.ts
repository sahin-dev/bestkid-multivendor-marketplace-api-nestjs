import { Injectable, Logger } from "@nestjs/common";
import { PaymentProvider, PaymentStatus, Prisma } from "generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async createPendingTransaction(params: {
    userId: number;
    orderId?: number;
    amount: number;
    currency?: string;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    stripeCustomerId?: string;
    metadata?: Prisma.JsonValue;
  }) {
    return this.prismaService.paymentTransaction.create({
      data: {
        userId: params.userId,
        orderId: params.orderId,
        amount: params.amount,
        currency: params.currency ?? "usd",
        provider: PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        stripe_session_id: params.stripeSessionId,
        stripe_payment_intent_id: params.stripePaymentIntentId,
        stripe_customer_id: params.stripeCustomerId,
        metadata: params.metadata ?? undefined,
      },
    });
  }

  async markSucceeded(sessionId: string, paymentIntentId?: string, customerId?: string) {
    const tx = await this.prismaService.paymentTransaction.findUnique({
      where: { stripe_session_id: sessionId },
    });

    if (!tx) {
      this.logger.warn(`No payment transaction found for stripe session ${sessionId}`);
      return null;
    }

    return this.prismaService.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        stripe_payment_intent_id: paymentIntentId ?? tx.stripe_payment_intent_id,
        stripe_customer_id: customerId ?? tx.stripe_customer_id,
        payment_status: "paid",
      },
    });
  }

  async linkOrderToSession(sessionId: string, orderId: number) {
    const tx = await this.prismaService.paymentTransaction.findUnique({
      where: { stripe_session_id: sessionId },
    });

    if (!tx) {
      this.logger.warn(`No payment transaction found for stripe session ${sessionId} to attach order ${orderId}`);
      return null;
    }

    return this.prismaService.paymentTransaction.update({
      where: { id: tx.id },
      data: { orderId },
    });
  }

  async findBySessionId(sessionId: string) {
    return this.prismaService.paymentTransaction.findUnique({
      where: { stripe_session_id: sessionId },
    });
  }
}
