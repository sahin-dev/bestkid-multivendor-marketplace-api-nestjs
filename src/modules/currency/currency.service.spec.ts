import { CurrencyPreference } from "generated/prisma/client";
import { CurrencyConversionService } from "./currency.service";

describe("CurrencyConversionService", () => {
  it("converts a base USD price into the requested currency", () => {
    const service = new CurrencyConversionService();

    expect(service.convert(100, CurrencyPreference.USD, CurrencyPreference.EUR)).toBeCloseTo(92, 2);
    expect(service.convert(100, CurrencyPreference.USD, CurrencyPreference.AED)).toBeCloseTo(367, 2);
    expect(service.convert(100, CurrencyPreference.USD, CurrencyPreference.GBP)).toBeCloseTo(79, 2);
  });

  it("returns the same value when converting to the same currency", () => {
    const service = new CurrencyConversionService();

    expect(service.convert(50, CurrencyPreference.EUR, CurrencyPreference.EUR)).toBe(50);
  });
});
