import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AddToCartDto } from "./dtos/add-to-cart.dto";
import { UpdateCartItemDto } from "./dtos/update-cart-item.dto";
import { DeliveryService } from "../delivery/delivery.service";

@Injectable()
export class CartService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly deliveryService: DeliveryService,
    ) {}

    // ─── Get or create the user's cart ──────────────────────────────────────────
    private async getOrCreateCart(userId: number) {
        const existing = await this.prismaService.cart.findUnique({ where: { userId } });
        if (existing) return existing;
        return this.prismaService.cart.create({ data: { userId } });
    }

    // ─── Add item to cart ────────────────────────────────────────────────────────
    async addItem(userId: number, dto: AddToCartDto) {
        // Validate product
        const product = await this.prismaService.product.findUnique({
            where: { id: dto.productId },
            include: { user: { select: { stripe_onboarding_complete: true } } },
        });
        if (!product) throw new NotFoundException("Product not found");
        if (product.status !== "ACTIVE") throw new BadRequestException("Product is not available");
        if (!product.user.stripe_onboarding_complete) {
            throw new ForbiddenException("This seller has not completed payment setup.");
        }

        // Validate variant
        const variant = await this.prismaService.productVariant.findFirst({
            where: { id: dto.variantId, productId: dto.productId },
        });
        if (!variant) throw new NotFoundException("Product variant not found for this product");

        const cart = await this.getOrCreateCart(userId);

        // Upsert cart item (increment if exists)
        const existing = await this.prismaService.cartItem.findFirst({
            where: { cartId: cart.id, productId: dto.productId, variantId: dto.variantId },
        });

        if (existing) {
            return this.prismaService.cartItem.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + dto.quantity },
            });
        }

        return this.prismaService.cartItem.create({
            data: {
                cartId: cart.id,
                productId: dto.productId,
                variantId: dto.variantId,
                quantity: dto.quantity,
            },
        });
    }

    // ─── Get cart grouped by seller ──────────────────────────────────────────────
    async getCart(userId: number, buyerCountry?: string) {
        const cart = await this.prismaService.cart.findUnique({
            where: { userId },
            include: {
                cartItems: {
                    include: {
                        product: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        profile: { select: { full_name: true, avatar_url: true, country: true } },
                                        delivery_option: true,
                                    },
                                },
                                variants: true,
                            },
                        },
                        variant: true,
                    },
                },
            },
        });

        if (!cart || cart.cartItems.length === 0) {
            return { seller_groups: [], grand_total: 0 };
        }

        // Group by seller
        const sellerMap = new Map<number, typeof cart.cartItems>();
        for (const item of cart.cartItems) {
            const sellerId = item.product.userId;
            if (!sellerMap.has(sellerId)) sellerMap.set(sellerId, []);
            sellerMap.get(sellerId)!.push(item);
        }

        let grandTotal = 0;
        const sellerGroups: any[] = [];

        for (const [sellerId, items] of sellerMap) {
            const seller = items[0].product.user;
            const sellerCountry = seller.profile?.country ?? null;

            const delivery = this.deliveryService.resolveDelivery(
                seller.delivery_option,
                buyerCountry ?? null,
                sellerCountry,
            );

            const subtotal = items.reduce((sum, i) => {
                const price = i.product.discounted_price ?? i.product.original_price;
                return sum + price * i.quantity;
            }, 0);

            const deliveryCost = delivery.cost;
            const groupTotal = subtotal + deliveryCost;
            grandTotal += groupTotal;

            sellerGroups.push({
                seller: { id: sellerId, name: seller.profile?.full_name, country: sellerCountry },
                delivery: {
                    type: delivery.type,
                    partner: delivery.partner,
                    cost: deliveryCost,
                    days_min: delivery.days_min,
                    days_max: delivery.days_max,
                },
                items: items.map((i) => ({
                    id: i.id,
                    productId: i.productId,
                    variantId: i.variantId,
                    quantity: i.quantity,
                    price: i.product.discounted_price ?? i.product.original_price,
                    product: {
                        id: i.product.id,
                        name: i.product.name,
                        image_urls: i.product.image_urls,
                        status: i.product.status,
                    },
                    variant: { id: i.variant.id, variantName: i.variant.variantName, price: i.variant.price },
                })),
                subtotal,
                delivery_cost: deliveryCost,
                group_total: groupTotal,
            });
        }

        return { seller_groups: sellerGroups, grand_total: grandTotal };
    }

    // ─── Update item quantity ────────────────────────────────────────────────────
    async updateItem(userId: number, itemId: number, dto: UpdateCartItemDto) {
        const item = await this.prismaService.cartItem.findUnique({
            where: { id: itemId },
            include: { cart: true },
        });
        if (!item) throw new NotFoundException("Cart item not found");
        if (item.cart.userId !== userId) throw new ForbiddenException("Not your cart item");

        return this.prismaService.cartItem.update({
            where: { id: itemId },
            data: { quantity: dto.quantity },
        });
    }

    // ─── Remove item ─────────────────────────────────────────────────────────────
    async removeItem(userId: number, itemId: number) {
        const item = await this.prismaService.cartItem.findUnique({
            where: { id: itemId },
            include: { cart: true },
        });
        if (!item) throw new NotFoundException("Cart item not found");
        if (item.cart.userId !== userId) throw new ForbiddenException("Not your cart item");

        await this.prismaService.cartItem.delete({ where: { id: itemId } });
        return { message: "Item removed from cart" };
    }

    // ─── Clear entire cart ───────────────────────────────────────────────────────
    async clearCart(userId: number) {
        const cart = await this.prismaService.cart.findUnique({ where: { userId } });
        if (!cart) return { message: "Cart is already empty" };
        await this.prismaService.cartItem.deleteMany({ where: { cartId: cart.id } });
        return { message: "Cart cleared" };
    }
}
