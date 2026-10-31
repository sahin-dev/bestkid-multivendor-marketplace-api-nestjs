import { BadRequestException } from "@nestjs/common";
import { OtpPurpose } from "generated/prisma/client";
import { OtpService } from "./OtpGenerator.provider";

describe("OtpService", () => {
    const futureExpiry = new Date(Date.now() + 60_000);
    const otpRow = {
        id: 1,
        requestId: "req-1",
        userId: 42,
        otp: "123456",
        purpose: OtpPurpose.RESET_PASSWORD,
        attempts: 0,
        maxAttempts: 5,
        used: false,
        verified: false,
        expiresAt: futureExpiry,
    };

    let prisma: any;
    let service: OtpService;

    beforeEach(() => {
        prisma = {
            otpVerification: {
                create: jest.fn(async ({ data }) => data),
                findUnique: jest.fn().mockResolvedValue(otpRow),
                findFirst: jest.fn().mockResolvedValue({ ...otpRow, verified: true }),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        };
        service = new OtpService(prisma, { getUUid: () => "uuid" } as any);
    });

    it("always generates a six digit code", async () => {
        for (let i = 0; i < 50; i += 1) {
            const { otp } = await service.create(1, OtpPurpose.RESET_PASSWORD, futureExpiry);
            expect(otp).toMatch(/^\d{6}$/);
        }
    });

    it("never returns the code itself", async () => {
        const result = await service.verifyOtp("req-1", "123456", OtpPurpose.RESET_PASSWORD);

        expect(result).not.toHaveProperty("otp");
        expect(result.verified).toBe(true);
    });

    it("counts wrong guesses", async () => {
        await expect(service.verifyOtp("req-1", "000000", OtpPurpose.RESET_PASSWORD)).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.otpVerification.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { attempts: { increment: 1 } },
        });
    });

    it("locks a request after too many attempts, even for the right code", async () => {
        prisma.otpVerification.findUnique.mockResolvedValue({ ...otpRow, attempts: 5 });

        await expect(service.verifyOtp("req-1", "123456", OtpPurpose.RESET_PASSWORD)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.otpVerification.updateMany).not.toHaveBeenCalled();
    });

    it("does not accept a code issued for a different purpose", async () => {
        await expect(service.verifyOtp("req-1", "123456", OtpPurpose.EMAIL_VERIFICATION)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("does not accept an expired code", async () => {
        prisma.otpVerification.findUnique.mockResolvedValue({ ...otpRow, expiresAt: new Date(Date.now() - 1000) });

        await expect(service.verifyOtp("req-1", "123456", OtpPurpose.RESET_PASSWORD)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts a code only once when two requests race", async () => {
        prisma.otpVerification.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.verifyOtp("req-1", "123456", OtpPurpose.RESET_PASSWORD)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("lets a verified reset request be spent once", async () => {
        await expect(service.consumeVerifiedResetRequest("req-1")).resolves.toMatchObject({ userId: 42 });

        prisma.otpVerification.deleteMany.mockResolvedValue({ count: 0 });
        await expect(service.consumeVerifiedResetRequest("req-1")).resolves.toBeNull();
    });
});
