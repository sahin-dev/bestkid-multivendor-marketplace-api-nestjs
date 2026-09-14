import {
    BadGatewayException,
    BadRequestException,
    Inject,
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { createCipheriv, createHash, randomBytes } from "crypto";
import tbiCreditConfig, { TbiCreditConfig } from "src/config/tbi-credit.config";

type TbiRequestBody = Record<string, unknown>;

@Injectable()
export class TbiCreditClient {
    constructor(
        @Inject(tbiCreditConfig.KEY)
        private readonly config: ConfigType<typeof TbiCreditConfig>,
    ) {}

    get country() {
        return this.config.country;
    }

    get currency() {
        return this.config.currency;
    }

    async getCalculations(params: { amount?: number; categoryId?: number }) {
        return this.postJson("/api/GetCalculations", {
            reseller_code: this.config.reseller_code,
            reseller_key: this.config.reseller_key,
            ...(params.amount !== undefined ? { amount: params.amount } : {}),
            ...(params.categoryId !== undefined ? { category_id: params.categoryId } : {}),
        });
    }

    async registerApplication(applicationData: Record<string, unknown>) {
        this.assertConfigured();
        if (!this.config.encryption_key) {
            throw new ServiceUnavailableException("TBI encryption key is not configured.");
        }

        const data = this.encrypt(JSON.stringify(applicationData));
        return this.postJson("/api/RegisterApplication", {
            reseller_code: this.config.reseller_code,
            reseller_key: this.config.reseller_key,
            data,
        });
    }

    async getApplicationStatus(orderId: string | number, token: string) {
        return this.postJson("/api/GetApplicationStatus", {
            reseller_code: this.config.reseller_code,
            reseller_key: this.config.reseller_key,
            order_id: orderId,
            token,
        });
    }

    private assertConfigured() {
        if (!this.config.enabled) {
            throw new ServiceUnavailableException("TBI Credit is disabled. Set TBI_ENABLED=true to use it.");
        }
        if (!this.config.base_url || !this.config.reseller_code || !this.config.reseller_key) {
            throw new ServiceUnavailableException("TBI base URL, reseller code, or reseller key is not configured.");
        }
    }

    private encrypt(plainText: string) {
        const key = createHash("sha256")
            .update(this.config.encryption_key ?? "")
            .digest();
        const iv = randomBytes(16);
        const cipher = createCipheriv("aes-256-ctr", key, iv);
        const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);

        return Buffer.concat([iv, encrypted]).toString("base64");
    }

    private async postJson(path: string, body: TbiRequestBody) {
        this.assertConfigured();

        const base = this.config.base_url.endsWith("/") ? this.config.base_url : `${this.config.base_url}/`;
        const url = new URL(path.replace(/^\//, ""), base).toString();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);

        try {
            const response = await fetch(url, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            const text = await response.text();
            const data = this.parseJsonResponse(text);

            if (!response.ok || this.isTbiError(data)) {
                throw this.toHttpException(response, data);
            }

            return data;
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
                throw error;
            }
            if ((error as Error)?.name === "AbortError") {
                throw new ServiceUnavailableException("TBI Credit request timed out.");
            }
            throw new BadGatewayException(`TBI Credit request failed: ${(error as Error).message}`);
        } finally {
            clearTimeout(timeout);
        }
    }

    private parseJsonResponse(text: string) {
        if (!text) {
            return undefined;
        }

        try {
            return JSON.parse(text);
        } catch {
            throw new BadGatewayException({
                message: "TBI Credit returned an invalid JSON response.",
                details: text.slice(0, 500),
            });
        }
    }

    private isTbiError(data: any) {
        if (!data || Array.isArray(data)) {
            return false;
        }
        const error = Number(data.error);
        return Number.isFinite(error) && error !== 0;
    }

    private toHttpException(response: Response, data: any) {
        const message = data?.message ?? `TBI Credit request failed with status ${response.status}.`;
        const error = data?.error ?? response.status;
        const body = { message, code: error, details: data };

        if (response.status === 401 || error === 401 || error === 205) {
            return new UnauthorizedException(body);
        }
        if (response.status >= 500) {
            return new BadGatewayException(body);
        }
        return new BadRequestException(body);
    }
}
