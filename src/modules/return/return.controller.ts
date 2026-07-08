import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { GetUser, Roles } from "src/common/decorators";
import { ReturnService } from "./return.service";
import { CreateReturnDto } from "./dtos/create-return.dto";
import { ReturnQueryDto, ReturnTab, SellerReturnTab } from "./dtos/return-query.dto";
import { UpdateReturnStatusDto } from "./dtos/update-return-status.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";
import { ReturnStatus } from "generated/prisma/client";

@ApiTags("Returns")
@Controller("returns")
@ApiBearerAuth("access-token")
export class ReturnController {
    constructor(private readonly returnService: ReturnService) {}

    @Post()
    @ApiOperation({ summary: "Create a return request", description: "Authenticated buyers can request a return for an order item they purchased." })
    @ApiBody({ type: CreateReturnDto })
    @ApiResponse({ status: 201, description: "Return request submitted" })
    async createReturn(@GetUser("id") userId: number, @Body() dto: CreateReturnDto) {
        return this.returnService.createReturn(userId, dto);
    }

    @Get()
    @ApiOperation({ summary: "List my return requests" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: ReturnStatus })
    @ApiQuery({ name: "tab", required: false, enum: ReturnTab })
    async findMyReturns(@GetUser("id") userId: number, @Query() query: ReturnQueryDto) {
        return this.returnService.findMyReturns(userId, query);
    }

    @Get("seller/all")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: list return requests for received orders" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: ReturnStatus })
    @ApiQuery({ name: "sellerTab", required: false, enum: SellerReturnTab })
    async findSellerReturns(@GetUser("id") sellerId: number, @Query() query: ReturnQueryDto) {
        return this.returnService.findSellerReturns(sellerId, query);
    }

    @Get("admin/all")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: list all return requests" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: ReturnStatus })
    async findAllReturnsAdmin(@Query() query: ReturnQueryDto) {
        return this.returnService.findAllReturnsAdmin(query);
    }

    @Post(":id/chat")
    @ApiOperation({ summary: "Find or create the seller conversation for a return request" })
    @ApiParam({ name: "id", type: Number })
    async findOrCreateReturnChat(
        @Param("id", ParseIntPipe) returnId: number,
        @GetUser("id") userId: number,
    ) {
        return this.returnService.findOrCreateReturnChat(returnId, userId);
    }

    @Get(":id")
    @ApiOperation({ summary: "Get return request details", description: "Buyer, seller, or admin can view when authorized." })
    @ApiParam({ name: "id", type: Number })
    async findReturnById(
        @Param("id", ParseIntPipe) returnId: number,
        @GetUser() payload: TokenPayload,
    ) {
        return this.returnService.findReturnById(returnId, payload.id, payload.role);
    }

    @Patch("seller/:id/status")
    @Roles("USER", "ADMIN")
    @ApiOperation({ summary: "Seller: approve or reject a pending return request" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateReturnStatusDto })
    async updateReturnStatusSeller(
        @Param("id", ParseIntPipe) returnId: number,
        @GetUser("id") sellerId: number,
        @Body() dto: UpdateReturnStatusDto,
    ) {
        return this.returnService.updateReturnStatusSeller(returnId, sellerId, dto);
    }

    @Patch("admin/:id/status")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: update any return request status" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateReturnStatusDto })
    async updateReturnStatusAdmin(
        @Param("id", ParseIntPipe) returnId: number,
        @Body() dto: UpdateReturnStatusDto,
    ) {
        return this.returnService.updateReturnStatusAdmin(returnId, dto);
    }
}
