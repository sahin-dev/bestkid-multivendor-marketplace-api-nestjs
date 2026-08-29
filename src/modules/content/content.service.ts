import { Injectable, NotFoundException } from "@nestjs/common";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFaqCategoryDto } from "./dtos/create-faq-category.dto";
import { CreateFaqDto } from "./dtos/create-faq.dto";
import { UpdateFaqDto } from "./dtos/update-faq.dto";
import { UpsertAboutUsDto } from "./dtos/upsert-about-us.dto";
import { UpsertLegalDto } from "./dtos/upsert-legal.dto";
import { UpsertCompanyInfoDto } from "./dtos/upsert-company-info.dto";
import { CreateContactRequestDto } from "./dtos/create-contact-request.dto";
import { ReplyContactRequestDto } from "./dtos/reply-contact-request.dto";
import { LegalDocumentType, ContactStatus } from "generated/prisma/client";
import { ContactRequestQueryDto, toContactStatus } from "./dtos/contact-request-query.dto";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";

@Injectable()
export class ContentService {
    constructor(private readonly prismaService: PrismaService) {}

    // ─── FAQ Categories ───────────────────────────────────────────────────────────

    async getFaqCategories(query: PaginationDto = { page: 1, limit: 10 }) {
        const { page = 1, limit = 10 } = query ?? {};
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prismaService.faqCategory.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: "asc" },
            }),
            this.prismaService.faqCategory.count(),
        ]);

        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async createFaqCategory(dto: CreateFaqCategoryDto) {
        return this.prismaService.faqCategory.create({ data: { name: dto.name } });
    }

    // ─── FAQ ─────────────────────────────────────────────────────────────────────

    async getFaqs(query: PaginationDto = { page: 1, limit: 10 }) {
        const { page = 1, limit = 10 } = query ?? {};
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prismaService.faq.findMany({
                skip,
                take: limit,
                include: { category: true },
                orderBy: { createdAt: "asc" },
            }),
            this.prismaService.faq.count(),
        ]);

        return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async createFaq(dto: CreateFaqDto) {
        await assertEntityExists(this.prismaService.faqCategory, "FAQ category", dto.categoryId);

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
        if (dto.categoryId !== undefined) {
            await assertEntityExists(this.prismaService.faqCategory, "FAQ category", dto.categoryId);
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

    // About Us

    async getAboutUs() {
        const aboutUs = await this.prismaService.aboutUs.findFirst();
        if (!aboutUs) {
            throw new NotFoundException("About us content not set yet");
        }
        return aboutUs;
    }

    async upsertAboutUs(dto: UpsertAboutUsDto) {
        const existing = await this.prismaService.aboutUs.findFirst();
        if (existing) {
            return this.prismaService.aboutUs.update({
                where: { id: existing.id },
                data: { content: dto.content },
            });
        }
        return this.prismaService.aboutUs.create({ data: { content: dto.content } });
    }

    // Contact Requests

    async submitContactRequest(dto: CreateContactRequestDto) {
        return this.prismaService.contactRequest.create({ data: { ...dto, status: ContactStatus.TO_DO } });
    }

    async findAllContactRequests(query: ContactRequestQueryDto = { page: 1, limit: 10 }) {
        const { page = 1, limit = 10, status } = query ?? {};
        const skip = (page - 1) * limit;
        const mappedStatus = toContactStatus(status);
        const where = mappedStatus ? { status: mappedStatus } : {};

        const [data, total] = await Promise.all([
            this.prismaService.contactRequest.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            this.prismaService.contactRequest.count({ where }),
        ]);
        return { data: data.map((request) => this.formatContactRequest(request)), meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async findContactRequestById(id: number) {
        const request = await this.prismaService.contactRequest.findUnique({ where: { id } });
        if (!request) {
            throw new NotFoundException(`Contact request with ID ${id} not found`);
        }

        return this.formatContactRequest(request);
    }

    async replyToContactRequest(id: number, dto: ReplyContactRequestDto) {
        const request = await this.prismaService.contactRequest.findUnique({ where: { id } });
        if (!request) {
            throw new NotFoundException(`Contact request with ID ${id} not found`);
        }
        const updated = await this.prismaService.contactRequest.update({
            where: { id },
            data: { reply: dto.reply, status: ContactStatus.RESOLVED },
        });

        return this.formatContactRequest(updated);
    }

    async resolveContactRequest(id: number) {
        const request = await this.prismaService.contactRequest.findUnique({ where: { id } });
        if (!request) {
            throw new NotFoundException(`Contact request with ID ${id} not found`);
        }

        const updated = await this.prismaService.contactRequest.update({
            where: { id },
            data: { status: ContactStatus.RESOLVED },
        });

        return this.formatContactRequest(updated);
    }

    private formatContactRequest<T extends { status: ContactStatus }>(request: T) {
        return {
            ...request,
            status_label: request.status === ContactStatus.RESOLVED ? "Resolved" : "To Do",
        };
    }
}
