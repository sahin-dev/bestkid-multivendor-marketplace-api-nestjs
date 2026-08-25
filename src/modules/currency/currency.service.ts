import { Injectable, Logger } from "@nestjs/common";
import { CurrencyPreference } from "generated/prisma/client";

type CurrencyRateMap = Record<CurrencyPreference, number>;

@Injectable()
export class CurrencyConversionService {
    private readonly logger = new Logger(CurrencyConversionService.name);
    private readonly baseCurrency: CurrencyPreference = CurrencyPreference.USD;
    private readonly cacheTtlMs = Number(process.env.EXCHANGE_RATE_CACHE_TTL_MS ?? 60 * 60 * 1000);
    private readonly apiUrl = process.env.EXCHANGE_RATE_API_URL ?? "https://api.frankfurter.app/latest";
    private readonly fallbackRates: CurrencyRateMap = {
        USD: 1,
        EUR: 0.92,
        AED: 3.67,
        GBP: 0.79,
        RON: 4.58,
    };
    private cache: CurrencyRateMap = { ...this.fallbackRates };
    private cacheExpiryMs = 0;

    convert(amount: number, fromCurrency: CurrencyPreference, toCurrency: CurrencyPreference): number {
        if (fromCurrency === toCurrency) {
            return Number(amount.toFixed(2));
        }

        const snapshot = this.cache;
        const fromRate = snapshot[fromCurrency] ?? this.fallbackRates[fromCurrency] ?? 1;
        const toRate = snapshot[toCurrency] ?? this.fallbackRates[toCurrency] ?? 1;

        const baseInUsd = amount / fromRate;
        const converted = baseInUsd * toRate;

        return Number(converted.toFixed(2));
    }

    async convertAsync(amount: number, fromCurrency: CurrencyPreference, toCurrency: CurrencyPreference): Promise<number> {
        if (fromCurrency === toCurrency) {
            return Number(amount.toFixed(2));
        }

        const rates = await this.ensureRatesLoaded();
        const fromRate = rates[fromCurrency] ?? this.fallbackRates[fromCurrency] ?? 1;
        const toRate = rates[toCurrency] ?? this.fallbackRates[toCurrency] ?? 1;

        const baseInUsd = amount / fromRate;
        const converted = baseInUsd * toRate;

        return Number(converted.toFixed(2));
    }

    async convertPrice(
        amount: number | null | undefined,
        fromCurrency: CurrencyPreference,
        toCurrency: CurrencyPreference,
    ): Promise<number | null> {
        if (amount === null || amount === undefined) {
            return null;
        }

        return this.convertAsync(amount, fromCurrency, toCurrency);
    }

    private async ensureRatesLoaded(): Promise<CurrencyRateMap> {
        if (Date.now() < this.cacheExpiryMs) {
            return this.cache;
        }

        const freshRates = await this.loadRatesFromProvider();
        this.cache = freshRates;
        this.cacheExpiryMs = Date.now() + this.cacheTtlMs;

        return this.cache;
    }

    private async loadRatesFromProvider(): Promise<CurrencyRateMap> {
        const targetCurrencies = [CurrencyPreference.EUR, CurrencyPreference.AED, CurrencyPreference.GBP, CurrencyPreference.RON];
        const currencyQuery = targetCurrencies.join(",");

        try {
            const response = await fetch(`${this.apiUrl}?from=${this.baseCurrency}&to=${currencyQuery}`);
            if (!response.ok) {
                throw new Error(`Exchange rate provider responded with ${response.status}`);
            }

            const payload = await response.json();
            const latestRates = payload?.rates ?? {};
            const merged: CurrencyRateMap = { ...this.fallbackRates };

            for (const currency of targetCurrencies) {
                const rate = Number(latestRates[currency]);
                if (Number.isFinite(rate) && rate > 0) {
                    merged[currency] = rate;
                }
            }

            return merged;
        } catch (error) {
            this.logger.warn(
                "Live exchange rate fetch failed; falling back to cached/static rates for pricing conversion.",
                error instanceof Error ? error.message : String(error),
            );
            return { ...this.fallbackRates };
        }
    }
}
