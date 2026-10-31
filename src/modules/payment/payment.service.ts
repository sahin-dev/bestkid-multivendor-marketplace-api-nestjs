import { Injectable, Logger } from "@nestjs/common";
import { PaymentProvider, PaymentStatus, Prisma, SellerTier } from "generated/prisma/client";
import { getSellerFeePercent } from "src/config/seller-fee";
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
        provider_payload: this.toInputJson(params.providerPayload),
        metadata: this.toInputJson(params.metadata),
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

  async findById(id: number) {
    return this.prismaService.paymentTransaction.findUnique({ where: { id } });
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

  /**
   * A cart payment covers several orders and references them only in metadata, so the lookup is
   * scoped to the buyer and matched on both the foreign key and the metadata.
   */
  async findPaidTransactionForOrder(orderId: number, buyerId: number) {
    const transactions = await this.prismaService.paymentTransaction.findMany({
      where: {
        userId: buyerId,
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED] },
      },
      orderBy: { createdAt: "desc" },
    });

    return transactions.find((transaction) => this.coversOrder(transaction, orderId)) ?? null;
  }

  async findOpenTransactionsForOrders(orderIds: number[], buyerId: number) {
    const transactions = await this.prismaService.paymentTransaction.findMany({
      where: {
        userId: buyerId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      },
    });

    return transactions.filter((transaction) => orderIds.some((orderId) => this.coversOrder(transaction, orderId)));
  }

  /**
   * What a seller actually keeps, in USD. Orders paid before fees were snapshotted fall back to
   * the seller's current tier.
   */
  async getSellerEarnings(where: Prisma.OrderWhereInput, sellerTier: SellerTier) {
    const [snapshotted, older] = await Promise.all([
      this.prismaService.order.aggregate({
        where: { ...where, seller_net_amount: { not: null } },
        _sum: { total: true, seller_net_amount: true },
      }),
      this.prismaService.order.aggregate({
        where: { ...where, seller_net_amount: null },
        _sum: { total: true },
      }),
    ]);

    const olderGross = older._sum.total ?? 0;
    const olderNet = olderGross * (1 - getSellerFeePercent(sellerTier) / 100);

    return {
      gross: this.roundMoney((snapshotted._sum.total ?? 0) + olderGross),
      net: this.roundMoney((snapshotted._sum.seller_net_amount ?? 0) + olderNet),
    };
  }

  /**
   * The seller's share of a financed order in the payment currency. It was fixed when the bank
   * application was made, and shrinks in proportion to any return refunded since.
   */
  getManualPayout(
    transaction: { currency: string; metadata: Prisma.JsonValue },
    order: { id: number; total: number; platform_fee_percent: number | null; seller_net_amount: number | null },
  ) {
    const metadata = (transaction.metadata ?? {}) as Record<string, any>;
    const plan = Array.isArray(metadata.cartSplitPlan)
      ? metadata.cartSplitPlan.find((entry: any) => Number(entry.orderId) === order.id)
      : undefined;
    const sellerShare = Number(plan?.sellerTransferAmount ?? metadata.sellerTransferAmount) || 0;

    const originalNet = order.total * (1 - (order.platform_fee_percent ?? 0) / 100);
    const remaining =
      order.seller_net_amount !== null && originalNet > 0 ? order.seller_net_amount / originalNet : 1;

    return { amount: this.roundMoney(sellerShare * remaining), currency: transaction.currency };
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
      data.provider_payload = this.toInputJson(params.providerPayload);
    }
    if (params.paymentStatus !== undefined) {
      data.payment_status = params.paymentStatus;
    }
    if (params.metadata !== undefined) {
      data.metadata = this.toInputJson(params.metadata);
    }

    return this.prismaService.paymentTransaction.update({
      where: { id: transactionId },
      data,
    });
  }

  private coversOrder(transaction: { orderId: number | null; metadata: Prisma.JsonValue }, orderId: number) {
    if (transaction.orderId === orderId) {
      return true;
    }

    const metadata = transaction.metadata as Record<string, unknown> | null;
    const orderIds = String(metadata?.orderIds ?? metadata?.orderId ?? "").split(",").map(Number);
    return orderIds.includes(orderId);
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toInputJson(value?: Prisma.JsonValue) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
