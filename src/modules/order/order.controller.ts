import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { GetUser, Roles } from "src/common/decorators";
import { OrderService } from "./order.service";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { UpdateOrderStatusDto } from "./dtos/update-order-status.dto";
import { OrderQueryDto } from "./dtos/order-query.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";

@ApiTags("Orders")
@Controller("orders")
@ApiBearerAuth("access-token")
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    async createOrder(@GetUser("id") userId: number, @Body() dto: CreateOrderDto) {
        return this.orderService.createOrder(userId, dto);
    }

    @Get()
    async findAllUserOrders(@GetUser("id") userId: number, @Query() query: OrderQueryDto) {
        return this.orderService.findAllUserOrders(userId, query);
    }

    @Get("admin/all")
    @Roles("ADMIN")
    async findAllOrdersAdmin(@Query() query: OrderQueryDto) {
        return this.orderService.findAllOrdersAdmin(query);
    }

    @Get(":id")
    async findOrderById(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser() payload: TokenPayload,
    ) {
        const isAdmin = payload.role === "ADMIN";
        return this.orderService.findOrderById(orderId, payload.id, isAdmin);
    }

    @Patch(":id/cancel")
    async cancelOrder(@Param("id", ParseIntPipe) orderId: number, @GetUser("id") userId: number) {
        return this.orderService.cancelOrder(orderId, userId);
    }

    @Patch("admin/:id/status")
    @Roles("ADMIN")
    async updateOrderStatusAdmin(
        @Param("id", ParseIntPipe) orderId: number,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.orderService.updateOrderStatusAdmin(orderId, dto.status);
    }
}
