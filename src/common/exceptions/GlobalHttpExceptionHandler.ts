import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GlobalHttpExceptionHandler implements ExceptionFilter{

    catch(exception: any, host: ArgumentsHost) {

        // if(exception instanceof HttpException) return

        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()

        const prismaError = this.getPrismaErrorResponse(exception, request);
        const status = prismaError
            ? prismaError.status
            : exception instanceof HttpException
              ? exception.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR
        const url = request.url

        const exceptionResponse = prismaError
            ? { message: prismaError.message }
            : exception instanceof HttpException
            ? exception.getResponse()
            : { message: "Internal server error!" }
        const message = typeof exceptionResponse === "string"
            ? exceptionResponse
            : exceptionResponse["message"] ?? "Internal server error!"
        
        response.status(status)
        .json(
            {
                success: false,
                message,
                url,
                statusCode:status
            }
        )
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
            { field: "variantId", entity: "Product variant", aliases: ["variantId", "variant_id", "variant", "productVariantId"] },
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
