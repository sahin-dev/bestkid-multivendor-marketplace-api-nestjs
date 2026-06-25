import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    Query,
    Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GetUser, Public, Roles } from "src/common/decorators";
import { StripeService } from "./stripe.service";
import { OnboardSellerDto } from "./dtos/onboard-seller.dto";
import type { Request } from "express";

@ApiTags("Stripe")
@Controller("stripe")
@ApiBearerAuth("access-token")
export class StripeController {
    constructor(private readonly stripeService: StripeService) {}

    @Post("onboard")
    @ApiOperation({ summary: "Create Stripe Express account and get onboarding URL" })
    async onboard(@GetUser("id") userId: number, @Body() dto: OnboardSellerDto) {
        return this.stripeService.onboardSeller(userId, dto.returnUrl, dto.refreshUrl);
    }

    @Get("status")
    @ApiOperation({ summary: "Get current Stripe onboarding status" })
    async getStatus(@GetUser("id") userId: number) {
        return this.stripeService.getStatus(userId);
    }

    @Get("callback")
    @ApiOperation({ summary: "Stripe redirect callback after onboarding — updates onboarding status" })
    async callback(@GetUser("id") userId: number) {
        return this.stripeService.handleCallback(userId);
    }

    @Post("webhook")
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Stripe webhook endpoint (raw body required)" })
    async webhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers("stripe-signature") signature: string,
    ) {
        return this.stripeService.handleWebhook(req.rawBody!, signature);
    }

    @Get("admin/accounts")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: list all seller Stripe accounts" })
    async adminListAccounts(
        @Query("page") page = 1,
        @Query("limit") limit = 20,
    ) {
        return this.stripeService.listAllSellerAccounts(+page, +limit);
    }
}
