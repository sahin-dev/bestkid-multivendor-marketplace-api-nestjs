import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthenticationStatus } from "generated/prisma/client";
import { createHmac, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LegitGrailsClient } from "./legitgrails.client";
import { SubmitProductAuthenticationDto } from "./dtos/submit-product-authentication.dto";
import { mapLegitGrailsResult } from "./legitgrails.mapper";

@Injectable()
export class LegitGrailsService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly client: LegitGrailsClient,
    ) {}

    async submitProduct(productId: number, actorId: number, dto: SubmitProductAuthenticationDto, isAdmin = false) {
        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            include: {
                category: true,
                subCategory: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        profile: { select: { full_name: true, country: true } },
                    },
                },
            },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        if (!isAdmin && product.userId !== actorId) {
            throw new ForbiddenException("You do not have permission to submit this product for authentication");
        }

        const activeRequest = await this.prismaService.productAuthenticationRequest.findFirst({
            where: {
                productId,
                provider: "LEGITGRAILS",
                status: { in: ["SUBMITTED", "PENDING", "IN_REVIEW", "PROCESSING"] },
            },
            orderBy: { createdAt: "desc" },
        });

        if (activeRequest) {
            throw new BadRequestException("This product already has an active LegitGrails authentication request.");
        }

        const requestPayload = {
            external_reference: `bestkid-product-${product.id}-${Date.now()}`,
            product: {
                id: product.id,
                name: product.name,
                description: product.description,
                brand: dto.brand,
                condition: product.condition,
                category: product.category?.name,
                subCategory: product.subCategory?.name,
                original_price: product.original_price,
                discounted_price: product.discounted_price,
                image_urls: dto.image_urls,
            },
            seller: {
                id: product.user.id,
                email: product.user.email,
                name: product.user.profile?.full_name,
                country: product.user.profile?.country,
            },
            notes: dto.notes,
            turnaround: dto.turnaround,
        };

        await this.prismaService.product.update({
            where: { id: productId },
            data: { brand: dto.brand },
        });

        const localRequest = await this.prismaService.productAuthenticationRequest.create({
            data: {
                productId,
                provider: "LEGITGRAILS",
                status: "SUBMITTING",
                image_urls: dto.image_urls,
                rawRequest: requestPayload,
            },
        });

        try {
            const response = await this.client.submitAuthentication(requestPayload);
            const mapped = mapLegitGrailsResult(response);
            const now = new Date();

            const updatedRequest = await this.prismaService.productAuthenticationRequest.update({
                where: { id: localRequest.id },
                data: {
                    externalOrderId: mapped.externalOrderId,
                    status: mapped.providerStatus,
                    verdict: mapped.verdict,
                    certificateUrl: mapped.certificateUrl,
                    reportUrl: mapped.reportUrl,
                    submittedAt: now,
                    completedAt: mapped.completed ? now : null,
                    rawResponse: response,
                },
            });

            await this.applyProductStatus(productId, mapped.productStatus, mapped.completed ? now : undefined);

            return updatedRequest;
        } catch (error) {
            await this.prismaService.productAuthenticationRequest.update({
                where: { id: localRequest.id },
                data: {
                    status: "FAILED",
                    lastError: (error as Error).message,
                },
            });
            throw error;
        }
    }

    async getProductAuthentication(productId: number, actorId: number, isAdmin = false) {
        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                userId: true,
                brand: true,
                is_authenticated: true,
                authentication_status: true,
                approved_at: true,
                rejected_at: true,
            },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        if (!isAdmin && product.userId !== actorId) {
            throw new ForbiddenException("You do not have permission to view authentication for this product");
        }

        const requests = await this.prismaService.productAuthenticationRequest.findMany({
            where: { productId, provider: "LEGITGRAILS" },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        return {
            product,
            latest_request: requests[0] ?? null,
            requests,
        };
    }

    async syncStatus(externalOrderId: string) {
        const request = await this.prismaService.productAuthenticationRequest.findFirst({
            where: { externalOrderId, provider: "LEGITGRAILS" },
        });

        if (!request) {
            throw new NotFoundException("LegitGrails authentication request not found");
        }

        const response = await this.client.getAuthenticationStatus(externalOrderId);
        return this.applyProviderResult(request.id, request.productId, response);
    }

    async handleWebhook(payload: any) {
        const mapped = mapLegitGrailsResult(payload);
        if (!mapped.externalOrderId) {
            throw new BadRequestException("LegitGrails webhook payload is missing an authentication request ID.");
        }

        const request = await this.prismaService.productAuthenticationRequest.findFirst({
            where: { externalOrderId: mapped.externalOrderId, provider: "LEGITGRAILS" },
        });

        if (!request) {
            throw new NotFoundException("LegitGrails authentication request not found");
        }

        return this.applyProviderResult(request.id, request.productId, payload);
    }

    verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined, secret: string | undefined) {
        if (!secret) {
            return;
        }
        if (!rawBody || !signature) {
            throw new ForbiddenException("LegitGrails webhook signature is missing.");
        }

        const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
        const normalizedSignature = signature.replace(/^sha256=/, "");
        const expected = Buffer.from(digest, "hex");
        const received = Buffer.from(normalizedSignature, "hex");

        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
            throw new ForbiddenException("LegitGrails webhook signature is invalid.");
        }
    }

    private async applyProviderResult(requestId: number, productId: number, payload: any) {
        const mapped = mapLegitGrailsResult(payload);
        const now = new Date();
        const updatedRequest = await this.prismaService.productAuthenticationRequest.update({
            where: { id: requestId },
            data: {
                externalOrderId: mapped.externalOrderId,
                status: mapped.providerStatus,
                verdict: mapped.verdict,
                certificateUrl: mapped.certificateUrl,
                reportUrl: mapped.reportUrl,
                completedAt: mapped.completed ? now : null,
                rawResponse: payload,
            },
        });

        await this.applyProductStatus(productId, mapped.productStatus, mapped.completed ? now : undefined);
        return updatedRequest;
    }

    private async applyProductStatus(productId: number, status: AuthenticationStatus, completedAt?: Date) {
        await this.prismaService.product.update({
            where: { id: productId },
            data: {
                authentication_status: status,
                is_authenticated: status === AuthenticationStatus.VERIFIED,
                approved_at: status === AuthenticationStatus.VERIFIED ? (completedAt ?? new Date()) : undefined,
                rejected_at: status === AuthenticationStatus.NOT_VERIFIED ? (completedAt ?? new Date()) : undefined,
            },
        });
    }
}
