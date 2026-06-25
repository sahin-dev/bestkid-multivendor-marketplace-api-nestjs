import { Body, Controller, Get, Param, ParseIntPipe, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GetUser, Public, Roles } from "src/common/decorators";
import { DeliveryService } from "./delivery.service";
import { UpsertDeliveryDto } from "./dtos/upsert-delivery.dto";

@ApiTags("Delivery")
@Controller("delivery")
export class DeliveryController {
    constructor(private readonly deliveryService: DeliveryService) {}

    @Put("me")
    @ApiBearerAuth("access-token")
    @Roles("SELLER", "ADMIN")
    @ApiOperation({ summary: "Seller: create or update domestic and international delivery options" })
    async upsertDelivery(@GetUser("id") sellerId: number, @Body() dto: UpsertDeliveryDto) {
        return this.deliveryService.upsertDeliveryOptions(sellerId, dto);
    }

    @Get("me")
    @ApiBearerAuth("access-token")
    @Roles("SELLER", "ADMIN")
    @ApiOperation({ summary: "Seller: get own delivery options" })
    async getMyDelivery(@GetUser("id") sellerId: number) {
        return this.deliveryService.getMyDeliveryOptions(sellerId);
    }

    @Get(":sellerId")
    @Public()
    @ApiOperation({ summary: "Get a seller's delivery options (public)" })
    async getSellerDelivery(@Param("sellerId", ParseIntPipe) sellerId: number) {
        return this.deliveryService.getSellerDeliveryOptions(sellerId);
    }
}
