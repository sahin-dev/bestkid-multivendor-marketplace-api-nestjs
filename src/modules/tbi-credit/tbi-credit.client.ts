import {
    BadGatewayException,
    BadRequestException,
    Inject,
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { createCipheriv, createHash } from "crypto";
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
        const algorithm = this.config.encryption_algorithm;
        const cipher = createCipheriv(algorithm, this.deriveKey(), this.deriveIv());
        return Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]).toString("base64");
    }

    private deriveKey() {
        const key = this.config.encryption_key ?? "";
        if (this.config.encryption_key_mode === "raw_hex" && /^[a-f0-9]+$/i.test(key) && key.length >= 64) {
            return Buffer.from(key, "hex").subarray(0, 32);
        }
        if (this.config.encryption_key_mode === "raw_utf8") {
            return Buffer.from(key.padEnd(32, "0")).subarray(0, 32);
        }
        return createHash("sha256").update(key).digest();
    }

    private deriveIv() {
        const configuredIv = this.config.encryption_iv?.trim();
        if (configuredIv) {
            if (/^[a-f0-9]+$/i.test(configuredIv) && configuredIv.length >= 32) {
                return Buffer.from(configuredIv, "hex").subarray(0, 16);
            }
            return Buffer.from(configuredIv.padEnd(16, "0")).subarray(0, 16);
        }
        return createHash("sha256").update(this.config.encryption_key ?? "").digest().subarray(0, 16);
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
            const data = text ? JSON.parse(text) : undefined;

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
