import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public, Roles } from "src/common/decorators";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { ContentService } from "./content.service";
import { CreateFaqCategoryDto } from "./dtos/create-faq-category.dto";
import { CreateFaqDto } from "./dtos/create-faq.dto";
import { UpdateFaqDto } from "./dtos/update-faq.dto";
import { UpsertLegalDto } from "./dtos/upsert-legal.dto";
import { UpsertCompanyInfoDto } from "./dtos/upsert-company-info.dto";
import { UpsertAboutUsDto } from "./dtos/upsert-about-us.dto";
import { CreateContactRequestDto } from "./dtos/create-contact-request.dto";
import { ReplyContactRequestDto } from "./dtos/reply-contact-request.dto";
import { LegalDocumentType } from "generated/prisma/client";
import { ContactRequestQueryDto, ContactStatusFilter } from "./dtos/contact-request-query.dto";

@ApiTags("Content")
@Controller("content")
export class ContentController {
    constructor(private readonly contentService: ContentService) {}

    // ─── FAQ Categories ──────────────────────────────────────────────────────────

    @Get("faq/categories")
    @Public()
    @ApiOperation({ summary: "List FAQ categories" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    getFaqCategories(@Query() query: PaginationDto) {
        return this.contentService.getFaqCategories(query);
    }

    @Post("faq/categories")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: create an FAQ category" })
    @ApiBody({ type: CreateFaqCategoryDto })
    createFaqCategory(@Body() dto: CreateFaqCategoryDto) {
        return this.contentService.createFaqCategory(dto);
    }

    // ─── FAQ ─────────────────────────────────────────────────────────────────────

    @Get("faq")
    @Public()
    @ApiOperation({ summary: "List FAQs with their categories" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    getFaqs(@Query() query: PaginationDto) {
        return this.contentService.getFaqs(query);
    }

    @Post("faq")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: create an FAQ" })
    @ApiBody({ type: CreateFaqDto })
    createFaq(@Body() dto: CreateFaqDto) {
        return this.contentService.createFaq(dto);
    }

    @Patch("faq/:id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: update an FAQ" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateFaqDto })
    updateFaq(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateFaqDto) {
        return this.contentService.updateFaq(id, dto);
    }

    @Delete("faq/:id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: delete an FAQ" })
    @ApiParam({ name: "id", type: Number })
    deleteFaq(@Param("id", ParseIntPipe) id: number) {
        return this.contentService.deleteFaq(id);
    }

    // ─── Legal Documents ─────────────────────────────────────────────────────────

    @Get("legal/:type")
    @Public()
    @ApiOperation({ summary: "Get a legal document by type" })
    @ApiParam({ name: "type", enum: LegalDocumentType })
    getLegalDocument(@Param("type") type: LegalDocumentType) {
        return this.contentService.getLegalDocument(type);
    }

    @Patch("legal/:type")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: update a legal document such as Terms or Privacy Policy" })
    @ApiParam({ name: "type", enum: LegalDocumentType })
    @ApiBody({ type: UpsertLegalDto })
    @ApiResponse({
        status: 200,
        description: "Legal document content updated",
        schema: { example: { id: 1, type: "PRIVACY_POLICY", content: "<p>Policy content</p>" } },
    })
    upsertLegalDocument(@Param("type") type: LegalDocumentType, @Body() dto: UpsertLegalDto) {
        return this.contentService.upsertLegalDocument(type, dto);
    }

    // ─── Company Info ────────────────────────────────────────────────────────────

    @Get("company")
    @Public()
    @ApiOperation({ summary: "Get legal and company information" })
    getCompanyInfo() {
        return this.contentService.getCompanyInfo();
    }

    @Patch("company")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: update legal and company information" })
    @ApiBody({ type: UpsertCompanyInfoDto })
    upsertCompanyInfo(@Body() dto: UpsertCompanyInfoDto) {
        return this.contentService.upsertCompanyInfo(dto);
    }

    // About Us

    @Get("about-us")
    @Public()
    @ApiOperation({ summary: "Get About Us page content" })
    getAboutUs() {
        return this.contentService.getAboutUs();
    }

    @Post("about-us")
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: create or update About Us page content" })
    @ApiBody({ type: UpsertAboutUsDto })
    upsertAboutUs(@Body() dto: UpsertAboutUsDto) {
        return this.contentService.upsertAboutUs(dto);
    }

    // Contact Requests

    @Post("contact")
    @Public()
    @ApiOperation({ summary: "Submit a help and support request" })
    @ApiBody({ type: CreateContactRequestDto })
    submitContactRequest(@Body() dto: CreateContactRequestDto) {
        return this.contentService.submitContactRequest(dto);
    }

    @Get("contact/admin")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: list help and support requests" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "status", required: false, enum: ContactStatusFilter })
    findAllContactRequests(@Query() query: ContactRequestQueryDto) {
        return this.contentService.findAllContactRequests(query);
    }

    @Get("contact/admin/:id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: get help and support request details" })
    @ApiParam({ name: "id", type: Number })
    findContactRequestById(@Param("id", ParseIntPipe) id: number) {
        return this.contentService.findContactRequestById(id);
    }

    @Patch("contact/admin/:id/reply")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: reply to and resolve a help and support request" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: ReplyContactRequestDto })
    replyToContactRequest(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: ReplyContactRequestDto,
    ) {
        return this.contentService.replyToContactRequest(id, dto);
    }

    @Patch("contact/admin/:id/resolve")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiOperation({ summary: "Admin: mark a help and support request as resolved" })
    @ApiParam({ name: "id", type: Number })
    resolveContactRequest(@Param("id", ParseIntPipe) id: number) {
        return this.contentService.resolveContactRequest(id);
    }
}
