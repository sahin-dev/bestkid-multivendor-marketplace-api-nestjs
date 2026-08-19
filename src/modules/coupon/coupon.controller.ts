import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public, Roles } from "src/common/decorators";
import { CouponService } from "./coupon.service";
import { CouponQueryDto, CouponStatusFilter } from "./dtos/coupon-query.dto";
import { CreateCouponDto, UpdateCouponDto } from "./dtos/upsert-coupon.dto";
import { CouponDiscountType, CouponUsageType } from "generated/prisma/client";

@ApiTags("Admin Coupons")
@ApiBearerAuth("access-token")
@Roles("ADMIN")
@Controller("admin/coupons")
export class CouponController {
    constructor(private readonly couponService: CouponService) {}

    @Get()
    @ApiOperation({ summary: "Admin: list coupons" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    @ApiQuery({ name: "status", required: false, enum: CouponStatusFilter })
    @ApiQuery({ name: "discount_type", required: false, enum: CouponDiscountType })
    @ApiQuery({ name: "usage_type", required: false, enum: CouponUsageType })
    @ApiResponse({
        status: 200,
        description: "Paginated coupons for the manage coupon table",
        schema: {
            example: {
                data: [
                    {
                        id: 1,
                        code: "KIDS10",
                        campaign_reason: "Christmas Sale",
                        discount_type: "PERCENTAGE",
                        value: "10%",
                        usage: "Unlimited",
                        status: "ACTIVE",
                    },
                ],
                meta: { total: 1, page: 1, limit: 10, pages: 1 },
            },
        },
    })
    findAll(@Query() query: CouponQueryDto) {
        return this.couponService.findAll(query);
    }

    @Get(":id")
    @ApiOperation({ summary: "Admin: get coupon details" })
    @ApiParam({ name: "id", type: Number })
    findById(@Param("id", ParseIntPipe) id: number) {
        return this.couponService.findById(id);
    }

    @Post()
    @ApiOperation({ summary: "Admin: create a coupon" })
    @ApiBody({ type: CreateCouponDto })
    create(@Body() dto: CreateCouponDto) {
        return this.couponService.create(dto);
    }

    @Patch(":id")
    @ApiOperation({ summary: "Admin: update a coupon" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateCouponDto })
    update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCouponDto) {
        return this.couponService.update(id, dto);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Admin: delete a coupon" })
    @ApiParam({ name: "id", type: Number })
    delete(@Param("id", ParseIntPipe) id: number) {
        return this.couponService.delete(id);
    }
}
