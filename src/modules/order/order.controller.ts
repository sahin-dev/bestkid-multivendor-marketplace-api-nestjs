import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { GetUser, Roles } from "src/common/decorators";
import { OrderService } from "./order.service";
import { CreateOrderDto } from "./dtos/create-order.dto";
import { UpdateOrderStatusDto } from "./dtos/update-order-status.dto";
import { BuyerOrderTab, OrderQueryDto, SellerOrderTab } from "./dtos/order-query.dto";
import { CheckoutDto } from "./dtos/checkout.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { OrderStatus } from "generated/prisma/client";
import { CancelOrderDto } from "./dtos/cancel-order.dto";
import { CreateReviewDto } from "../product/dtos/create-review.dto";

@ApiTags("Orders")
@Controller("orders")
@ApiBearerAuth("access-token")
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    @ApiOperation({ summary: "Create an order directly from submitted items", description: "Creates an order for the authenticated buyer. Checkout from cart is preferred for multi-seller carts." })
    @ApiBody({ type: CreateOrderDto })
    @ApiResponse({ status: 201, description: "Order created" })
    async createOrder(@GetUser("id") userId: number, @Body() dto: CreateOrderDto) {
        return this.orderService.createOrder(userId, dto);
    }

    @Post("checkout")
    @ApiOperation({ summary: "Checkout the authenticated user's cart", description: "Groups cart items by seller, resolves delivery options, creates one order per seller, and clears the cart." })
    @ApiBody({ type: CheckoutDto })
    @ApiResponse({ status: 201, description: "Checkout completed; returns created orders" })
    async checkoutFromCart(@GetUser("id") userId: number, @Body() dto: CheckoutDto) {
        return this.orderService.checkoutFromCart(userId, dto);
    }

    @Get()
    @ApiOperation({ summary: "List my buyer orders", description: "Returns paginated orders placed by the authenticated user." })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: OrderStatus })
    @ApiQuery({ name: "tab", required: false, enum: BuyerOrderTab })
    async findAllUserOrders(@GetUser("id") userId: number, @Query() query: OrderQueryDto) {
        return this.orderService.findAllUserOrders(userId, query);
    }

    @Get("seller/all")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: list received customer orders", description: "Returns paginated orders where the authenticated user is the seller." })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: OrderStatus })
    @ApiQuery({ name: "sellerTab", required: false, enum: SellerOrderTab })
    async findAllSellerOrders(@GetUser("id") sellerId: number, @Query() query: OrderQueryDto) {
        return this.orderService.findAllSellerOrders(sellerId, query);
    }

    @Get("seller/:id")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: get a received order by ID" })
    @ApiParam({ name: "id", type: Number })
    async findSellerOrderById(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser("id") sellerId: number,
    ) {
        return this.orderService.findSellerOrderById(orderId, sellerId);
    }

    @Post(":id/chat")
    @ApiOperation({ summary: "Find or create the buyer/seller conversation for an order" })
    @ApiParam({ name: "id", type: Number })
    async findOrCreateOrderChat(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser("id") userId: number,
    ) {
        return this.orderService.findOrCreateOrderChat(orderId, userId);
    }

    @Get("admin/all")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: list all marketplace orders" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: OrderStatus })
    async findAllOrdersAdmin(@Query() query: OrderQueryDto) {
        return this.orderService.findAllOrdersAdmin(query);
    }

    @Get(":id")
    @ApiOperation({ summary: "Get order details", description: "Buyer, seller, or admin can view an order when authorized." })
    @ApiParam({ name: "id", type: Number })
    async findOrderById(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser() payload: TokenPayload,
    ) {
        const isAdmin = payload.role === "ADMIN";
        return this.orderService.findOrderById(orderId, payload.id, isAdmin);
    }

    @Patch(":id/cancel")
    @ApiOperation({ summary: "Cancel one of my orders", description: "Only pending or confirmed orders can be cancelled." })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: CancelOrderDto, required: false })
    async cancelOrder(
        @Param("id", ParseIntPipe) orderId: number,
        @GetUser("id") userId: number,
        @Body() dto: CancelOrderDto = {},
    ) {
        return this.orderService.cancelOrder(orderId, userId, dto.reason);
    }

    @Post("items/:orderItemId/review")
    @ApiOperation({ summary: "Review a delivered order item", description: "Creates one review for a purchased delivered order item." })
    @ApiParam({ name: "orderItemId", type: Number })
    @ApiBody({ type: CreateReviewDto })
    async reviewOrderItem(
        @Param("orderItemId", ParseIntPipe) orderItemId: number,
        @GetUser("id") userId: number,
        @Body() dto: CreateReviewDto,
    ) {
        return this.orderService.reviewOrderItem(userId, orderItemId, dto);
    }

    @Patch("seller/:id/status")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: update order fulfillment status", description: "Uses seller transition rules: PENDING -> CONFIRMED -> PROCESSING -> SHIPPED." })
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
    @ApiOperation({ summary: "Admin: update any order status" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateOrderStatusDto })
    async updateOrderStatusAdmin(
        @Param("id", ParseIntPipe) orderId: number,
        @Body() dto: UpdateOrderStatusDto,
    ) {
        return this.orderService.updateOrderStatusAdmin(orderId, dto.status);
    }
}
