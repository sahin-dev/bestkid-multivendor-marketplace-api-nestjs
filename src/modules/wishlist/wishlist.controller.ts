import { Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser } from "src/common/decorators";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { WishlistService } from "./wishlist.service";

@ApiTags("Wishlist")
@Controller("wishlist")
@ApiBearerAuth("access-token")
export class WishlistController {
    constructor(private readonly wishlistService: WishlistService) {}

    @Get()
    @ApiOperation({ summary: "List saved wishlist products" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    findAll(@GetUser("id") userId: number, @Query() query: PaginationDto) {
        return this.wishlistService.findAll(userId, query);
    }

    @Get("count")
    @ApiOperation({ summary: "Get wishlist item count" })
    count(@GetUser("id") userId: number) {
        return this.wishlistService.count(userId);
    }

    @Post(":productId")
    @ApiOperation({ summary: "Save a product to wishlist" })
    @ApiParam({ name: "productId", type: Number })
    add(@GetUser("id") userId: number, @Param("productId", ParseIntPipe) productId: number) {
        return this.wishlistService.add(userId, productId);
    }

    @Delete(":productId")
    @ApiOperation({ summary: "Remove a product from wishlist" })
    @ApiParam({ name: "productId", type: Number })
    remove(@GetUser("id") userId: number, @Param("productId", ParseIntPipe) productId: number) {
        return this.wishlistService.remove(userId, productId);
    }
}
