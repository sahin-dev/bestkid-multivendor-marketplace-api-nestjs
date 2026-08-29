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
    provider?: PaymentProvider;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    stripeCustomerId?: string;
    providerReferenceId?: string;
    providerApplicationId?: string;
    providerRedirectUrl?: string;
    providerStatus?: string;
    providerPayload?: Prisma.JsonValue;
    metadata?: Prisma.JsonValue;
  }) {
    return this.prismaService.paymentTransaction.create({
      data: {
        userId: params.userId,
        orderId: params.orderId,
        amount: params.amount,
        currency: params.currency ?? "usd",
        provider: params.provider ?? PaymentProvider.STRIPE,
        status: PaymentStatus.PENDING,
        stripe_session_id: params.stripeSessionId,
        stripe_payment_intent_id: params.stripePaymentIntentId,
        stripe_customer_id: params.stripeCustomerId,
        provider_reference_id: params.providerReferenceId,
        provider_application_id: params.providerApplicationId,
        provider_redirect_url: params.providerRedirectUrl,
        provider_status: params.providerStatus,
        provider_payload: params.providerPayload ?? undefined,
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

  async findByProviderReferenceId(providerReferenceId: string) {
    return this.prismaService.paymentTransaction.findUnique({
      where: { provider_reference_id: providerReferenceId },
    });
  }

  async findByProviderApplicationId(providerApplicationId: string) {
    return this.prismaService.paymentTransaction.findUnique({
      where: { provider_application_id: providerApplicationId },
    });
  }

  async updateProviderStatus(
    transactionId: number,
    params: {
      status: PaymentStatus;
      providerStatus?: string;
      providerApplicationId?: string;
      providerPayload?: Prisma.JsonValue;
      paymentStatus?: string;
      metadata?: Prisma.JsonValue;
    },
  ) {
    const data: Prisma.PaymentTransactionUpdateInput = {
      status: params.status,
    };
    if (params.providerStatus !== undefined) {
      data.provider_status = params.providerStatus;
    }
    if (params.providerApplicationId !== undefined) {
      data.provider_application_id = params.providerApplicationId;
    }
    if (params.providerPayload !== undefined) {
      data.provider_payload = params.providerPayload as Prisma.InputJsonValue;
    }
    if (params.paymentStatus !== undefined) {
      data.payment_status = params.paymentStatus;
    }
    if (params.metadata !== undefined) {
      data.metadata = params.metadata as Prisma.InputJsonValue;
    }

    return this.prismaService.paymentTransaction.update({
      where: { id: transactionId },
      data,
    });
  }
}
