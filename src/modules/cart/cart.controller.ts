import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GetUser } from "src/common/decorators";
import { CartService } from "./cart.service";
import { AddToCartDto } from "./dtos/add-to-cart.dto";
import { UpdateCartItemDto } from "./dtos/update-cart-item.dto";
import type { Request } from "express";

@ApiTags("Cart")
@Controller("cart")
@ApiBearerAuth("access-token")
export class CartController {
    constructor(private readonly cartService: CartService) {}

    @Get()
    @ApiOperation({ summary: "Get cart grouped by seller with delivery estimate" })
    async getCart(@GetUser("id") userId: number, @Req() req: Request) {
        const user = req["user"] as any;
        const buyerCountry = user?.profile?.country ?? undefined;
        return this.cartService.getCart(userId, buyerCountry);
    }

    @Post("items")
    @ApiOperation({ summary: "Add item to cart" })
    async addItem(@GetUser("id") userId: number, @Body() dto: AddToCartDto) {
        return this.cartService.addItem(userId, dto);
    }

    @Patch("items/:itemId")
    @ApiOperation({ summary: "Update quantity of a cart item" })
    async updateItem(
        @GetUser("id") userId: number,
        @Param("itemId", ParseIntPipe) itemId: number,
        @Body() dto: UpdateCartItemDto,
    ) {
        return this.cartService.updateItem(userId, itemId, dto);
    }

    @Delete("items/:itemId")
    @ApiOperation({ summary: "Remove a specific item from cart" })
    async removeItem(
        @GetUser("id") userId: number,
        @Param("itemId", ParseIntPipe) itemId: number,
    ) {
        return this.cartService.removeItem(userId, itemId);
    }

    @Delete()
    @ApiOperation({ summary: "Clear the entire cart" })
    async clearCart(@GetUser("id") userId: number) {
        return this.cartService.clearCart(userId);
    }
}
