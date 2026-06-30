import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser, Roles } from "src/common/decorators";
import { ReturnService } from "./return.service";
import { CreateReturnDto } from "./dtos/create-return.dto";
import { ReturnQueryDto } from "./dtos/return-query.dto";
import { UpdateReturnStatusDto } from "./dtos/update-return-status.dto";
import { TokenPayload } from "../auth/types/TokenPayload.type";

@ApiTags("Returns")
@Controller("returns")
@ApiBearerAuth("access-token")
export class ReturnController {
    constructor(private readonly returnService: ReturnService) {}

    @Post()
    @ApiBody({ type: CreateReturnDto })
    async createReturn(@GetUser("id") userId: number, @Body() dto: CreateReturnDto) {
        return this.returnService.createReturn(userId, dto);
    }

    @Get()
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async findMyReturns(@GetUser("id") userId: number, @Query() query: ReturnQueryDto) {
        return this.returnService.findMyReturns(userId, query);
    }

    @Get("seller/all")
    @Roles("SELLER", "ADMIN")
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async findSellerReturns(@GetUser("id") sellerId: number, @Query() query: ReturnQueryDto) {
        return this.returnService.findSellerReturns(sellerId, query);
    }

    @Get("admin/all")
    @Roles("ADMIN")
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async findAllReturnsAdmin(@Query() query: ReturnQueryDto) {
        return this.returnService.findAllReturnsAdmin(query);
    }

    @Get(":id")
    @ApiParam({ name: "id", type: Number })
    async findReturnById(
        @Param("id", ParseIntPipe) returnId: number,
        @GetUser() payload: TokenPayload,
    ) {
        return this.returnService.findReturnById(returnId, payload.id, payload.role);
    }

    @Patch("seller/:id/status")
    @Roles("SELLER", "ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateReturnStatusDto })
    async updateReturnStatusSeller(
        @Param("id", ParseIntPipe) returnId: number,
        @GetUser("id") sellerId: number,
        @Body() dto: UpdateReturnStatusDto,
    ) {
        return this.returnService.updateReturnStatusSeller(returnId, sellerId, dto.status);
    }

    @Patch("admin/:id/status")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateReturnStatusDto })
    async updateReturnStatusAdmin(
        @Param("id", ParseIntPipe) returnId: number,
        @Body() dto: UpdateReturnStatusDto,
    ) {
        return this.returnService.updateReturnStatusAdmin(returnId, dto.status);
    }
}
