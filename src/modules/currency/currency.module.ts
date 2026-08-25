import { Module } from "@nestjs/common";
import { CurrencyConversionService } from "./currency.service";

@Module({
    providers: [CurrencyConversionService],
    exports: [CurrencyConversionService],
})
export class CurrencyModule {}
