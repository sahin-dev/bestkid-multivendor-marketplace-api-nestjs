import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFaqCategoryDto } from "./dtos/create-faq-category.dto";
import { CreateFaqDto } from "./dtos/create-faq.dto";
import { UpdateFaqDto } from "./dtos/update-faq.dto";
import { UpsertLegalDto } from "./dtos/upsert-legal.dto";
import { UpsertCompanyInfoDto } from "./dtos/upsert-company-info.dto";
import { CreateContactRequestDto } from "./dtos/create-contact-request.dto";
import { ReplyContactRequestDto } from "./dtos/reply-contact-request.dto";
import { LegalDocumentType, ContactStatus } from "generated/prisma/client";

@Injectable()
export class ContentService {
    constructor(private readonly prismaService: PrismaService) {}

    // ─── FAQ Categories ───────────────────────────────────────────────────────────

    async getFaqCategories() {
        return this.prismaService.faqCategory.findMany({
            orderBy: { createdAt: "asc" },
        });
    }

    async createFaqCategory(dto: CreateFaqCategoryDto) {
        return this.prismaService.faqCategory.create({ data: { name: dto.name } });
    }

    // ─── FAQ ─────────────────────────────────────────────────────────────────────

    async getFaqs() {
        return this.prismaService.faq.findMany({
            include: { category: true },
            orderBy: { createdAt: "asc" },
        });
    }

    async createFaq(dto: CreateFaqDto) {
        const category = await this.prismaService.faqCategory.findUnique({ where: { id: dto.categoryId } });
        if (!category) {
            throw new NotFoundException(`FAQ category with ID ${dto.categoryId} not found`);
        }
        return this.prismaService.faq.create({
            data: { categoryId: dto.categoryId, question: dto.question, answer: dto.answer },
            include: { category: true },
        });
    }

    async updateFaq(id: number, dto: UpdateFaqDto) {
        const faq = await this.prismaService.faq.findUnique({ where: { id } });
        if (!faq) {
            throw new NotFoundException(`FAQ with ID ${id} not found`);
        }
        return this.prismaService.faq.update({
            where: { id },
            data: { ...dto },
            include: { category: true },
        });
    }

    async deleteFaq(id: number) {
        const faq = await this.prismaService.faq.findUnique({ where: { id } });
        if (!faq) {
            throw new NotFoundException(`FAQ with ID ${id} not found`);
        }
        await this.prismaService.faq.delete({ where: { id } });
        return { message: "FAQ deleted successfully" };
    }

    // ─── Legal Documents ──────────────────────────────────────────────────────────

    async getLegalDocument(type: LegalDocumentType) {
        const doc = await this.prismaService.legalDocument.findFirst({ where: { type } });
        if (!doc) {
            throw new NotFoundException(`Legal document of type ${type} not found`);
        }
        return doc;
    }

    async upsertLegalDocument(type: LegalDocumentType, dto: UpsertLegalDto) {
        const existing = await this.prismaService.legalDocument.findFirst({ where: { type } });
        if (existing) {
            return this.prismaService.legalDocument.update({
                where: { id: existing.id },
                data: { content: dto.content },
            });
        }
        return this.prismaService.legalDocument.create({ data: { type, content: dto.content } });
    }

    // ─── Company Info ─────────────────────────────────────────────────────────────

    async getCompanyInfo() {
        const info = await this.prismaService.companyInfo.findFirst();
        if (!info) {
            throw new NotFoundException("Company info not set yet");
        }
        return info;
    }

    async upsertCompanyInfo(dto: UpsertCompanyInfoDto) {
        const existing = await this.prismaService.companyInfo.findFirst();
        if (existing) {
            return this.prismaService.companyInfo.update({
                where: { id: existing.id },
                data: { ...dto },
            });
        }
        return this.prismaService.companyInfo.create({ data: { ...dto } });
    }

    // ─── Contact Requests ─────────────────────────────────────────────────────────

    async submitContactRequest(dto: CreateContactRequestDto) {
        return this.prismaService.contactRequest.create({ data: { ...dto } });
    }

    async findAllContactRequests(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prismaService.contactRequest.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            this.prismaService.contactRequest.count(),
        ]);
        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async replyToContactRequest(id: number, dto: ReplyContactRequestDto) {
        const request = await this.prismaService.contactRequest.findUnique({ where: { id } });
        if (!request) {
            throw new NotFoundException(`Contact request with ID ${id} not found`);
        }
        return this.prismaService.contactRequest.update({
            where: { id },
            data: { reply: dto.reply, status: ContactStatus.REPLIED },
        });
    }
}
