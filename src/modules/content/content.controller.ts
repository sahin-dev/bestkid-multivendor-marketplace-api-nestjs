import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public, Roles } from "src/common/decorators";
import { ContentService } from "./content.service";
import { CreateFaqCategoryDto } from "./dtos/create-faq-category.dto";
import { CreateFaqDto } from "./dtos/create-faq.dto";
import { UpdateFaqDto } from "./dtos/update-faq.dto";
import { UpsertLegalDto } from "./dtos/upsert-legal.dto";
import { UpsertCompanyInfoDto } from "./dtos/upsert-company-info.dto";
import { CreateContactRequestDto } from "./dtos/create-contact-request.dto";
import { ReplyContactRequestDto } from "./dtos/reply-contact-request.dto";
import { LegalDocumentType } from "generated/prisma/client";

@ApiTags("Content")
@Controller("content")
export class ContentController {
    constructor(private readonly contentService: ContentService) {}

    // ─── FAQ Categories ──────────────────────────────────────────────────────────

    @Get("faq/categories")
    @Public()
    getFaqCategories() {
        return this.contentService.getFaqCategories();
    }

    @Post("faq/categories")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiBody({ type: CreateFaqCategoryDto })
    createFaqCategory(@Body() dto: CreateFaqCategoryDto) {
        return this.contentService.createFaqCategory(dto);
    }

    // ─── FAQ ─────────────────────────────────────────────────────────────────────

    @Get("faq")
    @Public()
    getFaqs() {
        return this.contentService.getFaqs();
    }

    @Post("faq")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiBody({ type: CreateFaqDto })
    createFaq(@Body() dto: CreateFaqDto) {
        return this.contentService.createFaq(dto);
    }

    @Patch("faq/:id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateFaqDto })
    updateFaq(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateFaqDto) {
        return this.contentService.updateFaq(id, dto);
    }

    @Delete("faq/:id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    deleteFaq(@Param("id", ParseIntPipe) id: number) {
        return this.contentService.deleteFaq(id);
    }

    // ─── Legal Documents ─────────────────────────────────────────────────────────

    @Get("legal/:type")
    @Public()
    @ApiParam({ name: "type", enum: LegalDocumentType })
    getLegalDocument(@Param("type") type: LegalDocumentType) {
        return this.contentService.getLegalDocument(type);
    }

    @Patch("legal/:type")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "type", enum: LegalDocumentType })
    @ApiBody({ type: UpsertLegalDto })
    upsertLegalDocument(@Param("type") type: LegalDocumentType, @Body() dto: UpsertLegalDto) {
        return this.contentService.upsertLegalDocument(type, dto);
    }

    // ─── Company Info ────────────────────────────────────────────────────────────

    @Get("company")
    @Public()
    getCompanyInfo() {
        return this.contentService.getCompanyInfo();
    }

    @Patch("company")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiBody({ type: UpsertCompanyInfoDto })
    upsertCompanyInfo(@Body() dto: UpsertCompanyInfoDto) {
        return this.contentService.upsertCompanyInfo(dto);
    }

    // ─── Contact Requests ────────────────────────────────────────────────────────

    @Post("contact")
    @Public()
    @ApiBody({ type: CreateContactRequestDto })
    submitContactRequest(@Body() dto: CreateContactRequestDto) {
        return this.contentService.submitContactRequest(dto);
    }

    @Get("contact/admin")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    findAllContactRequests(
        @Query("page") page?: number,
        @Query("limit") limit?: number,
    ) {
        return this.contentService.findAllContactRequests(page ? Number(page) : 1, limit ? Number(limit) : 10);
    }

    @Patch("contact/admin/:id/reply")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: ReplyContactRequestDto })
    replyToContactRequest(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: ReplyContactRequestDto,
    ) {
        return this.contentService.replyToContactRequest(id, dto);
    }
}
