import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import legitgrailsConfig, { LegitGrailsConfig } from "src/config/legitgrails.config";

@Injectable()
export class LegitGrailsClient {
    constructor(
        @Inject(legitgrailsConfig.KEY)
        private readonly config: ConfigType<typeof LegitGrailsConfig>,
    ) {}

    async submitAuthentication(payload: Record<string, any>) {
        return this.request(this.config.submit_path, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async getAuthenticationStatus(externalOrderId: string) {
        const path = this.config.status_path.replace(":id", encodeURIComponent(externalOrderId));
        return this.request(path, { method: "GET" });
    }

    private async request(path: string, init: RequestInit) {
        if (!this.config.enabled) {
            throw new ServiceUnavailableException("LegitGrails integration is disabled. Set LEGITGRAILS_ENABLED=true to submit products.");
        }
        if (!this.config.api_url || !this.config.api_key) {
            throw new ServiceUnavailableException("LegitGrails API URL or API key is not configured.");
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms);
        const url = new URL(path, this.config.api_url).toString();

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${this.config.api_key}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...(init.headers ?? {}),
                },
            });
            const text = await response.text();
            const data = text ? JSON.parse(text) : {};

            if (!response.ok) {
                throw new BadGatewayException(data?.message ?? `LegitGrails request failed with status ${response.status}.`);
            }

            return data;
        } catch (error) {
            if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) {
                throw error;
            }
            throw new BadGatewayException(`LegitGrails request failed: ${(error as Error).message}`);
        } finally {
            clearTimeout(timeout);
        }
    }
}
