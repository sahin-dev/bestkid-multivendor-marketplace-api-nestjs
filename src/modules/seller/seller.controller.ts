import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser, Roles } from "src/common/decorators";
import { SellerEarningsPeriod, SellerEarningsQueryDto } from "./dtos/seller-earnings-query.dto";
import { SellerService } from "./seller.service";

@ApiTags("Seller")
@Controller("seller")
@ApiBearerAuth("access-token")
@Roles("USER", "ADMIN")
export class SellerController {
    constructor(private readonly sellerService: SellerService) {}

    @Get("options")
    @ApiOperation({ summary: "Get seller account options and summary counts" })
    getOptions(@GetUser("id") sellerId: number) {
        return this.sellerService.getOptions(sellerId);
    }

    @Get("earnings")
    @ApiOperation({ summary: "Get seller earnings matrix and payment history" })
    @ApiQuery({ name: "period", required: false, enum: SellerEarningsPeriod })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    getEarnings(@GetUser("id") sellerId: number, @Query() query: SellerEarningsQueryDto) {
        return this.sellerService.getEarnings(sellerId, query);
    }
}
