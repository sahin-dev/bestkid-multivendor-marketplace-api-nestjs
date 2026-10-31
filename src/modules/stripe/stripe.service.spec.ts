import { StripeService } from "./stripe.service";

describe("StripeService.handleWebhook", () => {
  let service: StripeService;
  let orderService: {
    createPendingCartOrders?: jest.Mock;
    createPendingBuyNowOrder?: jest.Mock;
    finalizePaidOrders?: jest.Mock;
    cancelPendingPaymentOrders?: jest.Mock;
    notifyPaymentReturned?: jest.Mock;
    getCheckoutSummary?: jest.Mock;
    getBuyNowCheckoutSummary?: jest.Mock;
  };
  let paymentService: {
    createPendingTransaction?: jest.Mock;
    markSucceeded?: jest.Mock;
    linkOrderToSession?: jest.Mock;
    findBySessionId?: jest.Mock;
    findPaidTransactionForOrder?: jest.Mock;
    updateProviderStatus?: jest.Mock;
  };
  let prismaService: {
    baseUser?: any;
    cartItem?: any;
    order?: any;
    paymentTransaction?: any;
  };

  beforeEach(() => {
    orderService = {
      finalizePaidOrders: jest.fn(async ({ orderIds }) => ({
        confirmed: orderIds,
        alreadySettled: [],
        rejected: [],
      })),
      cancelPendingPaymentOrders: jest.fn().mockResolvedValue({ count: 1 }),
      notifyPaymentReturned: jest.fn().mockResolvedValue(undefined),
    };

    paymentService = {
      markSucceeded: jest.fn().mockResolvedValue({}),
      linkOrderToSession: jest.fn().mockResolvedValue({}),
      findBySessionId: jest.fn().mockResolvedValue({ id: 1, status: "PENDING", metadata: {} }),
      findPaidTransactionForOrder: jest.fn(),
      updateProviderStatus: jest.fn().mockResolvedValue({}),
    };

    prismaService = {
      baseUser: {
        updateMany: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 10,
            sellerId: 100,
            total: 100,
            seller: {
              id: 100,
              stripe_account_id: "acct_seller_100",
              stripe_onboarding_complete: true,
              seller_tier: "BASIC_SELLER",
            },
          },
          {
            id: 11,
            sellerId: 101,
            total: 200,
            seller: {
              id: 101,
              stripe_account_id: "acct_seller_101",
              stripe_onboarding_complete: true,
              seller_tier: "STANDARD_SELLER",
            },
          },
          {
            id: 12,
            sellerId: 102,
            total: 300,
            seller: {
              id: 102,
              stripe_account_id: "acct_seller_102",
              stripe_onboarding_complete: true,
              seller_tier: "PREMIUM_SELLER",
            },
          },
        ]),
      },
      paymentTransaction: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, metadata: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    service = new StripeService(
      prismaService as any,
      orderService as any,
      paymentService as any,
      { convertAsync: jest.fn(async (amount: number) => amount) } as any,
      { create: jest.fn().mockResolvedValue({}) } as any,
      {
        stripe_key: "sk_test_123",
        webhook_key: "whsec_test_123",
      } as any,
    );

    (service as any).stripe.paymentIntents.retrieve = jest
      .fn()
      .mockResolvedValue({
        latest_charge: "ch_paid_123",
      });
    (service as any).stripe.transfers.create = jest
      .fn()
      .mockResolvedValueOnce({ id: "tr_order_10" })
      .mockResolvedValueOnce({ id: "tr_order_11" })
      .mockResolvedValueOnce({ id: "tr_order_12" });

    (service as any).stripe.webhooks.constructEvent = jest
      .fn()
      .mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            payment_status: "unpaid",
            metadata: {
              checkoutMode: "buy_now",
              userId: "1",
              productId: "2",
            },
          },
        },
      });
  });

  it("ignores a completed checkout session when payment is not actually paid", async () => {
    await service.handleWebhook(Buffer.from("raw-body"), "stripe-signature");

    expect(orderService.finalizePaidOrders).not.toHaveBeenCalled();
    expect(paymentService.markSucceeded).not.toHaveBeenCalled();
  });

  it("confirms order and marks product sold when buy-now payment is paid", async () => {
    (service as any).stripe.webhooks.constructEvent = jest
      .fn()
      .mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_paid_123",
            payment_status: "paid",
            payment_intent: "pi_paid_123",
            customer: "cus_customer_123",
            metadata: {
              checkoutMode: "buy_now",
              userId: "1",
              orderId: "42",
            },
          },
        },
      });

    await service.handleWebhook(Buffer.from("raw-body"), "stripe-signature");

    // Verify payment was marked succeeded
    expect(paymentService.markSucceeded).toHaveBeenCalledWith(
      "cs_paid_123",
      "pi_paid_123",
      "cus_customer_123",
    );

    expect(orderService.finalizePaidOrders).toHaveBeenCalledWith({
      orderIds: [42],
      cartId: undefined,
      cartItemIds: undefined,
      couponId: undefined,
      stripeCheckoutSessionId: "cs_paid_123",
    });

    // Verify payment was linked to order
    expect(paymentService.linkOrderToSession).toHaveBeenCalledWith(
      "cs_paid_123",
      42,
    );

  });

  it("confirms cart orders and marks products sold when cart payment is paid", async () => {
    (service as any).stripe.webhooks.constructEvent = jest
      .fn()
      .mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_cart_paid_123",
            payment_status: "paid",
            payment_intent: "pi_cart_paid_123",
            customer: "cus_cart_customer_123",
            metadata: {
              checkoutMode: "cart",
              userId: "1",
              orderIds: "10,11,12",
              cartId: "5",
            },
          },
        },
      });

    await service.handleWebhook(Buffer.from("raw-body"), "stripe-signature");

    // Verify payment was marked succeeded
    expect(paymentService.markSucceeded).toHaveBeenCalledWith(
      "cs_cart_paid_123",
      "pi_cart_paid_123",
      "cus_cart_customer_123",
    );

    expect(orderService.finalizePaidOrders).toHaveBeenCalledWith({
      orderIds: [10, 11, 12],
      cartId: 5,
      cartItemIds: undefined,
      couponId: undefined,
      stripeCheckoutSessionId: undefined,
    });

    // Verify payment was linked to first order
    expect(paymentService.linkOrderToSession).toHaveBeenCalledWith(
      "cs_cart_paid_123",
      10,
    );

    expect((service as any).stripe.transfers.create).toHaveBeenCalledTimes(3);
    expect((service as any).stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9000,
        destination: "acct_seller_100",
        source_transaction: "ch_paid_123",
      }),
      { idempotencyKey: "cart-transfer-cs_cart_paid_123-10" },
    );
  });

  const completedEvent = (object: Record<string, unknown>) => ({
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        payment_status: "paid",
        payment_intent: "pi_123",
        customer: "cus_123",
        ...object,
      },
    },
  });

  it("does not pay sellers twice when a webhook is redelivered", async () => {
    orderService.finalizePaidOrders = jest.fn().mockResolvedValue({
      confirmed: [],
      alreadySettled: [10],
      rejected: [],
    });
    paymentService.findBySessionId = jest.fn().mockResolvedValue({
      id: 1,
      metadata: { cartTransfers: [{ orderId: 10, transferId: "tr_1" }] },
    });
    prismaService.order.findMany = jest.fn().mockResolvedValue([
      {
        id: 10,
        sellerId: 100,
        total: 100,
        seller: {
          id: 100,
          stripe_account_id: "acct_seller_100",
          stripe_onboarding_complete: true,
          seller_tier: "BASIC_SELLER",
        },
      },
    ]);
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(
      completedEvent({ metadata: { checkoutMode: "cart", orderIds: "10", cartId: "5" } }),
    );

    await service.handleWebhook(Buffer.from("raw-body"), "stripe-signature");

    expect((service as any).stripe.transfers.create).not.toHaveBeenCalled();
  });

  it("refunds a buy-now payment that arrives for an order it can no longer fulfil", async () => {
    orderService.finalizePaidOrders = jest.fn().mockResolvedValue({
      confirmed: [],
      alreadySettled: [],
      rejected: [42],
    });
    prismaService.order.findUnique = jest.fn().mockResolvedValue({
      id: 42,
      userId: 1,
      total: 80,
      stripe_checkout_session_id: null,
      seller: { seller_tier: "BASIC_SELLER" },
    });
    prismaService.paymentTransaction.update = jest.fn().mockResolvedValue({});
    paymentService.findPaidTransactionForOrder = jest.fn().mockResolvedValue({
      id: 7,
      amount: 80,
      currency: "usd",
      stripe_payment_intent_id: "pi_123",
      metadata: { checkoutMode: "buy_now" },
    });
    (service as any).stripe.refunds = {
      create: jest.fn().mockResolvedValue({ id: "re_1" }),
    };
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue(
      completedEvent({ metadata: { checkoutMode: "buy_now", orderId: "42" } }),
    );

    await service.handleWebhook(Buffer.from("raw-body"), "stripe-signature");

    expect((service as any).stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_123",
        amount: 8000,
        reverse_transfer: true,
        refund_application_fee: true,
      }),
      { idempotencyKey: "order-refund-42" },
    );
    expect(prismaService.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REFUNDED" }),
      }),
    );
    expect(orderService.notifyPaymentReturned).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ refund_amount: 80, currency: "usd" }),
    );
  });

  it("does not refund an order twice", async () => {
    prismaService.order.findUnique = jest.fn().mockResolvedValue({
      id: 42,
      userId: 1,
      total: 80,
      seller: { seller_tier: "BASIC_SELLER" },
    });
    paymentService.findPaidTransactionForOrder = jest.fn().mockResolvedValue({
      id: 7,
      amount: 80,
      stripe_payment_intent_id: "pi_123",
      metadata: {
        checkoutMode: "buy_now",
        returnRefunds: [{ kind: "ORDER_CANCELLATION", orderId: 42, amountCents: 8000 }],
      },
    });
    (service as any).stripe.refunds = { create: jest.fn() };

    await expect(service.refundOrderPayment(42)).resolves.toEqual({
      refunded: false,
      already_refunded: true,
    });
    expect((service as any).stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("only refunds a cart order's own share of the payment and reverses that seller's transfer", async () => {
    prismaService.order.findUnique = jest.fn().mockResolvedValue({
      id: 10,
      userId: 1,
      total: 100,
      stripe_checkout_session_id: null,
      seller: { seller_tier: "BASIC_SELLER" },
    });
    prismaService.paymentTransaction.update = jest.fn().mockResolvedValue({});
    paymentService.findPaidTransactionForOrder = jest.fn().mockResolvedValue({
      id: 7,
      amount: 300,
      currency: "usd",
      stripe_payment_intent_id: "pi_123",
      metadata: {
        checkoutMode: "cart",
        cartSplitPlan: [{ orderId: 10, orderAmountCents: 10000 }],
        cartTransfers: [{ orderId: 10, transferId: "tr_10" }],
      },
    });
    (service as any).stripe.refunds = {
      create: jest.fn().mockResolvedValue({ id: "re_1" }),
    };
    (service as any).stripe.transfers.createReversal = jest
      .fn()
      .mockResolvedValue({ id: "trr_1" });

    await service.refundOrderPayment(10);

    expect((service as any).stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000 }),
      { idempotencyKey: "order-refund-10" },
    );
    expect((service as any).stripe.transfers.createReversal).toHaveBeenCalledWith(
      "tr_10",
      expect.objectContaining({ amount: 9000 }),
      { idempotencyKey: "order-transfer-reversal-10" },
    );
    expect(prismaService.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCEEDED", payment_status: "partially_refunded" }),
      }),
    );
  });

  it("releases orders when a checkout session expires unpaid", async () => {
    (service as any).stripe.webhooks.constructEvent = jest.fn().mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_expired",
          metadata: { checkoutMode: "cart", orderIds: "10,11" },
        },
      },
    });

    await service.handleWebhook(Buffer.from("raw-body"), "stripe-signature");

    expect(orderService.cancelPendingPaymentOrders).toHaveBeenCalledWith(
      [10, 11],
      "Checkout session expired without payment.",
    );
    expect(paymentService.updateProviderStatus).toHaveBeenCalledWith(1, {
      status: "CANCELLED",
      paymentStatus: "expired",
    });
  });

  describe("payOutFinancedOrder", () => {
    const deliveredOrder = {
      id: 42,
      userId: 1,
      sellerId: 100,
      status: "DELIVERED",
      total: 100,
      platform_fee_percent: 10,
      seller_net_amount: 90,
      seller_payout_at: null,
      seller: { stripe_account_id: "acct_seller_100" },
      items: [{ returnRequests: [] }],
    };
    const tbiTransaction = {
      id: 7,
      provider: "TBI_CREDIT",
      currency: "eur",
      metadata: { sellerTransferAmount: 82.8 },
    };

    beforeEach(() => {
      prismaService.order.findUnique = jest.fn().mockResolvedValue(deliveredOrder);
      prismaService.order.update = jest.fn().mockResolvedValue({});
      paymentService.findPaidTransactionForOrder = jest.fn().mockResolvedValue(tbiTransaction);
      (paymentService as any).getManualPayout = jest.fn().mockReturnValue({ amount: 82.8, currency: "eur" });
      (service as any).stripe.transfers.create = jest.fn().mockResolvedValue({ id: "tr_payout" });
    });

    it("sends the seller their share once and records it", async () => {
      await service.payOutFinancedOrder(42);

      expect((service as any).stripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 8280, currency: "eur", destination: "acct_seller_100" }),
        { idempotencyKey: "tbi-payout-42" },
      );
      expect(prismaService.order.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { seller_payout_at: expect.any(Date), seller_payout_reference: "tr_payout" },
      });
    });

    it.each([
      ["already paid", { seller_payout_at: new Date() }],
      ["not delivered", { status: "SHIPPED" }],
      ["a return is open", { items: [{ returnRequests: [{ status: "PENDING" }] }] }],
    ])("refuses when %s", async (_label, change) => {
      prismaService.order.findUnique = jest.fn().mockResolvedValue({ ...deliveredOrder, ...change });

      await expect(service.payOutFinancedOrder(42)).rejects.toThrow();
      expect((service as any).stripe.transfers.create).not.toHaveBeenCalled();
    });

    it("refuses a card order, which was already paid out at checkout", async () => {
      paymentService.findPaidTransactionForOrder = jest.fn().mockResolvedValue({ ...tbiTransaction, provider: "STRIPE" });

      await expect(service.payOutFinancedOrder(42)).rejects.toThrow(/Only TBI Credit/);
    });
  });

  it("rejects a webhook with an invalid signature", async () => {
    (service as any).stripe.webhooks.constructEvent = jest.fn(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    await expect(
      service.handleWebhook(Buffer.from("{}"), "t=1,v1=forged"),
    ).rejects.toThrow(/signature verification failed/);
  });
});
