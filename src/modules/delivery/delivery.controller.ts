import { Body, Controller, Get, Param, ParseIntPipe, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { GetUser, Public, Roles } from "src/common/decorators";
import { DeliveryService } from "./delivery.service";
import {
    UpsertDeliveryDto,
    UpsertDomesticDeliveryDto,
    UpsertInternationalDeliveryDto,
} from "./dtos/upsert-delivery.dto";

@ApiTags("Delivery")
@Controller("delivery")
export class DeliveryController {
    constructor(private readonly deliveryService: DeliveryService) {}

    @Put("me")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: create or update domestic and international delivery options" })
    @ApiBody({ type: UpsertDeliveryDto })
    async upsertDelivery(@GetUser("id") sellerId: number, @Body() dto: UpsertDeliveryDto) {
        return this.deliveryService.upsertDeliveryOptions(sellerId, dto);
    }

    @Put("me/domestic")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: create or update domestic delivery options" })
    @ApiBody({ type: UpsertDomesticDeliveryDto })
    async upsertDomesticDelivery(@GetUser("id") sellerId: number, @Body() dto: UpsertDomesticDeliveryDto) {
        return this.deliveryService.upsertDomesticDeliveryOptions(sellerId, dto);
    }

    @Put("me/international")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: create or update international delivery options" })
    @ApiBody({ type: UpsertInternationalDeliveryDto })
    async upsertInternationalDelivery(@GetUser("id") sellerId: number, @Body() dto: UpsertInternationalDeliveryDto) {
        return this.deliveryService.upsertInternationalDeliveryOptions(sellerId, dto);
    }

    @Get("me")
    @ApiBearerAuth("access-token")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: get own delivery options" })
    async getMyDelivery(@GetUser("id") sellerId: number) {
        return this.deliveryService.getMyDeliveryOptions(sellerId);
    }

    @Get(":sellerId")
    @Public()
    @ApiOperation({ summary: "Get a seller's delivery options (public)" })
    @ApiParam({ name: "sellerId", type: Number })
    async getSellerDelivery(@Param("sellerId", ParseIntPipe) sellerId: number) {
        return this.deliveryService.getSellerDeliveryOptions(sellerId);
    }
}
