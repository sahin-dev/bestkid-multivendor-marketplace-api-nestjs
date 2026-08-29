import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { Request, Response } from "express";

@Catch()
export class GlobalHttpExceptionHandler implements ExceptionFilter{
    private readonly logger = new Logger(GlobalHttpExceptionHandler.name);

    catch(exception: any, host: ArgumentsHost) {

        // if(exception instanceof HttpException) return

        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()

        const prismaError = this.getPrismaErrorResponse(exception, request);
        const externalError = this.getExternalErrorResponse(exception);
        const applicationError = this.getApplicationErrorResponse(exception);
        const status = prismaError
            ? prismaError.status
            : externalError
            ? externalError.status
            : applicationError
            ? applicationError.status
            : exception instanceof HttpException
              ? exception.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR
        const url = request.url

        const exceptionResponse = prismaError
            ? { message: prismaError.message }
            : externalError
            ? { message: externalError.message }
            : applicationError
            ? { message: applicationError.message }
            : exception instanceof HttpException
            ? exception.getResponse()
            : { message: "Unexpected server error. Please try again later." }
        const message = typeof exceptionResponse === "string"
            ? exceptionResponse
            : exceptionResponse["message"] ?? "Unexpected server error. Please try again later."

        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                `${request.method} ${url} failed: ${Array.isArray(message) ? message.join(", ") : message}`,
                exception?.stack ?? exception,
            );
        }

        const errorId = this.captureException(exception, request, status, message);
        const errorResponse = {
            success: false,
            message,
            url,
            statusCode: status,
            ...(errorId ? { errorId } : {}),
        };
        
        response.status(status)
        .json(errorResponse)
    }

    private getPrismaErrorResponse(exception: any, request: Request): { status: number; message: string } | null {
        if (!exception?.code || !exception?.clientVersion) {
            return null;
        }

        if (exception.code === "P2003") {
            return {
                status: HttpStatus.NOT_FOUND,
                message: this.getForeignKeyMessage(exception, request),
            };
        }

        if (exception.code === "P2025") {
            return {
                status: HttpStatus.NOT_FOUND,
                message: "Requested record not found",
            };
        }

        if (exception.code === "P2002") {
            return {
                status: HttpStatus.CONFLICT,
                message: "A record with the same unique value already exists",
            };
        }

        return null;
    }

    private getExternalErrorResponse(exception: any): { status: number; message: string } | null {
        if (this.isStripeError(exception)) {
            const stripeStatus = typeof exception.statusCode === "number" ? exception.statusCode : undefined;
            const status = stripeStatus && stripeStatus >= 400 && stripeStatus < 500
                ? HttpStatus.BAD_REQUEST
                : HttpStatus.BAD_GATEWAY;
            const param = exception.param ? ` (${exception.param})` : "";
            return {
                status,
                message: `Stripe request failed${param}: ${exception.message ?? "Please check your Stripe configuration and request data."}`,
            };
        }

        if (exception?.name === "MulterError") {
            return {
                status: HttpStatus.BAD_REQUEST,
                message: `File upload failed: ${exception.message ?? "Invalid upload request."}`,
            };
        }

        if (exception instanceof SyntaxError && "body" in exception) {
            return {
                status: HttpStatus.BAD_REQUEST,
                message: "Invalid JSON request body.",
            };
        }

        return null;
    }

    private getApplicationErrorResponse(exception: any): { status: number; message: string } | null {
        if (exception instanceof HttpException) {
            return null;
        }

        if (exception?.name === "PrismaClientValidationError") {
            return {
                status: HttpStatus.BAD_REQUEST,
                message: "Invalid database query. Please check the submitted fields and required IDs.",
            };
        }

        if (exception?.name === "PrismaClientInitializationError") {
            return {
                status: HttpStatus.SERVICE_UNAVAILABLE,
                message: "Database connection failed. Please try again later.",
            };
        }

        if (exception?.name === "PrismaClientUnknownRequestError") {
            return {
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                message: "Database request failed. Please try again later.",
            };
        }

        if (exception instanceof Error && exception.message) {
            return {
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                message: this.getSafeErrorMessage(exception.message),
            };
        }

        return null;
    }

    private isStripeError(exception: any) {
        const type = String(exception?.type ?? exception?.raw?.type ?? "");
        return type.startsWith("Stripe") || Boolean(exception?.raw?.requestId && exception?.raw?.type);
    }

    private getSafeErrorMessage(message: string) {
        const trimmed = message.trim();
        if (!trimmed) {
            return "Unexpected server error. Please try again later.";
        }

        const sensitivePatterns = [/password/i, /secret/i, /token/i, /api[_ -]?key/i, /authorization/i, /database_url/i];
        if (sensitivePatterns.some((pattern) => pattern.test(trimmed))) {
            return "Server configuration error. Please contact support.";
        }

        return trimmed;
    }

    private captureException(exception: any, request: Request, status: number, message: string | string[]) {
        if (!this.shouldReportToSentry(exception, status)) {
            return null;
        }

        return Sentry.withScope((scope) => {
            const payload = (request as any).payload;
            const user = (request as any).user;

            scope.setTag("http.method", request.method);
            scope.setTag("http.status_code", String(status));
            scope.setTag("request.url", request.originalUrl ?? request.url);
            scope.setTag("error.source", this.getErrorSource(exception));

            if (payload?.id || user?.id) {
                scope.setUser({
                    id: String(payload?.id ?? user?.id),
                    email: payload?.email ?? user?.email,
                });
            }

            scope.setContext("request", {
                method: request.method,
                url: request.originalUrl ?? request.url,
                params: request.params,
                query: request.query,
                body: this.sanitizeObject(request.body),
                userAgent: request.headers?.["user-agent"],
            });

            scope.setContext("response", {
                statusCode: status,
                clientMessage: message,
            });

            return Sentry.captureException(exception);
        });
    }

    private shouldReportToSentry(exception: any, status: number) {
        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            return true;
        }

        return this.isStripeError(exception);
    }

    private getErrorSource(exception: any) {
        if (this.isStripeError(exception)) {
            return "stripe";
        }

        if (exception?.code && exception?.clientVersion) {
            return "prisma";
        }

        if (exception?.name === "MulterError") {
            return "upload";
        }

        if (exception instanceof HttpException) {
            return "http";
        }

        return "application";
    }

    private sanitizeObject(value: unknown): unknown {
        if (!value || typeof value !== "object") {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.sanitizeObject(item));
        }

        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, child]) => {
                if (this.isSensitiveKey(key)) {
                    return [key, "[Filtered]"];
                }

                return [key, this.sanitizeObject(child)];
            }),
        );
    }

    private isSensitiveKey(key: string) {
        return /password|token|secret|authorization|cookie|api[_-]?key|stripe|webhook/i.test(key);
    }

    private getForeignKeyMessage(exception: any, request: Request) {
        const reference = this.findReferenceFromPrismaError(exception);
        if (reference) {
            return `${reference.entity} referenced by ${reference.field} was not found`;
        }

        const submittedReferences = this.findSubmittedReferenceIds(request);
        if (submittedReferences.length === 1) {
            const item = submittedReferences[0];
            return `${item.entity} with ID ${item.id} not found`;
        }

        if (submittedReferences.length > 1) {
            return `Referenced entity was not found. Please check: ${submittedReferences
                .map((item) => `${item.entity} with ID ${item.id}`)
                .join(", ")}`;
        }

        return "Referenced entity was not found. Please check the submitted IDs.";
    }

    private findReferenceFromPrismaError(exception: any) {
        const meta = exception.meta ?? {};
        const searchable = [
            meta.field_name,
            meta.constraint,
            Array.isArray(meta.target) ? meta.target.join(" ") : meta.target,
            meta.modelName,
            exception.message,
        ]
            .filter(Boolean)
            .join(" ");

        return this.findReferenceByText(searchable);
    }

    private findSubmittedReferenceIds(request: Request) {
        const refs: { field: string; entity: string; id: number | string }[] = [];
        const seen = new Set<string>();
        const source = { ...(request.params ?? {}), ...(request.body ?? {}) };

        for (const [key, value] of this.flattenObject(source)) {
            const reference = this.findReferenceByField(key);
            if (!reference || value === undefined || value === null || value === "") {
                continue;
            }

            const dedupeKey = `${reference.field}:${value}`;
            if (seen.has(dedupeKey)) {
                continue;
            }
            seen.add(dedupeKey);
            refs.push({ ...reference, id: value as number | string });
        }

        return refs;
    }

    private flattenObject(value: unknown, prefix = ""): [string, unknown][] {
        if (!value || typeof value !== "object") {
            return [];
        }

        const entries: [string, unknown][] = [];
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (Array.isArray(child)) {
                child.forEach((item, index) => entries.push(...this.flattenObject(item, `${path}.${index}`)));
            } else if (child && typeof child === "object" && !(child instanceof Date)) {
                entries.push(...this.flattenObject(child, path));
            } else {
                entries.push([key, child]);
            }
        }

        return entries;
    }

    private findReferenceByText(value: unknown) {
        const normalized = this.normalizeReferenceText(value);
        return this.getReferenceFields().find(({ aliases }) =>
            aliases.some((alias) => normalized.includes(this.normalizeReferenceText(alias))),
        );
    }

    private findReferenceByField(field: string) {
        const normalized = this.normalizeReferenceText(field);
        return this.getReferenceFields().find(({ aliases }) =>
            aliases.some((alias) => normalized === this.normalizeReferenceText(alias)),
        );
    }

    private normalizeReferenceText(value: unknown) {
        return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    private getReferenceFields() {
        return [
            { field: "subCategoryId", entity: "Sub-category", aliases: ["subCategoryId", "sub_category_id", "subCategory"] },
            { field: "orderItemId", entity: "Order item", aliases: ["orderItemId", "order_item_id", "orderItem"] },
            { field: "chatRoomId", entity: "Chat room", aliases: ["chatRoomId", "chat_room_id", "chatRoom"] },
            { field: "categoryId", entity: "Category", aliases: ["categoryId", "category_id", "category"] },
            { field: "productId", entity: "Product", aliases: ["productId", "product_id", "product"] },
            { field: "sellerId", entity: "Seller", aliases: ["sellerId", "seller_id", "seller"] },
            { field: "buyerId", entity: "Buyer", aliases: ["buyerId", "buyer_id", "buyer"] },
            { field: "senderId", entity: "Sender", aliases: ["senderId", "sender_id", "sender"] },
            { field: "profile_id", entity: "Profile", aliases: ["profile_id", "profileId", "profile"] },
            { field: "userId", entity: "User", aliases: ["userId", "user_id", "user"] },
            { field: "cartId", entity: "Cart", aliases: ["cartId", "cart_id", "cart"] },
            { field: "orderId", entity: "Order", aliases: ["orderId", "order_id", "order"] },
        ];
    }

}
