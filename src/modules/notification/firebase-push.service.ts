import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getMessaging, Message, MulticastMessage } from "firebase-admin/messaging";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export type FirebaseMulticastResult = {
    successCount: number;
    failureCount: number;
    responses: Array<{ success: boolean; messageId?: string; error?: { code?: string; message?: string } }>;
};

@Injectable()
export class FirebasePushService {
    private readonly logger = new Logger(FirebasePushService.name);
    private initialized = false;

    constructor(private readonly configService: ConfigService) {
        this.initialize();
    }

    private initialize() {
        if (this.initialized) {
            return;
        }

        const serviceAccountJson = this.configService.get<string>("firebase.serviceAccountJson");
        const serviceAccountPath = this.configService.get<string>("firebase.serviceAccountPath");

        if (!serviceAccountJson && !serviceAccountPath) {
            this.logger.warn(
                "Firebase Admin SDK is not configured. Skipping push delivery until FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH is available.",
            );
            return;
        }

        try {
            let credential;

            if (serviceAccountPath) {
                const resolvedPath = isAbsolute(serviceAccountPath) ? serviceAccountPath : resolve(process.cwd(), serviceAccountPath);
                const parsed = JSON.parse(readFileSync(resolvedPath, "utf8"));
                credential = cert(parsed);
            } else if (serviceAccountJson) {
                const normalizedJson = serviceAccountJson.trim();
                const unwrappedJson = normalizedJson.startsWith('"') && normalizedJson.endsWith('"')
                    ? JSON.parse(normalizedJson)
                    : normalizedJson;
                credential = cert(JSON.parse(unwrappedJson));
            } else {
                credential = applicationDefault();
            }

            if (getApps().length === 0) {
                initializeApp({ credential });
            }

            this.initialized = true;
            this.logger.log("Firebase Admin SDK initialized successfully.");
        } catch (error) {
            this.logger.error(
                "Firebase Admin SDK configuration is invalid or unreadable. Push delivery is disabled until the service account JSON/path is fixed.",
                error instanceof Error ? error.stack : error,
            );
        }
    }

    async sendMulticast(
        deviceTokens: string[],
        title: string,
        body: string,
        data: Record<string, string> = {},
    ): Promise<FirebaseMulticastResult> {
        const validTokens = deviceTokens.filter((token) => typeof token === "string" && token.trim().length > 0);

        if (!this.initialized || validTokens.length === 0) {
            return {
                successCount: 0,
                failureCount: validTokens.length,
                responses: validTokens.map(() => ({ success: false, error: { code: "firebase/not-configured", message: "Firebase push disabled" } })),
            };
        }

        const message: MulticastMessage = {
            tokens: validTokens,
            notification: {
                title,
                body,
            },
            data: {
                ...data,
                title,
                body,
            },
            android: {
                priority: "high",
                notification: {
                    channelId: "bestkid_notifications",
                    sound: "default",
                },
            },
            apns: {
                headers: {
                    "apns-priority": "10",
                },
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                        contentAvailable: true,
                    },
                },
            },
        };

        const response = await getMessaging().sendEachForMulticast(message);

        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses.map((item) => ({
                success: item.success,
                messageId: item.messageId,
                error: item.error
                    ? {
                          code: item.error.code,
                          message: item.error.message,
                      }
                    : undefined,
            })),
        };
    }

    async sendToToken(
        token: string,
        title: string,
        body: string,
        data: Record<string, string> = {},
    ): Promise<{ success: boolean; messageId?: string; error?: { code?: string; message?: string } }> {
        if (!this.initialized || !token) {
            return {
                success: false,
                error: { code: "firebase/not-configured", message: "Firebase push disabled" },
            };
        }

        try {
            const message: Message = {
                token,
                notification: { title, body },
                data: {
                    ...data,
                    title,
                    body,
                },
                android: {
                    priority: "high",
                    notification: {
                        channelId: "bestkid_notifications",
                        sound: "default",
                    },
                },
                apns: {
                    headers: {
                        "apns-priority": "10",
                    },
                    payload: {
                        aps: {
                            sound: "default",
                            badge: 1,
                            contentAvailable: true,
                        },
                    },
                },
            };

            const messageId = await getMessaging().send(message);
            return { success: true, messageId };
        } catch (error: any) {
            return {
                success: false,
                error: {
                    code: error?.code,
                    message: error?.message,
                },
            };
        }
    }
}
