import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseInterceptors, UploadedFiles, Delete } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiConsumes } from "@nestjs/swagger";
import type { Request } from "express";
import { GetUser, Public, Roles } from "src/common/decorators";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { SubmitProductAuthenticationDto } from "./dtos/submit-product-authentication.dto";
import { ReuploadAuthenticationPhotosDto } from "./dtos/reupload-authentication-photos.dto";
import { CreateWebhookDto, CreateWebhookResponseDto, WebhookEndpointDto } from "./dtos/webhook.dto";
import { LegitGrailsService } from "./legitgrails.service";

@ApiTags("LegitGrails")
@Controller()
export class LegitGrailsController {
    constructor(
        private readonly legitGrailsService: LegitGrailsService,
        private readonly configService: ConfigService,
    ) {}

    @Get("legitgrails/categories")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "List LegitGrails categories available for authentication" })
    @ApiQuery({ name: "brand_code", required: false, type: String })
    @ApiQuery({ name: "locale", required: false, type: String, enum: ["en", "ja"] })
    async listCategories(@Query("brand_code") brand_code?: string, @Query("locale") locale?: string) {
        return this.legitGrailsService.listCategories({ brand_code, locale });
    }

    @Get("legitgrails/brands")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "List LegitGrails brands available for authentication" })
    @ApiQuery({ name: "category_code", required: false, type: String })
    @ApiQuery({ name: "search", required: false, type: String })
    @ApiQuery({ name: "locale", required: false, type: String, enum: ["en", "ja"] })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async listBrands(
        @Query("category_code") category_code?: string,
        @Query("search") search?: string,
        @Query("locale") locale?: string,
        @Query("page") page?: string,
        @Query("limit") limit?: string,
    ) {
        return this.legitGrailsService.listBrands({
            category_code,
            search,
            locale,
            page: page !== undefined ? Number(page) : undefined,
            limit: limit !== undefined ? Number(limit) : undefined,
        });
    }

    @Get("legitgrails/models")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "List LegitGrails models for a brand/category pair" })
    @ApiQuery({ name: "brand_code", required: true, type: String })
    @ApiQuery({ name: "category_code", required: true, type: String })
    @ApiQuery({ name: "locale", required: false, type: String, enum: ["en", "ja"] })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async listModels(
        @Query("brand_code") brand_code: string,
        @Query("category_code") category_code: string,
        @Query("locale") locale?: string,
        @Query("page") page?: string,
        @Query("limit") limit?: string,
    ) {
        return this.legitGrailsService.listModels({
            brand_code,
            category_code,
            locale,
            page: page !== undefined ? Number(page) : undefined,
            limit: limit !== undefined ? Number(limit) : undefined,
        });
    }

    @Get("legitgrails/answer-times")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "List available LegitGrails turnaround times for a brand/category pair" })
    @ApiQuery({ name: "brand_code", required: true, type: String })
    @ApiQuery({ name: "category_code", required: true, type: String })
    @ApiQuery({ name: "locale", required: false, type: String, enum: ["en", "ja"] })
    async listAnswerTimes(
        @Query("brand_code") brand_code: string,
        @Query("category_code") category_code: string,
        @Query("locale") locale?: string,
    ) {
        return this.legitGrailsService.listAnswerTimes({ brand_code, category_code, locale });
    }

    @Get("legitgrails/photo-index")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "List required verification photo angles for a LegitGrails category" })
    @ApiQuery({ name: "category_code", required: true, type: String })
    @ApiQuery({ name: "brand_code", required: false, type: String })
    @ApiQuery({ name: "model_code", required: false, type: String })
    @ApiQuery({ name: "locale", required: false, type: String, enum: ["en", "ja"] })
    async listPhotoIndexes(
        @Query("category_code") category_code: string,
        @Query("brand_code") brand_code?: string,
        @Query("model_code") model_code?: string,
        @Query("locale") locale?: string,
    ) {
        return this.legitGrailsService.listPhotoIndexes({ category_code, brand_code, model_code, locale });
    }

    @Post("legitgrails/photos")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @UseInterceptors(FilesInterceptor("photos"))
    @ApiConsumes("multipart/form-data")
    @ApiOperation({ summary: "Upload photos for LegitGrails authentication" })
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                photos: {
                    type: "array",
                    items: {
                        type: "string",
                        format: "binary",
                    },
                },
            },
        },
    })
    async uploadPhotos(@UploadedFiles() files: Express.Multer.File[]) {
        return this.legitGrailsService.uploadPhotos(files);
    }

    @Get("legitgrails/orders")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "List LegitGrails orders" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async listOrders(
        @Query("page") page?: string,
        @Query("limit") limit?: string,
    ) {
        return this.legitGrailsService.listOrders({
            page: page !== undefined ? Number(page) : undefined,
            limit: limit !== undefined ? Number(limit) : undefined,
        });
    }

    @Get("legitgrails/balance")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Get LegitGrails account credit balance" })
    async getBalance() {
        return this.legitGrailsService.getBalance();
    }

    @Post("products/:id/authentication/submit")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Submit a product to LegitGrails for authentication" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: SubmitProductAuthenticationDto })
    async submitProductAuthentication(
        @Param("id", ParseIntPipe) productId: number,
        @GetUser() payload: TokenPayload,
        @Body() dto: SubmitProductAuthenticationDto,
    ) {

        return this.legitGrailsService.submitProduct(productId, payload.id, dto, payload.role === "ADMIN");
    }

    @Post("products/:id/authentication/reupload-photos")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Resolve every index_code from the order's current update-photos request" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: ReuploadAuthenticationPhotosDto })
    async reuploadAuthenticationPhotos(
        @Param("id", ParseIntPipe) productId: number,
        @GetUser() payload: TokenPayload,
        @Body() dto: ReuploadAuthenticationPhotosDto,
    ) {
        return this.legitGrailsService.reuploadPhotos(productId, payload.id, dto, payload.role === "ADMIN");
    }

    @Get("products/:id/authentication")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Get product LegitGrails authentication status and request history" })
    @ApiParam({ name: "id", type: Number })
    async getProductAuthentication(
        @Param("id", ParseIntPipe) productId: number,
        @GetUser() payload: TokenPayload,
    ) {
        return this.legitGrailsService.getProductAuthentication(productId, payload.id, payload.role === "ADMIN");
    }

    @Post("legitgrails/webhooks")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Create a LegitGrails webhook endpoint" })
    @ApiBody({ type: CreateWebhookDto })
    async createWebhook(@Body() dto: CreateWebhookDto) {
        return this.legitGrailsService.createWebhook(dto);
    }

    @Get("legitgrails/webhooks")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "List LegitGrails webhook endpoints" })
    async listWebhooks() {
        return this.legitGrailsService.listWebhooks();
    }

    @Delete("legitgrails/webhooks/:id")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: "Delete a LegitGrails webhook endpoint" })
    @ApiParam({ name: "id", type: String })
    async deleteWebhook(@Param("id") webhookId: string) {
        return this.legitGrailsService.deleteWebhook(webhookId);
    }

    @Post("legitgrails/webhook")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "LegitGrails webhook endpoint", description: "Receives order-outcome and update-photos events." })
    async webhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers("x-lg-signature") signature: string | undefined,
        @Headers("x-lg-timestamp") timestamp: string | undefined,
        @Body() payload: Record<string, any>,
    ) {
        this.legitGrailsService.verifyWebhookSignature(
            req.rawBody,
            signature,
            timestamp,
            this.configService.get<string>("legitgrails.webhook_signing_secret"),
        );
        const authentication = await this.legitGrailsService.handleWebhook(payload);
        return { received: true, authentication };
    }
}
