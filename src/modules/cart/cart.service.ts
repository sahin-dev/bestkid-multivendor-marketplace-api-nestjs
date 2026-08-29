import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AddToCartDto } from "./dtos/add-to-cart.dto";
import { DeliveryService } from "../delivery/delivery.service";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";
import { AuthenticationStatus, CurrencyPreference, ProductStatus } from "generated/prisma/client";
import { CurrencyConversionService } from "../currency/currency.service";

@Injectable()
export class CartService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly deliveryService: DeliveryService,
        private readonly currencyService: CurrencyConversionService,
    ) {}

    // ─── Get or create the user's cart ──────────────────────────────────────────
    private async getOrCreateCart(userId: number) {
        const existing = await this.prismaService.cart.findUnique({ where: { userId } });
        if (existing) return existing;
        await assertEntityExists(this.prismaService.baseUser, "User", userId);
        return this.prismaService.cart.create({ data: { userId } });
    }

    // ─── Add item to cart ────────────────────────────────────────────────────────
    async addItem(userId: number, dto: AddToCartDto) {
        // Validate product
        const product = await this.prismaService.product.findUnique({
            where: { id: dto.productId },
            include: { user: { select: { stripe_onboarding_complete: true } } },
        });
        if (!product) throw new NotFoundException(`Product with ID ${dto.productId} not found`);
        if (product.status !== ProductStatus.ACTIVE) throw new BadRequestException("Product is not available");
        if (product.authentication_status !== AuthenticationStatus.VERIFIED) {
            throw new BadRequestException("This item has not been authenticated yet");
        }
        if (product.userId === userId) throw new BadRequestException("You cannot add your own product to cart");
        if (!product.user.stripe_onboarding_complete) {
            throw new ForbiddenException("This seller has not completed payment setup.");
        }

        const cart = await this.getOrCreateCart(userId);

        const existing = await this.prismaService.cartItem.findFirst({
            where: { cartId: cart.id, productId: dto.productId },
        });

        if (existing) {
            return existing;
        }

        return this.prismaService.cartItem.create({
            data: {
                cartId: cart.id,
                productId: dto.productId,
            },
        });
    }

    // ─── Get cart grouped by seller ──────────────────────────────────────────────
    async getCart(userId: number, buyerCountry?: string) {
        const [cart, userCurrency] = await Promise.all([
            this.prismaService.cart.findUnique({
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
                                    category: true,
                                    subCategory: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.getUserCurrency(userId),
        ]);

        if (!cart || cart.cartItems.length === 0) {
            return { seller_groups: [], grand_total: 0, currency: userCurrency };
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

            const subtotalUsd = items.reduce((sum, i) => {
                const price = i.product.discounted_price ?? i.product.original_price;
                return sum + price;
            }, 0);

            const deliveryCostUsd = delivery.cost;
            const groupTotalUsd = subtotalUsd + deliveryCostUsd;
            const subtotal = await this.convertUsdAmount(subtotalUsd, userCurrency);
            const deliveryCost = await this.convertUsdAmount(deliveryCostUsd, userCurrency);
            const groupTotal = await this.convertUsdAmount(groupTotalUsd, userCurrency);
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
                items: await Promise.all(
                    items.map(async (i) => ({
                        id: i.id,
                        productId: i.productId,
                        price: await this.convertUsdAmount(i.product.discounted_price ?? i.product.original_price, userCurrency),
                        product: {
                            id: i.product.id,
                            name: i.product.name,
                            image_urls: i.product.image_urls,
                            category:i.product.category,
                            sub_category:i.product.subCategory,
                            status: i.product.status,
                        },
                    })),
                ),
                subtotal,
                delivery_cost: deliveryCost,
                group_total: groupTotal,
            });
        }

        return { seller_groups: sellerGroups, grand_total: grandTotal, currency: userCurrency };
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

    private async getUserCurrency(userId: number): Promise<CurrencyPreference> {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            select: { currency_preference: true },
        });

        return user?.currency_preference ?? CurrencyPreference.USD;
    }

    private async convertUsdAmount(amount: number, currency: CurrencyPreference) {
        if (currency === CurrencyPreference.USD) {
            return Number(amount.toFixed(2));
        }

        return this.currencyService.convertAsync(amount, CurrencyPreference.USD, currency);
    }
}
