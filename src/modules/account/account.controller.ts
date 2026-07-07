import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { GetUser } from "src/common/decorators";
import { AccountService } from "./account.service";
import { CreateAccountAddressDto, UpdateAccountAddressDto } from "./dtos/account-address.dto";
import { DeleteAccountDto } from "./dtos/delete-account.dto";
import { UpdateCurrencyPreferenceDto, UpdateLanguagePreferenceDto } from "./dtos/account-preference.dto";

@ApiTags("Account Settings")
@Controller("account")
@ApiBearerAuth("access-token")
export class AccountController {
    constructor(private readonly accountService: AccountService) {}

    @Get("settings")
    @ApiOperation({ summary: "Get account settings, preferences, addresses, and connected account status" })
    @ApiResponse({ status: 200, description: "Account settings payload for the settings page" })
    getSettings(@GetUser("id") userId: number) {
        return this.accountService.getSettings(userId);
    }

    @Get("addresses")
    @ApiOperation({ summary: "List saved addresses" })
    listAddresses(@GetUser("id") userId: number) {
        return this.accountService.listAddresses(userId);
    }

    @Post("addresses")
    @ApiOperation({ summary: "Create a saved address" })
    @ApiBody({ type: CreateAccountAddressDto })
    createAddress(@GetUser("id") userId: number, @Body() dto: CreateAccountAddressDto) {
        return this.accountService.createAddress(userId, dto);
    }

    @Patch("addresses/:id")
    @ApiOperation({ summary: "Update a saved address" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateAccountAddressDto })
    updateAddress(
        @GetUser("id") userId: number,
        @Param("id", ParseIntPipe) addressId: number,
        @Body() dto: UpdateAccountAddressDto,
    ) {
        return this.accountService.updateAddress(userId, addressId, dto);
    }

    @Delete("addresses/:id")
    @ApiOperation({ summary: "Delete a saved address" })
    @ApiParam({ name: "id", type: Number })
    deleteAddress(@GetUser("id") userId: number, @Param("id", ParseIntPipe) addressId: number) {
        return this.accountService.deleteAddress(userId, addressId);
    }

    @Patch("preferences/language")
    @ApiOperation({ summary: "Update language preference" })
    @ApiBody({ type: UpdateLanguagePreferenceDto })
    updateLanguage(@GetUser("id") userId: number, @Body() dto: UpdateLanguagePreferenceDto) {
        return this.accountService.updateLanguagePreference(userId, dto.language);
    }

    @Patch("preferences/currency")
    @ApiOperation({ summary: "Update currency preference" })
    @ApiBody({ type: UpdateCurrencyPreferenceDto })
    updateCurrency(@GetUser("id") userId: number, @Body() dto: UpdateCurrencyPreferenceDto) {
        return this.accountService.updateCurrencyPreference(userId, dto.currency);
    }

    @Get("connected-account")
    @ApiOperation({ summary: "Get connected Stripe account status for account settings" })
    getConnectedAccount(@GetUser("id") userId: number) {
        return this.accountService.getConnectedAccount(userId);
    }

    @Delete()
    @ApiOperation({ summary: "Delete authenticated account after password confirmation" })
    @ApiBody({ type: DeleteAccountDto })
    deleteAccount(@GetUser("id") userId: number, @Body() dto: DeleteAccountDto) {
        return this.accountService.deleteAccount(userId, dto.password);
    }
}
