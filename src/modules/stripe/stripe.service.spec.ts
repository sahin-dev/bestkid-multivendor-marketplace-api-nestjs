import { StripeService } from "./stripe.service";

describe("StripeService.handleWebhook", () => {
  let service: StripeService;
  let orderService: {
    createPendingCartOrders?: jest.Mock;
    createPendingBuyNowOrder?: jest.Mock;
    confirmOrder?: jest.Mock;
    checkoutFromCart?: jest.Mock;
    checkoutBuyNow?: jest.Mock;
    markProductsSoldForOrder?: jest.Mock;
    getCheckoutSummary?: jest.Mock;
    getBuyNowCheckoutSummary?: jest.Mock;
  };
  let paymentService: {
    createPendingTransaction?: jest.Mock;
    markSucceeded?: jest.Mock;
    linkOrderToSession?: jest.Mock;
  };
  let prismaService: {
    baseUser?: any;
    cartItem?: any;
    order?: any;
    paymentTransaction?: any;
  };

  beforeEach(() => {
    orderService = {
      confirmOrder: jest.fn().mockResolvedValue({ id: 1 }),
      markProductsSoldForOrder: jest.fn().mockResolvedValue(undefined),
    };

    paymentService = {
      markSucceeded: jest.fn().mockResolvedValue({}),
      linkOrderToSession: jest.fn().mockResolvedValue({}),
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

    expect(orderService.confirmOrder).not.toHaveBeenCalled();
    expect(orderService.markProductsSoldForOrder).not.toHaveBeenCalled();
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

    // Verify order was confirmed with session ID for buy-now
    expect(orderService.confirmOrder).toHaveBeenCalledWith(
      42,
      "cs_paid_123",
      true,
    );

    // Verify payment was linked to order
    expect(paymentService.linkOrderToSession).toHaveBeenCalledWith(
      "cs_paid_123",
      42,
    );

    // Verify product was marked sold
    expect(orderService.markProductsSoldForOrder).toHaveBeenCalledWith(42);
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

    // Verify each order was confirmed WITHOUT session ID for cart (to avoid unique constraint violation)
    expect(orderService.confirmOrder).toHaveBeenCalledWith(
      10,
      undefined,
      false,
    );
    expect(orderService.confirmOrder).toHaveBeenCalledWith(
      11,
      undefined,
      false,
    );
    expect(orderService.confirmOrder).toHaveBeenCalledWith(
      12,
      undefined,
      false,
    );

    // Verify payment was linked to first order
    expect(paymentService.linkOrderToSession).toHaveBeenCalledWith(
      "cs_cart_paid_123",
      10,
    );

    // Verify cart items were deleted
    expect(prismaService.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 5 },
    });

    // Verify products were marked sold for each order
    expect(orderService.markProductsSoldForOrder).toHaveBeenCalledWith(10);
    expect(orderService.markProductsSoldForOrder).toHaveBeenCalledWith(11);
    expect(orderService.markProductsSoldForOrder).toHaveBeenCalledWith(12);

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

  it("ignores a duplicate webhook for an already confirmed order", async () => {
    const orderServiceWithDuplicate = {
      confirmOrder: jest
        .fn()
        .mockResolvedValue({ id: 42, status: "CONFIRMED" }),
      markProductsSoldForOrder: jest.fn().mockResolvedValue(undefined),
    };
    const serviceWithDuplicate = new StripeService(
      prismaService as any,
      orderServiceWithDuplicate as any,
      paymentService as any,
      { stripe_key: "sk_test_123", webhook_key: "whsec_test_123" } as any,
    );

    (serviceWithDuplicate as any).stripe.webhooks.constructEvent = jest
      .fn()
      .mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_paid_duplicate_123",
            payment_status: "paid",
            payment_intent: "pi_paid_duplicate_123",
            customer: "cus_duplicate_123",
            metadata: {
              checkoutMode: "buy_now",
              userId: "1",
              orderId: "42",
            },
          },
        },
      });

    await serviceWithDuplicate.handleWebhook(
      Buffer.from("raw-body"),
      "stripe-signature",
    );

    expect(orderServiceWithDuplicate.confirmOrder).toHaveBeenCalledWith(
      42,
      "cs_paid_duplicate_123",
      true,
    );
    expect(
      orderServiceWithDuplicate.markProductsSoldForOrder,
    ).toHaveBeenCalledWith(42);
  });
});
