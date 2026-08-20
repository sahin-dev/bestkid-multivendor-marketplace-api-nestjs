import { NotificationType, PushDeliveryStatus } from "generated/prisma/client";
import { NotificationService } from "./notification.service";

describe("NotificationService", () => {
  it("creates a notification and sends a push delivery for an active token", async () => {
    const prisma = {
      baseUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, fcmToken: "device-token-123" }),
      },
      notification: {
        create: jest.fn().mockResolvedValue({
          id: 42,
          userId: 1,
          title: "Order Placed",
          message: "Your order has been placed.",
          type: NotificationType.ORDER,
        }),
      },
      pushNotificationLog: {
        create: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          notificationId: 42,
          title: "Order Placed",
          message: "Your order has been placed.",
          type: NotificationType.ORDER,
          payload: { notificationId: "42", type: "ORDER" },
          status: PushDeliveryStatus.PENDING,
          attempts: 0,
          maxAttempts: 5,
          nextAttemptAt: new Date(),
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          title: "Order Placed",
          message: "Your order has been placed.",
          type: NotificationType.ORDER,
          payload: { notificationId: "42", type: "ORDER" },
          status: PushDeliveryStatus.PENDING,
          attempts: 0,
          maxAttempts: 5,
          nextAttemptAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const firebase = {
      sendMulticast: jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      }),
      sendToToken: jest.fn().mockResolvedValue({
        success: true,
        messageId: "msg-123",
      }),
    };

    const service = new NotificationService(prisma as any, firebase as any);

    const notification = await service.create(1, "Order Placed", "Your order has been placed.", NotificationType.ORDER);

    expect(notification.id).toBe(42);
    expect(firebase.sendToToken).toHaveBeenCalledWith(
      "device-token-123",
      "Order Placed",
      "Your order has been placed.",
      expect.objectContaining({ notificationId: "42", type: "ORDER" }),
    );
  });

  it("updates the current Firebase token on the user record when re-registering", async () => {
    const prisma = {
      baseUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 2 }),
        update: jest.fn().mockResolvedValue({
          id: 2,
          fcmToken: "rotated-token",
        }),
      },
    };

    const firebase = { sendToToken: jest.fn() };
    const service = new NotificationService(prisma as any, firebase as any);

    await service.registerDeviceToken(2, { token: "rotated-token", platform: "ANDROID" });

    expect(prisma.baseUser.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { fcmToken: "rotated-token" },
    });
  });
});
