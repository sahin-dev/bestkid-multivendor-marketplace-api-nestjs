import { ApiProperty } from "@nestjs/swagger";
import { CurrencyPreference, LanguagePreference } from "generated/prisma/client";
import { IsEnum } from "class-validator";

export class UpdateLanguagePreferenceDto {
    @IsEnum(LanguagePreference)
    @ApiProperty({ enum: LanguagePreference, example: LanguagePreference.EN })
    language: LanguagePreference;
}

export class UpdateCurrencyPreferenceDto {
    @IsEnum(CurrencyPreference)
    @ApiProperty({ enum: CurrencyPreference, example: CurrencyPreference.USD })
    currency: CurrencyPreference;
}
