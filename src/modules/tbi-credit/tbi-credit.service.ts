import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { CurrencyPreference, PaymentProvider, PaymentStatus, Prisma, SellerTier } from "generated/prisma/client";
import tbiCreditConfig, { TbiCreditConfig } from "src/config/tbi-credit.config";
import { CurrencyConversionService } from "../currency/currency.service";
import { OrderService } from "../order/order.service";
import { CheckoutSummaryQueryDto } from "../order/dtos/checkout-flow.dto";
import { PaymentService } from "../payment/payment.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTbiBuyNowSessionDto, CreateTbiCheckoutSessionDto, TbiCalculationsQueryDto } from "./dtos/tbi-credit.dto";
import { TbiCreditClient } from "./tbi-credit.client";

type TbiPaymentState = "pending" | "approved" | "cancelled" | "rejected" | "failed";

@Injectable()
export class TbiCreditService {
    private readonly logger = new Logger(TbiCreditService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly orderService: OrderService,
        private readonly paymentService: PaymentService,
        private readonly client: TbiCreditClient,
        private readonly currencyService: CurrencyConversionService,
        @Inject(tbiCreditConfig.KEY)
        private readonly config: ConfigType<typeof TbiCreditConfig>,
    ) {}

    async getCalculations(userId: number, dto: TbiCalculationsQueryDto) {
        const source = await this.resolveCalculationSource(userId, dto);
        const amount = await this.convertUsdToTbiCurrency(source.amountUsd);
        const rawSchemes = await this.client.getCalculations({
            amount,
            categoryId: dto.categoryId ?? source.categoryId ?? undefined,
        });

        return {
            country: this.client.country,
            currency: this.client.currency,
            base_currency: CurrencyPreference.USD,
            amount,
            amount_usd: source.amountUsd,
            category_id: dto.categoryId ?? source.categoryId ?? null,
            schemes: this.normalizeCalculations(rawSchemes, amount),
        };
    }

    async createCheckoutSession(userId: number, dto: CreateTbiCheckoutSessionDto) {
        this.assertAcceptedTerms(dto.acceptedTerms);
        const user = await this.getBuyer(userId);
        const checkoutSummaryUsd = await this.orderService.getCheckoutSummaryForPayment(userId, {
            sellerIds: dto.sellerIds,
            cartItemIds: dto.cartItemIds,
            addressId: dto.addressId,
            country: dto.country,
            couponCode: dto.couponCode,
        });

        this.assertSupportedTbiCurrency();
        const amountTotal = await this.convertUsdToTbiCurrency(checkoutSummaryUsd.price_details.total);
        const paymentCurrency = this.client.currency.toLowerCase();
        const sellerProfiles = await this.getSellerPaymentProfiles(
            checkoutSummaryUsd.seller_groups.map((group: any) => group.seller.id),
        );

        const orderResult = await this.orderService.createPendingCartOrders(userId, {
            sellerIds: dto.sellerIds,
            cartItemIds: dto.cartItemIds,
            addressId: dto.addressId,
            shippingAddress: dto.shippingAddress,
            city: dto.city,
            postalCode: dto.postalCode,
            country: dto.country,
            couponCode: dto.couponCode,
            acceptedTerms: true,
        });
        const orderIds = orderResult.orders.map((order: any) => order.id);
        const merchantOrderReference = this.buildMerchantOrderReference(orderIds);
        const cartSplitPlan = await this.buildCartSplitPlan(
            checkoutSummaryUsd.seller_groups,
            sellerProfiles,
            paymentCurrency,
            new Map(orderResult.orders.map((order: any) => [order.sellerId, order.id])),
        );

        try {
            const applicationData = await this.buildApplicationData({
                user,
                orderReference: merchantOrderReference,
                summaryUsd: checkoutSummaryUsd,
                successUrl: dto.successUrl,
                failUrl: dto.failUrl,
                period: dto.period,
                bnpl: dto.bnpl,
                checkoutAddress: dto,
            });
            const response = await this.client.registerApplication(applicationData);
            const tbiOrderId = this.extractTbiOrderId(response);
            const token = this.extractTbiToken(response);
            const url = this.extractTbiUrl(response);

            const transaction = await this.paymentService.createPendingTransaction({
                userId,
                orderId: orderIds[0],
                amount: amountTotal,
                currency: paymentCurrency,
                provider: PaymentProvider.TBI_CREDIT,
                providerReferenceId: merchantOrderReference,
                providerRedirectUrl: url,
                providerStatus: "registered",
                providerPayload: response as Prisma.JsonValue,
                metadata: {
                    checkoutMode: "cart",
                    orderIds: orderIds.join(","),
                    cartId: String(orderResult.cart_id),
                    cartItemIds: orderResult.cart_item_ids.join(","),
                    couponId: orderResult.coupon_id ? String(orderResult.coupon_id) : "",
                    merchantOrderReference,
                    tbiOrderId,
                    tbiToken: token,
                    tbiCountry: this.client.country,
                    total: amountTotal,
                    totalUsd: checkoutSummaryUsd.price_details.total,
                    currency: paymentCurrency,
                    cartSplitPlan,
                },
            });

            return {
                transaction_id: transaction.id,
                provider: "tbi_credit",
                tbi_order_id: tbiOrderId,
                merchant_order_reference: merchantOrderReference,
                token,
                url,
                currency: paymentCurrency,
                amount_total: amountTotal,
                amount_total_usd: checkoutSummaryUsd.price_details.total,
                pending_orders: orderResult.orders,
                checkout_summary: await this.orderService.getCheckoutSummary(userId, {
                    sellerIds: dto.sellerIds,
                    cartItemIds: dto.cartItemIds,
                    addressId: dto.addressId,
                    country: dto.country,
                    couponCode: dto.couponCode,
                }),
            };
        } catch (error) {
            await this.orderService.cancelPendingPaymentOrders(orderIds, "TBI Credit application could not be created.");
            throw error;
        }
    }

    async createBuyNowSession(userId: number, dto: CreateTbiBuyNowSessionDto) {
        this.assertAcceptedTerms(dto.acceptedTerms);
        if (dto.sellerIds?.length || dto.cartItemIds?.length) {
            throw new BadRequestException("Use productId for TBI Buy Now, not sellerIds or cartItemIds.");
        }

        const user = await this.getBuyer(userId);
        const checkoutSummaryUsd = await this.orderService.getBuyNowCheckoutSummaryForPayment(userId, dto);
        this.assertSupportedTbiCurrency();

        const amountTotal = await this.convertUsdToTbiCurrency(checkoutSummaryUsd.price_details.total);
        const paymentCurrency = this.client.currency.toLowerCase();
        const sellerId = checkoutSummaryUsd.seller_groups[0].seller.id;
        const sellerProfile = await this.getSellerPaymentProfile(sellerId);
        const split = await this.buildSplitForAmount(amountTotal, sellerProfile.seller_tier);

        const orderResult = await this.orderService.createPendingBuyNowOrder(userId, {
            productId: dto.productId,
            addressId: dto.addressId,
            shippingAddress: dto.shippingAddress,
            city: dto.city,
            postalCode: dto.postalCode,
            country: dto.country,
            couponCode: dto.couponCode,
            acceptedTerms: true,
        });
        const orderId = orderResult.order.id;
        const merchantOrderReference = this.buildMerchantOrderReference([orderId]);

        try {
            const applicationData = await this.buildApplicationData({
                user,
                orderReference: merchantOrderReference,
                summaryUsd: checkoutSummaryUsd,
                successUrl: dto.successUrl,
                failUrl: dto.failUrl,
                period: dto.period,
                bnpl: dto.bnpl,
                checkoutAddress: dto,
            });
            const response = await this.client.registerApplication(applicationData);
            const tbiOrderId = this.extractTbiOrderId(response);
            const token = this.extractTbiToken(response);
            const url = this.extractTbiUrl(response);

            const transaction = await this.paymentService.createPendingTransaction({
                userId,
                orderId,
                amount: amountTotal,
                currency: paymentCurrency,
                provider: PaymentProvider.TBI_CREDIT,
                providerReferenceId: merchantOrderReference,
                providerRedirectUrl: url,
                providerStatus: "registered",
                providerPayload: response as Prisma.JsonValue,
                metadata: {
                    checkoutMode: "buy_now",
                    orderId: String(orderId),
                    productId: String(dto.productId),
                    sellerId: String(sellerId),
                    couponId: orderResult.coupon_id ? String(orderResult.coupon_id) : "",
                    merchantOrderReference,
                    tbiOrderId,
                    tbiToken: token,
                    tbiCountry: this.client.country,
                    total: amountTotal,
                    totalUsd: checkoutSummaryUsd.price_details.total,
                    currency: paymentCurrency,
                    platformFeePercent: split.platformFeePercent,
                    platformFeeAmount: split.platformFeeAmount,
                    sellerTransferAmount: split.sellerTransferAmount,
                },
            });

            return {
                transaction_id: transaction.id,
                provider: "tbi_credit",
                tbi_order_id: tbiOrderId,
                merchant_order_reference: merchantOrderReference,
                token,
                url,
                currency: paymentCurrency,
                amount_total: amountTotal,
                amount_total_usd: checkoutSummaryUsd.price_details.total,
                pending_order: orderResult.order,
                checkout_summary: await this.orderService.getBuyNowCheckoutSummary(userId, dto),
            };
        } catch (error) {
            await this.orderService.cancelPendingPaymentOrders([orderId], "TBI Credit application could not be created.");
            throw error;
        }
    }

    async getStatus(userId: number, referenceId: string) {
        const transaction = await this.findTbiTransaction(referenceId);
        if (transaction.userId !== userId) {
            throw new ForbiddenException("You do not have permission to access this TBI Credit transaction.");
        }
        const metadata = this.toMetadataObject(transaction.metadata);
        const tbiOrderId = this.getMetadataString(metadata.tbiOrderId) ?? transaction.provider_reference_id;
        const token = this.getMetadataString(metadata.tbiToken);

        if (!tbiOrderId || !token) {
            return this.formatTransactionStatus(transaction);
        }

        const statusPayload = await this.client.getApplicationStatus(tbiOrderId, token);
        return this.applyProviderStatus(transaction.id, statusPayload);
    }

    async handleStatusUpdate(payload: Record<string, any>, rawBody?: Buffer, signature?: string) {
        this.verifyWebhookSignature(rawBody, signature);
        const tbiOrderId = this.getProviderValue(payload, ["OrderId", "order_id", "orderId"]);
        const applicationId = this.getProviderValue(payload, ["CreditApplicationId", "credit_application_id", "applicationId"]);

        if (!tbiOrderId && !applicationId) {
            throw new BadRequestException("TBI status update is missing OrderId or CreditApplicationId.");
        }

        const transaction = tbiOrderId
            ? await this.paymentService.findByProviderReferenceId(tbiOrderId)
            : applicationId
              ? await this.paymentService.findByProviderApplicationId(applicationId)
              : null;

        if (!transaction) {
            throw new NotFoundException("No TBI payment transaction was found for this status update.");
        }

        return this.applyProviderStatus(transaction.id, payload);
    }

    async markRefundRequiresManualProcessing(returnRequestId: number, requestedAmount?: number) {
        const request = await this.prismaService.returnRequest.findUnique({
            where: { id: returnRequestId },
            include: { orderItem: { include: { order: true } } },
        });
        if (!request) {
            throw new NotFoundException(`Return request with ID ${returnRequestId} not found`);
        }

        const transaction = await this.findTransactionForOrder(request.orderItem.order.id);
        if (!transaction || transaction.provider !== PaymentProvider.TBI_CREDIT) {
            return null;
        }
        const metadata = this.toMetadataObject(transaction.metadata);

        throw new BadRequestException({
            message: "This order was financed with TBI Credit. Process the refund/cancellation in the TBI merchant portal or with TBI support, then update the return after the bank confirms it.",
            provider: "tbi_credit",
            transaction_id: transaction.id,
            tbi_order_id: metadata.tbiOrderId ?? null,
            merchant_order_reference: transaction.provider_reference_id,
            requested_refund_amount: requestedAmount ?? request.orderItem.price,
            currency: transaction.currency,
        });
    }

    private async applyProviderStatus(transactionId: number, payload: Record<string, any>) {
        const transaction = await this.prismaService.paymentTransaction.findUnique({ where: { id: transactionId } });
        if (!transaction) {
            throw new NotFoundException(`Payment transaction with ID ${transactionId} not found`);
        }

        const metadata = this.toMetadataObject(transaction.metadata);
        const state = this.normalizePaymentState(payload);
        const providerStatus = this.getProviderStatusLabel(payload);
        const applicationId = this.getProviderValue(payload, ["CreditApplicationId", "credit_application_id", "applicationId"]);

        if (state === "approved") {
            if (transaction.status !== PaymentStatus.SUCCEEDED) {
                const orderIds = this.getOrderIdsFromMetadata(metadata);
                await this.orderService.finalizePaidOrders({
                    orderIds,
                    cartId: this.numberFromMetadata(metadata.cartId),
                    cartItemIds: this.numberArrayFromMetadata(metadata.cartItemIds),
                    couponId: this.numberFromMetadata(metadata.couponId),
                });
            }

            const updated = await this.paymentService.updateProviderStatus(transaction.id, {
                status: PaymentStatus.SUCCEEDED,
                providerStatus,
                providerApplicationId: applicationId ?? transaction.provider_application_id ?? undefined,
                providerPayload: payload as Prisma.JsonValue,
                paymentStatus: "approved",
                metadata: {
                    ...metadata,
                    approvedAt: metadata.approvedAt ?? new Date().toISOString(),
                    creditApplicationId: applicationId ?? metadata.creditApplicationId ?? null,
                    contractNumber: this.getProviderValue(payload, ["ContractNumber", "contract_number"]) ?? metadata.contractNumber ?? null,
                    latestStatusUpdate: payload,
                },
            });

            return this.formatTransactionStatus(updated);
        }

        if (state === "cancelled" || state === "rejected" || state === "failed") {
            if (transaction.status !== PaymentStatus.CANCELLED && transaction.status !== PaymentStatus.FAILED) {
                await this.orderService.cancelPendingPaymentOrders(
                    this.getOrderIdsFromMetadata(metadata),
                    `TBI Credit application ${state}.`,
                );
            }

            const updated = await this.paymentService.updateProviderStatus(transaction.id, {
                status: state === "rejected" || state === "failed" ? PaymentStatus.FAILED : PaymentStatus.CANCELLED,
                providerStatus,
                providerApplicationId: applicationId ?? transaction.provider_application_id ?? undefined,
                providerPayload: payload as Prisma.JsonValue,
                paymentStatus: state,
                metadata: {
                    ...metadata,
                    cancelledAt: metadata.cancelledAt ?? new Date().toISOString(),
                    creditApplicationId: applicationId ?? metadata.creditApplicationId ?? null,
                    latestStatusUpdate: payload,
                },
            });

            return this.formatTransactionStatus(updated);
        }

        const updated = await this.paymentService.updateProviderStatus(transaction.id, {
            status: PaymentStatus.PROCESSING,
            providerStatus,
            providerApplicationId: applicationId ?? transaction.provider_application_id ?? undefined,
            providerPayload: payload as Prisma.JsonValue,
            paymentStatus: "pending",
            metadata: {
                ...metadata,
                creditApplicationId: applicationId ?? metadata.creditApplicationId ?? null,
                latestStatusUpdate: payload,
            },
        });

        return this.formatTransactionStatus(updated);
    }

    private async resolveCalculationSource(userId: number, dto: TbiCalculationsQueryDto) {
        if (dto.amount !== undefined) {
            return { amountUsd: dto.amount, categoryId: dto.categoryId ?? null };
        }

        if (dto.productId) {
            const summary = await this.orderService.getBuyNowCheckoutSummaryForPayment(userId, {
                productId: dto.productId,
                addressId: dto.addressId,
                country: dto.country,
                couponCode: dto.couponCode,
            });
            const firstItem = summary.seller_groups[0]?.items[0];
            return {
                amountUsd: summary.price_details.total,
                categoryId: firstItem?.product?.categoryId ?? null,
            };
        }

        const query: CheckoutSummaryQueryDto = {
            sellerIds: dto.sellerIds,
            cartItemIds: dto.cartItemIds,
            addressId: dto.addressId,
            country: dto.country,
            couponCode: dto.couponCode,
        };
        const summary = await this.orderService.getCheckoutSummaryForPayment(userId, query);
        const firstItem = summary.seller_groups[0]?.items[0];
        return {
            amountUsd: summary.price_details.total,
            categoryId: firstItem?.product?.categoryId ?? null,
        };
    }

    private normalizeCalculations(rawSchemes: any, amount: number) {
        const schemes = Array.isArray(rawSchemes) ? rawSchemes : [];
        return schemes.map((scheme) => {
            const analysisFee = this.roundMoney(Number(scheme.analysis_fee) || 0);
            const installmentFactor = Number(scheme.installment_factor) || 0;
            const totalDueFactor = Number(scheme.total_due_factor) || 0;
            const installment =
                this.client.country === "RO"
                    ? this.roundMoney((amount + analysisFee) * installmentFactor)
                    : this.roundMoney(amount * installmentFactor);

            return {
                id: scheme.id ?? scheme.scheme_id,
                scheme_id: scheme.scheme_id ?? scheme.id,
                name: scheme.name,
                period: Number(scheme.period) || null,
                installment,
                total_due: totalDueFactor ? this.roundMoney(amount * totalDueFactor + analysisFee) : null,
                nir: Number(scheme.nir) || 0,
                apr: scheme.apr !== undefined ? Number(scheme.apr) || 0 : null,
                amount_min: Number(scheme.amount_min) || null,
                amount_max: Number(scheme.amount_max) || null,
                category_id: scheme.category_id ?? null,
                bank_product: scheme.bank_product ?? null,
                promo_code: scheme.promo_code ?? null,
                ftos_product: scheme.ftos_product ?? null,
                analysis_fee: analysisFee,
                insurance: scheme.insurance !== undefined ? Number(scheme.insurance) || 0 : null,
                raw: scheme,
            };
        });
    }

    private async buildApplicationData(params: {
        user: any;
        orderReference: string;
        summaryUsd: any;
        successUrl: string;
        failUrl: string;
        period?: number;
        bnpl?: boolean;
        checkoutAddress?: {
            addressId?: number;
            shippingAddress?: string;
            city?: string;
            postalCode?: string;
            country?: string;
        };
    }) {
        const items = await this.buildTbiItems(params.summaryUsd);
        const profile = params.user.profile;
        const address = this.resolveApplicationAddress(params.user, params.summaryUsd, params.checkoutAddress);

        return {
            orderid: params.orderReference,
            firstname: this.firstName(profile?.full_name),
            lastname: this.lastName(profile?.full_name),
            surname: "",
            email: params.user.email,
            phone: profile?.phone ?? "",
            deliveryaddress: {
                country: address.country ?? profile?.country ?? "",
                county: "",
                city: address.city ?? "",
                streetname: address.address ?? "",
                streetno: "",
                buildingno: "",
                entranceno: "",
                floorno: "",
                apartmentno: "",
                postalcode: address.postal_code ?? "",
            },
            items,
            ...(params.period ? { period: params.period } : {}),
            ...(params.bnpl !== undefined ? { bnpl: params.bnpl ? 1 : 0 } : {}),
            ...(this.client.country === "BG" ? { currency: this.client.currency } : {}),
            successRedirectURL: params.successUrl,
            failRedirectURL: params.failUrl,
            statusURL: this.getStatusUrl(),
        };
    }

    private async buildTbiItems(summaryUsd: any) {
        const tbiItems: any[] = [];
        for (const group of summaryUsd.seller_groups) {
            for (const item of group.items) {
                tbiItems.push({
                    name: item.product.name,
                    description: "",
                    qty: 1,
                    price: await this.convertUsdToTbiCurrency(item.price),
                    sku: String(item.productId),
                    category: String(item.product.categoryId ?? item.product.subCategoryId ?? 0),
                    imagelink: this.toAbsoluteImageUrl(item.product.image_url ?? item.product.image_urls?.[0]),
                });
            }
            if (group.delivery_cost > 0) {
                tbiItems.push({
                    name: `Delivery - ${group.seller.name}`,
                    description: group.delivery?.partner ?? "",
                    qty: 1,
                    price: await this.convertUsdToTbiCurrency(group.delivery_cost),
                    sku: `delivery-${group.seller.id}`,
                    category: String(group.items[0]?.product?.categoryId ?? 0),
                    imagelink: this.toAbsoluteImageUrl(group.items[0]?.product?.image_url),
                });
            }
        }
        return tbiItems;
    }

    private resolveApplicationAddress(
        user: any,
        summaryUsd: any,
        checkoutAddress?: {
            addressId?: number;
            shippingAddress?: string;
            city?: string;
            postalCode?: string;
            country?: string;
        },
    ) {
        const selectedAddress =
            summaryUsd.selected_address ??
            (checkoutAddress?.addressId
                ? user.addresses?.find((address: any) => address.id === checkoutAddress.addressId)
                : null);

        if (selectedAddress) {
            return {
                country: selectedAddress.country,
                city: selectedAddress.city,
                address: selectedAddress.address,
                postal_code: selectedAddress.postal_code,
            };
        }

        return {
            country: checkoutAddress?.country,
            city: checkoutAddress?.city,
            address: checkoutAddress?.shippingAddress,
            postal_code: checkoutAddress?.postalCode,
        };
    }

    private async convertUsdToTbiCurrency(amount: number) {
        const currency = this.currencyPreferenceFromString(this.client.currency);
        if (currency === CurrencyPreference.USD) {
            return this.roundMoney(amount);
        }
        return this.currencyService.convertAsync(amount, CurrencyPreference.USD, currency);
    }

    private currencyPreferenceFromString(currency?: string | null): CurrencyPreference {
        const normalized = String(currency || CurrencyPreference.USD).toUpperCase();
        if (Object.values(CurrencyPreference).includes(normalized as CurrencyPreference)) {
            return normalized as CurrencyPreference;
        }
        throw new BadRequestException(`Currency ${normalized} is not supported by the local currency converter.`);
    }

    private assertSupportedTbiCurrency() {
        this.currencyPreferenceFromString(this.client.currency);
    }

    private async buildCartSplitPlan(
        groups: any[],
        sellers: Map<number, { seller_tier: SellerTier }>,
        currency: string,
        orderIdBySellerId: Map<number, number>,
    ) {
        return Promise.all(groups.map(async (group) => {
            const seller = sellers.get(group.seller.id);
            if (!seller) {
                throw new BadRequestException(`Could not prepare TBI settlement split for seller ${group.seller.id}.`);
            }
            const orderTotal = await this.convertUsdToTbiCurrency(group.total);
            const split = this.calculatePaymentSplit(orderTotal, seller.seller_tier);
            return {
                orderId: orderIdBySellerId.get(group.seller.id) ?? null,
                sellerId: group.seller.id,
                sellerTier: seller.seller_tier,
                totalUsd: group.total,
                orderTotal,
                orderTotalUsd: group.total,
                currency,
                ...split,
            };
        }));
    }

    private async buildSplitForAmount(amount: number, sellerTier: SellerTier) {
        return this.calculatePaymentSplit(amount, sellerTier);
    }

    private calculatePaymentSplit(amount: number, sellerTier: SellerTier) {
        const platformFeePercent = this.getSellerFeePercent(sellerTier);
        const platformFeeAmount = this.roundMoney((amount * platformFeePercent) / 100);
        return {
            platformFeePercent,
            platformFeeAmount,
            sellerTransferAmount: this.roundMoney(Math.max(0, amount - platformFeeAmount)),
        };
    }

    private getSellerFeePercent(sellerTier: SellerTier) {
        const configuredPercent = Number(
            {
                [SellerTier.BASIC_SELLER]: process.env.STRIPE_BASIC_SELLER_FEE_PERCENT ?? 10,
                [SellerTier.STANDARD_SELLER]: process.env.STRIPE_STANDARD_SELLER_FEE_PERCENT ?? 10,
                [SellerTier.PREMIUM_SELLER]: process.env.STRIPE_PREMIUM_SELLER_FEE_PERCENT ?? 10,
            }[sellerTier],
        );
        if (!Number.isFinite(configuredPercent) || configuredPercent < 0 || configuredPercent > 100) {
            throw new BadRequestException("Seller fee percent must be a number between 0 and 100.");
        }
        return configuredPercent;
    }

    private async getSellerPaymentProfiles(sellerIds: number[]) {
        const sellers = await this.prismaService.baseUser.findMany({
            where: { id: { in: [...new Set(sellerIds)] } },
            select: { id: true, seller_tier: true, stripe_account_id: true, stripe_onboarding_complete: true },
        });

        for (const seller of sellers) {
            if (!seller.stripe_onboarding_complete || !seller.stripe_account_id) {
                throw new ForbiddenException(`Seller ${seller.id} has not completed payment setup.`);
            }
        }

        return new Map(sellers.map((seller) => [seller.id, seller]));
    }

    private async getSellerPaymentProfile(sellerId: number) {
        const profiles = await this.getSellerPaymentProfiles([sellerId]);
        const profile = profiles.get(sellerId);
        if (!profile) {
            throw new NotFoundException(`Seller with ID ${sellerId} not found`);
        }
        return profile;
    }

    private async getBuyer(userId: number) {
        const user = await this.prismaService.baseUser.findUnique({
            where: { id: userId },
            include: { profile: true, addresses: true },
        });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }
        return user;
    }

    private async findTbiTransaction(referenceId: string) {
        const transaction =
            (await this.paymentService.findByProviderReferenceId(referenceId)) ??
            (await this.paymentService.findByProviderApplicationId(referenceId)) ??
            (Number.isInteger(Number(referenceId))
                ? await this.prismaService.paymentTransaction.findFirst({
                      where: { id: Number(referenceId), provider: PaymentProvider.TBI_CREDIT },
                  })
                : null);

        if (!transaction || transaction.provider !== PaymentProvider.TBI_CREDIT) {
            throw new NotFoundException("TBI Credit payment transaction not found.");
        }
        return transaction;
    }

    private async findTransactionForOrder(orderId: number) {
        const direct = await this.prismaService.paymentTransaction.findFirst({
            where: {
                orderId,
                status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PROCESSING, PaymentStatus.PENDING, PaymentStatus.REFUNDED] },
            },
            orderBy: { createdAt: "desc" },
        });
        if (direct) {
            return direct;
        }

        const transactions = await this.prismaService.paymentTransaction.findMany({
            where: { status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PROCESSING, PaymentStatus.PENDING, PaymentStatus.REFUNDED] } },
            orderBy: { createdAt: "desc" },
        });
        return transactions.find((transaction) => this.getOrderIdsFromMetadata(this.toMetadataObject(transaction.metadata)).includes(orderId)) ?? null;
    }

    private normalizePaymentState(payload: Record<string, any>): TbiPaymentState {
        const value = this.getProviderStatusLabel(payload).toLowerCase();
        if (value.includes("approved") || value === "3" || value === "paid") {
            return "approved";
        }
        if (value.includes("cancel")) {
            return "cancelled";
        }
        if (value.includes("reject")) {
            return "rejected";
        }
        if (value.includes("fail") || value.includes("error")) {
            return "failed";
        }
        return "pending";
    }

    private getProviderStatusLabel(payload: Record<string, any>) {
        return String(
            this.getProviderValue(payload, ["Message", "message", "Status", "status", "statusText"]) ?? "pending",
        );
    }

    private getProviderValue(payload: Record<string, any>, keys: string[]) {
        for (const key of keys) {
            const value = payload?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== "") {
                return String(value);
            }
        }
        return undefined;
    }

    private getOrderIdsFromMetadata(metadata: Record<string, any>) {
        const orderIds = this.getMetadataString(metadata.orderIds)
            ?.split(",")
            .map((id) => Number(id.trim()))
            .filter((id) => Number.isInteger(id) && id > 0);
        const orderId = this.numberFromMetadata(metadata.orderId);
        return orderIds?.length ? orderIds : orderId ? [orderId] : [];
    }

    private buildMerchantOrderReference(orderIds: number[]) {
        return orderIds.length === 1 ? String(orderIds[0]) : orderIds.join("-");
    }

    private extractTbiOrderId(response: any) {
        const orderId = response?.order_id ?? response?.orderId ?? response?.OrderId;
        if (!orderId) {
            throw new BadRequestException("TBI did not return an order_id.");
        }
        return String(orderId);
    }

    private extractTbiToken(response: any) {
        return response?.token ? String(response.token) : undefined;
    }

    private extractTbiUrl(response: any) {
        const url = response?.url ?? response?.redirect_url ?? response?.application_url;
        if (!url) {
            throw new BadRequestException("TBI did not return an application URL.");
        }
        return String(url);
    }

    private getStatusUrl() {
        const baseUrl = process.env.SWAGGER_SERVER_URL ?? process.env.APP_URL;
        return baseUrl ? `${baseUrl.replace(/\/+$/, "")}/tbi-credit/webhook` : "";
    }

    private firstName(fullName?: string | null) {
        return fullName?.trim().split(/\s+/)[0] ?? "";
    }

    private lastName(fullName?: string | null) {
        const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
        return parts.length > 1 ? parts.slice(1).join(" ") : "";
    }

    private toAbsoluteImageUrl(imageUrl?: string | null) {
        const trimmedUrl = imageUrl?.trim();
        if (!trimmedUrl) {
            return "";
        }
        if (/^https?:\/\//i.test(trimmedUrl)) {
            return trimmedUrl;
        }
        if (!trimmedUrl.startsWith("/")) {
            return "";
        }
        const baseUrl = process.env.SWAGGER_SERVER_URL?.trim();
        return baseUrl ? `${baseUrl.replace(/\/+$/, "")}${trimmedUrl}` : "";
    }

    private verifyWebhookSignature(rawBody?: Buffer, signature?: string) {
        if (!this.config.webhook_secret) {
            return;
        }
        if (!rawBody || !signature) {
            throw new UnauthorizedException("Missing TBI webhook signature.");
        }

        const expected = createHmac("sha256", this.config.webhook_secret).update(rawBody).digest("hex");
        const received = signature.replace(/^sha256=/i, "");
        const expectedBuffer = Buffer.from(expected);
        const receivedBuffer = Buffer.from(received);
        if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
            throw new UnauthorizedException("Invalid TBI webhook signature.");
        }
    }

    private formatTransactionStatus(transaction: any) {
        const metadata = this.toMetadataObject(transaction.metadata);
        return {
            transaction_id: transaction.id,
            provider: "tbi_credit",
            status: transaction.status,
            payment_status: transaction.payment_status,
            provider_status: transaction.provider_status,
            tbi_order_id: metadata.tbiOrderId ?? null,
            merchant_order_reference: transaction.provider_reference_id,
            credit_application_id: transaction.provider_application_id,
            redirect_url: transaction.provider_redirect_url,
            amount: transaction.amount,
            currency: transaction.currency,
            metadata: transaction.metadata,
        };
    }

    private numberFromMetadata(value: unknown) {
        if (value === null || value === undefined || value === "") {
            return undefined;
        }
        const numberValue = Number(value);
        return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
    }

    private numberArrayFromMetadata(value: unknown) {
        return this.getMetadataString(value)
            ?.split(",")
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isInteger(item) && item > 0);
    }

    private getMetadataString(value: unknown) {
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
    }

    private toMetadataObject(metadata: unknown): Record<string, any> {
        return metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? (metadata as Record<string, any>)
            : {};
    }

    private assertAcceptedTerms(acceptedTerms: boolean) {
        if (!acceptedTerms) {
            throw new BadRequestException("You must agree to the Terms & Conditions and Privacy Policy before financing.");
        }
    }

    private roundMoney(value: number) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }
}
