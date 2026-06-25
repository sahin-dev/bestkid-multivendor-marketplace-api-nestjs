import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertDeliveryDto } from "./dtos/upsert-delivery.dto";

@Injectable()
export class DeliveryService {
    constructor(private readonly prismaService: PrismaService) {}

    async upsertDeliveryOptions(sellerId: number, dto: UpsertDeliveryDto) {
        return this.prismaService.sellerDeliveryOption.upsert({
            where: { sellerId },
            update: { ...dto },
            create: { sellerId, ...dto },
        });
    }

    async getMyDeliveryOptions(sellerId: number) {
        const option = await this.prismaService.sellerDeliveryOption.findUnique({
            where: { sellerId },
        });
        if (!option) {
            return { message: "No delivery options set yet.", data: null };
        }
        return { data: option };
    }

    async getSellerDeliveryOptions(sellerId: number) {
        const option = await this.prismaService.sellerDeliveryOption.findUnique({
            where: { sellerId },
        });
        if (!option) {
            throw new NotFoundException(`Seller with ID ${sellerId} has not set delivery options.`);
        }
        return { data: option };
    }

    /**
     * Resolve which delivery option applies based on buyer and seller country.
     * Used internally at cart/checkout time.
     */
    resolveDelivery(
        deliveryOption: {
            domestic_partner: string | null;
            domestic_cost: number | null;
            domestic_days_min: number | null;
            domestic_days_max: number | null;
            international_partner: string | null;
            international_cost: number | null;
            international_days_min: number | null;
            international_days_max: number | null;
        } | null,
        buyerCountry: string | null,
        sellerCountry: string | null,
    ) {
        if (!deliveryOption) {
            return { partner: null, cost: 0, days_min: null, days_max: null, type: "none" };
        }

        const isDomestic = buyerCountry && sellerCountry && buyerCountry === sellerCountry;

        if (isDomestic) {
            return {
                partner: deliveryOption.domestic_partner,
                cost: deliveryOption.domestic_cost ?? 0,
                days_min: deliveryOption.domestic_days_min,
                days_max: deliveryOption.domestic_days_max,
                type: "domestic",
            };
        } else {
            return {
                partner: deliveryOption.international_partner,
                cost: deliveryOption.international_cost ?? 0,
                days_min: deliveryOption.international_days_min,
                days_max: deliveryOption.international_days_max,
                type: "international",
            };
        }
    }
}
