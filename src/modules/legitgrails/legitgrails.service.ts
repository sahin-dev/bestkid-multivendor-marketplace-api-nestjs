import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { AuthenticationStatus, NotificationType, ProductStatus } from "generated/prisma/client";
import { createHmac, timingSafeEqual } from "crypto";
import legitgrailsConfig, { LegitGrailsConfig } from "src/config/legitgrails.config";
import { PrismaService } from "../prisma/prisma.service";
import { ProductService } from "../product/product.service";
import { LegitGrailsClient } from "./legitgrails.client";
import { SubmitProductAuthenticationDto } from "./dtos/submit-product-authentication.dto";
import { ReuploadAuthenticationPhotosDto, ReuploadPhotoDto } from "./dtos/reupload-authentication-photos.dto";
import { mapLegitGrailsResult } from "./legitgrails.mapper";
import { NotificationService } from "../notification/notification.service";

const ACTIVE_REQUEST_STATUSES_EXCLUDED: string[] = ["completed", "error", "FAILED"];

@Injectable()
export class LegitGrailsService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly client: LegitGrailsClient,
        private readonly productService: ProductService,
        private readonly notificationService: NotificationService,
        @Inject(legitgrailsConfig.KEY)
        private readonly config: ConfigType<typeof LegitGrailsConfig>,
    ) {}

    async submitProduct(productId: number, actorId: number, dto: SubmitProductAuthenticationDto, isAdmin = false) {
        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: { id: true, userId: true },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        if (!isAdmin && product.userId !== actorId) {
            throw new ForbiddenException("You do not have permission to submit this product for authentication");
        }

        const activeRequest = await this.findActiveRequest(productId);
        if (activeRequest) {
            throw new BadRequestException("This product already has an active LegitGrails authentication request.");
        }

        if (this.config.test_mode && !dto.mock_outcome) {
            throw new BadRequestException(
                "LegitGrails is configured with a Test API key; mock_outcome is required (authentic, fake, unable-to-verify, or update-photos).",
            );
        }
        if (!this.config.test_mode && dto.mock_outcome) {
            throw new BadRequestException("mock_outcome must be omitted when LegitGrails is configured with a Live API key.");
        }

        const answerTime = await this.resolveDefaultAnswerTime(dto.brand_code, dto.category_code, dto.answer_time);
        const orderPayload = {
            external_id: `bestkid-product-${product.id}-${Date.now()}`,
            category_code: dto.category_code,
            brand_code: dto.brand_code,
            ...(dto.model_code ? { model_code: dto.model_code } : {}),
            answer_time: answerTime,
            photos: dto.photos.map((photo) => ({ index_code: photo.index_code, url: photo.url })),
            ...(this.config.test_mode ? { mock_outcome: dto.mock_outcome } : {}),
        };

        await this.prismaService.product.update({
            where: { id: productId },
            data: { brand: dto.brand_code },
        });

        const localRequest = await this.prismaService.productAuthenticationRequest.create({
            data: {
                productId,
                provider: "LEGITGRAILS",
                status: "SUBMITTING",
                image_urls: dto.photos.map((photo) => photo.url),
                rawRequest: orderPayload,
            },
        });

        try {
            const response = await this.client.createOrder(orderPayload);
            const now = new Date();
            const mapped = mapLegitGrailsResult(response);

            const updatedRequest = await this.prismaService.productAuthenticationRequest.update({
                where: { id: localRequest.id },
                data: {
                    externalOrderId: mapped.externalOrderId,
                    status: mapped.providerStatus,
                    verdict: mapped.outcome,
                    certificateUrl: mapped.certificateUrl,
                    completedAt: mapped.isTerminal ? now : null,
                    submittedAt: now,
                    rawResponse: response,
                },
            });

            if (this.config.test_mode && mapped.hasVerdict) {
                await this.applyProductStatus(productId, mapped.productStatus, now);
            } else {
                await this.prismaService.product.update({
                    where: { id: productId },
                    data: { authentication_status: AuthenticationStatus.PENDING },
                });
            }

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

    async reuploadPhotos(productId: number, actorId: number, dto: ReuploadAuthenticationPhotosDto, isAdmin = false) {
        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: { id: true, userId: true },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${productId} not found`);
        }

        if (!isAdmin && product.userId !== actorId) {
            throw new ForbiddenException("You do not have permission to update this product's authentication request");
        }

        const activeRequest = await this.findActiveRequest(productId);
        if (!activeRequest || !activeRequest.externalOrderId) {
            throw new BadRequestException("This product has no active LegitGrails authentication request awaiting photos.");
        }

        this.assertValidPhotoResolutions(dto.photos);

        const updatePayload = {
            photos: dto.photos.map((photo) =>
                photo.is_unable_to_provide
                    ? { index_code: photo.index_code, is_unable_to_provide: true }
                    : { index_code: photo.index_code, url: photo.url },
            ),
            ...(dto.note ? { note: dto.note } : {}),
        };

        const response = await this.client.updatePhotos(activeRequest.externalOrderId, updatePayload);

        const newImageUrls = dto.photos.map((photo) => photo.url).filter((url): url is string => Boolean(url));

        return this.prismaService.productAuthenticationRequest.update({
            where: { id: activeRequest.id },
            data: {
                status: response?.status ?? "accepted",
                ...(newImageUrls.length ? { image_urls: { push: newImageUrls } } : {}),
                rawResponse: response,
            },
        });
    }

    async uploadPhotos(files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException("At least one photo is required");
        }

        // Validate file sizes (10 MiB max per file)
        const maxSizeBytes = 10 * 1024 * 1024;
        for (const file of files) {
            if (file.size > maxSizeBytes) {
                throw new BadRequestException(`File ${file.originalname} exceeds 10 MiB limit`);
            }
        }

        // Validate file formats
        const supportedMimes = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp", "image/avif"];
        for (const file of files) {
            if (!supportedMimes.includes(file.mimetype)) {
                throw new BadRequestException(`Unsupported image format: ${file.mimetype}`);
            }
        }

        return this.client.uploadPhotos(files);
    }

    listCategories(params: { brand_code?: string; locale?: string } = {}) {
        return this.client.listCategories(params);
    }

    listBrands(params: { category_code?: string; search?: string; locale?: string; page?: number; limit?: number } = {}) {
        return this.client.listBrands(params);
    }

    listModels(params: { brand_code: string; category_code: string; locale?: string; page?: number; limit?: number }) {
        return this.client.listModels(params);
    }

    listAnswerTimes(params: { brand_code: string; category_code: string; locale?: string }) {
        return this.client.listAnswerTimes(params);
    }

    listPhotoIndexes(params: { category_code: string; brand_code?: string; model_code?: string; locale?: string }) {
        return this.client.listPhotoIndexes(params);
    }

    listOrders(params: { page?: number; limit?: number } = {}) {
        return this.client.listOrders(params);
    }

    getBalance() {
        return this.client.getBalance();
    }

    createWebhook(payload: { name?: string; url: string; events: string[] }) {
        return this.client.createWebhook(payload);
    }

    listWebhooks() {
        return this.client.listWebhooks();
    }

    deleteWebhook(id: string) {
        return this.client.deleteWebhook(id);
    }

    async getProductAuthentication(productId: number, actorId: number, isAdmin = false) {
        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                userId: true,
                brand: true,
                status: true,
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

    async syncStatus(externalOrderId: string, locale?: string) {
        const request = await this.prismaService.productAuthenticationRequest.findFirst({
            where: { externalOrderId, provider: "LEGITGRAILS" },
        });

        if (!request) {
            throw new NotFoundException("LegitGrails authentication request not found");
        }

        const response = await this.client.getOrder(externalOrderId, { locale });
        return this.applyProviderResult(request.id, request.productId, response);
    }

    async handleWebhook(payload: any) {
        const mapped = mapLegitGrailsResult(payload);
        if (!mapped.externalOrderId) {
            throw new BadRequestException("LegitGrails webhook payload is missing an order ID.");
        }

        const request = await this.prismaService.productAuthenticationRequest.findFirst({
            where: { externalOrderId: mapped.externalOrderId, provider: "LEGITGRAILS" },
        });

        if (!request) {
            throw new NotFoundException("LegitGrails authentication request not found");
        }

        const previousDeliveryId = (request.rawResponse as Record<string, any> | null)?.delivery_id;
        if (mapped.deliveryId && mapped.deliveryId === previousDeliveryId) {
            return request;
        }

        return this.applyProviderResult(request.id, request.productId, payload);
    }

    verifyWebhookSignature(
        rawBody: Buffer | undefined,
        signature: string | undefined,
        timestamp: string | undefined,
        secret: string | undefined,
    ) {
        if (!secret) {
            return;
        }
        if (!rawBody || !signature || !timestamp) {
            throw new ForbiddenException("LegitGrails webhook signature or timestamp is missing.");
        }

        const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
        if (!Number.isFinite(skewSeconds) || skewSeconds > this.config.webhook_max_clock_skew_seconds) {
            throw new ForbiddenException("LegitGrails webhook timestamp is outside the allowed window.");
        }

        const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
        const normalizedSignature = signature.replace(/^v1=/, "");
        const expected = Buffer.from(digest, "hex");
        const received = Buffer.from(normalizedSignature, "hex");

        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
            throw new ForbiddenException("LegitGrails webhook signature is invalid.");
        }
    }

    private assertValidPhotoResolutions(photos: ReuploadPhotoDto[]) {
        for (const photo of photos) {
            if (photo.is_unable_to_provide && photo.url) {
                throw new BadRequestException(`Photo for index "${photo.index_code}" must not include both a url and is_unable_to_provide.`);
            }
            if (!photo.is_unable_to_provide && !photo.url) {
                throw new BadRequestException(`Photo for index "${photo.index_code}" must include either a url or is_unable_to_provide.`);
            }
        }

        const byIndex = new Map<string, ReuploadPhotoDto[]>();
        for (const photo of photos) {
            byIndex.set(photo.index_code, [...(byIndex.get(photo.index_code) ?? []), photo]);
        }
        for (const [index_code, entries] of byIndex) {
            if (entries.length > 1 && entries.some((entry) => entry.is_unable_to_provide)) {
                throw new BadRequestException(`Photo for index "${index_code}" cannot mix is_unable_to_provide with other entries.`);
            }
        }
    }

    private async findActiveRequest(productId: number) {
        return this.prismaService.productAuthenticationRequest.findFirst({
            where: {
                productId,
                provider: "LEGITGRAILS",
                status: { notIn: ACTIVE_REQUEST_STATUSES_EXCLUDED },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    private async resolveDefaultAnswerTime(brandCode: string, categoryCode: string, requestedAnswerTime?: number): Promise<number> {
        const response = await this.client.listAnswerTimes({
            brand_code: brandCode,
            category_code: categoryCode,
        });

        const answerTimes = Array.isArray(response?.data) ? response.data : [];
        const defaultOption = answerTimes.find((entry: any) => entry?.default === true && entry?.available !== false);
        if (defaultOption && defaultOption.code !== undefined && defaultOption.code !== null) {
            return Number(defaultOption.code);
        }

        if (requestedAnswerTime !== undefined) {
            const requestedOption = answerTimes.find(
                (entry: any) => Number(entry?.code) === Number(requestedAnswerTime) && entry?.available !== false,
            );
            if (requestedOption && requestedOption.code !== undefined && requestedOption.code !== null) {
                return Number(requestedOption.code);
            }
        }

        const firstAvailable = answerTimes.find((entry: any) => entry?.available !== false);
        if (firstAvailable && firstAvailable.code !== undefined && firstAvailable.code !== null) {
            return Number(firstAvailable.code);
        }

        throw new BadRequestException(
            `No available LegitGrails answer times were returned for brand "${brandCode}" and category "${categoryCode}".`,
        );
    }

    private async applyProviderResult(requestId: number, productId: number, payload: any) {
        const mapped = mapLegitGrailsResult(payload);
        const now = new Date();
        const updatedRequest = await this.prismaService.productAuthenticationRequest.update({
            where: { id: requestId },
            data: {
                externalOrderId: mapped.externalOrderId,
                status: mapped.providerStatus,
                verdict: mapped.outcome,
                certificateUrl: mapped.certificateUrl,
                completedAt: mapped.isTerminal ? now : null,
                rawResponse: payload,
            },
        });

        if (mapped.hasVerdict) {
            await this.applyProductStatus(productId, mapped.productStatus, now);
        }

        return updatedRequest;
    }

    private async notifyAuthenticationStatus(productId: number, status: AuthenticationStatus) {
        const product = await this.prismaService.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                name: true,
                userId: true,
            },
        });

        if (!product) {
            return;
        }

        try {
            const message =
                status === AuthenticationStatus.VERIFIED
                    ? "Your product has been verified and is ready to sell."
                    : status === AuthenticationStatus.NOT_VERIFIED
                      ? "Your product was not verified. Please review the submission and update the listing."
                      : "Your product authentication status changed.";

            await this.notificationService.create(
                product.userId,
                "Product authentication update",
                `Product "${product.name}" is now ${status.toLowerCase()}. ${message}`,
                NotificationType.AUTHENTICATION,
            );
        } catch (error) {
            console.error("Failed to send auth notification", error);
        }
    }

    private async applyProductStatus(productId: number, status: AuthenticationStatus, completedAt?: Date) {
        const product = await this.prismaService.product.update({
            where: { id: productId },
            data: {
                authentication_status: status,
                is_authenticated: status === AuthenticationStatus.VERIFIED,
                approved_at: status === AuthenticationStatus.VERIFIED ? (completedAt ?? new Date()) : undefined,
                rejected_at: status === AuthenticationStatus.NOT_VERIFIED ? (completedAt ?? new Date()) : undefined,
            },
        });

        if (status === AuthenticationStatus.VERIFIED) {
            const readiness = await this.productService.getSellerProductReadiness(product.userId);
            if (readiness.can_publish_product) {
                await this.prismaService.product.updateMany({
                    where: { id: productId, status: { not: ProductStatus.SOLD } },
                    data: { status: ProductStatus.ACTIVE },
                });
            }
        } else if (status === AuthenticationStatus.NOT_VERIFIED) {
            await this.prismaService.product.updateMany({
                where: { id: productId, status: ProductStatus.ACTIVE },
                data: { status: ProductStatus.INACTIVE },
            });
        }

        await this.notifyAuthenticationStatus(productId, status);
    }
}
