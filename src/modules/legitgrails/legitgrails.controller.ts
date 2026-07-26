import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { GetUser, Public, Roles } from "src/common/decorators";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { SubmitProductAuthenticationDto } from "./dtos/submit-product-authentication.dto";
import { LegitGrailsService } from "./legitgrails.service";

@ApiTags("LegitGrails")
@Controller()
export class LegitGrailsController {
    constructor(
        private readonly legitGrailsService: LegitGrailsService,
        private readonly configService: ConfigService,
    ) {}

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

    @Post("legitgrails/webhook")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "LegitGrails webhook endpoint" })
    async webhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers("x-legitgrails-signature") signature: string | undefined,
        @Body() payload: Record<string, any>,
    ) {
        this.legitGrailsService.verifyWebhookSignature(
            req.rawBody,
            signature,
            this.configService.get<string>("legitgrails.webhook_secret"),
        );
        const authentication = await this.legitGrailsService.handleWebhook(payload);
        return { received: true, authentication };
    }
}
