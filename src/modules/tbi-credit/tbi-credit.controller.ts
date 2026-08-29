import { Body, Controller, Get, Headers, Param, Post, Query, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Public } from "src/common/decorators";
import { GetUser } from "src/common/decorators";
import { CreateTbiBuyNowSessionDto, CreateTbiCheckoutSessionDto, TbiCalculationsQueryDto } from "./dtos/tbi-credit.dto";
import { TbiCreditService } from "./tbi-credit.service";

@ApiTags("TBI Credit")
@Controller("tbi-credit")
export class TbiCreditController {
    constructor(private readonly tbiCreditService: TbiCreditService) {}

    @Get("calculations")
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "List TBI installment schemes for a product, cart selection, or explicit amount" })
    @ApiQuery({ name: "amount", required: false, type: Number })
    @ApiQuery({ name: "productId", required: false, type: Number })
    @ApiQuery({ name: "cartItemIds", required: false, type: [Number] })
    @ApiQuery({ name: "sellerIds", required: false, type: [Number] })
    @ApiResponse({ status: 200, description: "Normalized TBI installment schemes" })
    getCalculations(@GetUser("id") userId: number, @Query() query: TbiCalculationsQueryDto) {
        return this.tbiCreditService.getCalculations(userId, query);
    }

    @Post("checkout-session")
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Create a TBI Credit application for cart checkout" })
    @ApiBody({ type: CreateTbiCheckoutSessionDto })
    @ApiResponse({ status: 201, description: "TBI application URL and pending marketplace orders" })
    createCheckoutSession(@GetUser("id") userId: number, @Body() dto: CreateTbiCheckoutSessionDto) {
        return this.tbiCreditService.createCheckoutSession(userId, dto);
    }

    @Post("buy-now-session")
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Create a TBI Credit application for direct Buy Now checkout" })
    @ApiBody({ type: CreateTbiBuyNowSessionDto })
    @ApiResponse({ status: 201, description: "TBI application URL and pending marketplace order" })
    createBuyNowSession(@GetUser("id") userId: number, @Body() dto: CreateTbiBuyNowSessionDto) {
        return this.tbiCreditService.createBuyNowSession(userId, dto);
    }

    @Get("status/:referenceId")
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Poll TBI application status by transaction ID, merchant reference, or credit application ID" })
    @ApiParam({ name: "referenceId", type: String })
    getStatus(@GetUser("id") userId: number, @Param("referenceId") referenceId: string) {
        return this.tbiCreditService.getStatus(userId, referenceId);
    }

    @Public()
    @Post("webhook")
    @ApiOperation({ summary: "Receive TBI Credit status updates" })
    @ApiResponse({ status: 201, description: "TBI status update received" })
    webhook(
        @Req() req: RawBodyRequest<Request>,
        @Body() payload: Record<string, any>,
        @Headers("x-tbi-signature") signature?: string,
    ) {
        return this.tbiCreditService.handleStatusUpdate(payload, req.rawBody, signature);
    }
}
