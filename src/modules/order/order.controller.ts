import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser, Roles } from "src/common/decorators";
import { OrderService } from "./order.service";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { UpdateOrderStatusDto } from "./dtos/update-order-status.dto";
import { OrderQueryDto } from "./dtos/order-query.dto";
import { CheckoutDto } from "./dtos/checkout.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";

@ApiTags("Orders")
@Controller("orders")
@ApiBearerAuth("access-token")
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    @ApiBody({ type: CreateOrderDto })
    async createOrder(@GetUser("id") userId: number, @Body() dto: CreateOrderDto) {
        return this.orderService.createOrder(userId, dto);
    }

    @Post("checkout")
    @ApiBody({ type: CheckoutDto })
    async checkoutFromCart(@GetUser("id") userId: number, @Body() dto: CheckoutDto) {
        return this.orderService.checkoutFromCart(userId, dto);
    }

    @Get()
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] })
    async findAllUserOrders(@GetUser("id") userId: number, @Query() query: OrderQueryDto) {
        return this.orderService.findAllUserOrders(userId, query);
    }

    @Get("seller/all")
    @Roles("SELLER", "ADMIN")
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] })
    async findAllSellerOrders(@GetUser("id") sellerId: number, @Query() query: OrderQueryDto) {
        return this.orderService.findAllSellerOrders(sellerId, query);
    }

    @Get("seller/:id")
    @Roles("SELLER", "ADMIN")
    @ApiParam({ name: "id", type: Number })
    async findSellerOrderById(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser("id") sellerId: number,
    ) {
        return this.orderService.findSellerOrderById(orderId, sellerId);
    }

    @Get("admin/all")
    @Roles("ADMIN")
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] })
    async findAllOrdersAdmin(@Query() query: OrderQueryDto) {
        return this.orderService.findAllOrdersAdmin(query);
    }

    @Get(":id")
    @ApiParam({ name: "id", type: Number })
    async findOrderById(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser() payload: TokenPayload,
    ) {
        const isAdmin = payload.role === "ADMIN";
        return this.orderService.findOrderById(orderId, payload.id, isAdmin);
    }

    @Patch(":id/cancel")
    @ApiParam({ name: "id", type: Number })
    async cancelOrder(@Param("id", ParseIntPipe) orderId: number, @GetUser("id") userId: number) {
        return this.orderService.cancelOrder(orderId, userId);
    }

    @Patch("seller/:id/status")
    @Roles("SELLER", "ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateOrderStatusDto })
    async updateSellerOrderStatus(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser("id") sellerId: number,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.orderService.updateSellerOrderStatus(orderId, sellerId, dto.status);
    }

    @Patch("admin/:id/status")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateOrderStatusDto })
    async updateOrderStatusAdmin(
        @Param("id", ParseIntPipe) orderId: number,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.orderService.updateOrderStatusAdmin(orderId, dto.status);
    }
}
