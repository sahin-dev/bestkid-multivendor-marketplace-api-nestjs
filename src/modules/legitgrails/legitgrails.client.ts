import {
    BadGatewayException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    NotFoundException,
    PayloadTooLargeException,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import legitgrailsConfig, { LegitGrailsConfig } from "src/config/legitgrails.config";

@Injectable()
export class LegitGrailsClient {
    constructor(
        @Inject(legitgrailsConfig.KEY)
        private readonly config: ConfigType<typeof LegitGrailsConfig>,
    ) {}

    listCategories(params: { brand_code?: string; locale?: string } = {}) {
        return this.getJson("/catalog/categories", params);
    }

    listBrands(params: { category_code?: string; search?: string; locale?: string; page?: number; limit?: number } = {}) {
        return this.getJson("/catalog/brands", params);
    }

    listModels(params: { brand_code: string; category_code: string; locale?: string; page?: number; limit?: number }) {
        return this.getJson("/catalog/models", params);
    }

    listAnswerTimes(params: { brand_code: string; category_code: string; locale?: string }) {
        return this.getJson("/catalog/answer_times", params);
    }

    listPhotoIndexes(params: { category_code: string; brand_code?: string; model_code?: string; locale?: string }) {
        return this.getJson("/catalog/photo_indexes", params);
    }

    async uploadPhotos(files: Express.Multer.File[]): Promise<any> {
        const formData = new FormData();
        for (const file of files) {
            // Convert Buffer to Uint8Array for Blob compatibility
            const uint8Array = new Uint8Array(file.buffer);
            const blob = new Blob([uint8Array], { type: file.mimetype });
            formData.append("photos", blob, file.originalname);
        }
        return this.requestFormData("/photos", { method: "POST", body: formData });
    }

    createOrder(payload: Record<string, any>) {
        return this.request("/orders", { method: "POST", body: JSON.stringify(payload) });
    }

    getOrder(id: string, params: { locale?: string } = {}) {
        return this.getJson(`/orders/${encodeURIComponent(id)}`, params);
    }

    listOrders(params: { page?: number; limit?: number } = {}) {
        return this.getJson("/orders", params);
    }

    getBalance() {
        return this.getJson("/balance", {});
    }

    updatePhotos(id: string, payload: Record<string, any>) {
        return this.request(`/orders/${encodeURIComponent(id)}/update_photos`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    createWebhook(payload: Record<string, any>) {
        return this.request("/webhooks", { method: "POST", body: JSON.stringify(payload) });
    }

    listWebhooks() {
        return this.getJson("/webhooks", {});
    }

    deleteWebhook(id: string) {
        return this.request(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
    }

    private getJson(path: string, params: Record<string, any>) {
        const query = this.toQuery(params);
        return this.request(query ? `${path}?${query}` : path, { method: "GET" });
    }

    private toQuery(params: Record<string, any>) {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                search.set(key, String(value));
            }
        }
        return search.toString();
    }

    private assertConfigured() {
        if (!this.config.enabled) {
            throw new ServiceUnavailableException("LegitGrails integration is disabled. Set LEGITGRAILS_ENABLED=true to use it.");
        }
        if (!this.config.base_url || !this.config.api_key) {
            throw new ServiceUnavailableException("LegitGrails base URL or API key is not configured.");
        }
    }

    private async request(path: string, init: RequestInit): Promise<any> {
        this.assertConfigured();

        const base = this.config.base_url.endsWith("/") ? this.config.base_url : `${this.config.base_url}/`;
        const url = new URL(path.replace(/^\//, ""), base).toString();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.config.api_key}`,
                    ...(init.headers ?? {}),
                },
            });
            const text = await response.text();
            const data = text ? JSON.parse(text) : undefined;

            if (!response.ok) {
                console.log(`LegitGrails request failed with status ${response.status}:`, data);
                throw this.toHttpException(response, data);
            }

            return data;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            if ((error as Error)?.name === "AbortError") {
                throw new ServiceUnavailableException("LegitGrails request timed out.");
            }
            throw new BadGatewayException(`LegitGrails request failed: ${(error as Error).message}`);
        } finally {
            clearTimeout(timeout);
        }
    }

    private async requestFormData(path: string, init: RequestInit): Promise<any> {
        this.assertConfigured();

        const base = this.config.base_url.endsWith("/") ? this.config.base_url : `${this.config.base_url}/`;
        const url = new URL(path.replace(/^\//, ""), base).toString();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${this.config.api_key}`,
                    ...(init.headers ?? {}),
                },
            });
            const text = await response.text();
            const data = text ? JSON.parse(text) : undefined;

            if (!response.ok) {
                throw this.toHttpException(response, data);
            }

            return data;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            if ((error as Error)?.name === "AbortError") {
                throw new ServiceUnavailableException("LegitGrails request timed out.");
            }
            throw new BadGatewayException(`LegitGrails request failed: ${(error as Error).message}`);
        } finally {
            clearTimeout(timeout);
        }
    }

    private toHttpException(response: Response, data: any) {
        const code = data?.code ?? "unknown-error";
        const requestId = data?.request_id ?? response.headers.get("x-request-id") ?? undefined;
        const message = data?.message ?? `LegitGrails request failed with status ${response.status}.`;
        const body = { message, code, request_id: requestId, details: data?.details };

        switch (response.status) {
            case 400:
                return new BadRequestException(body);
            case 401:
                return new UnauthorizedException(body);
            case 402:
                return new HttpException(body, HttpStatus.PAYMENT_REQUIRED);
            case 403:
                return new ForbiddenException(body);
            case 404:
                return new NotFoundException(body);
            case 409:
                return new ConflictException(body);
            case 413:
                return new PayloadTooLargeException(body);
            case 429: {
                const retryAfter = response.headers.get("retry-after");
                return new HttpException({ ...body, retry_after: retryAfter ? Number(retryAfter) : undefined }, HttpStatus.TOO_MANY_REQUESTS);
            }
            default:
                return new BadGatewayException(body);
        }
    }
}
