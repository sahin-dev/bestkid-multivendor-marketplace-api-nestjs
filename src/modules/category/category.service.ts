import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dtos/create-category.dto";
import { UpdateCategoryDto } from "./dtos/update-category.dto";
import { CreateSubCategoryDto } from "./dtos/create-subcategory.dto";
import { UpdateSubCategoryDto } from "./dtos/update-subcategory.dto";

@Injectable()
export class CategoryService {
    constructor(private readonly prismaService: PrismaService) {}

    async createCategory(dto: CreateCategoryDto) {
        return this.prismaService.category.create({
            data: dto,
        });
    }

    async findAllCategories(query: PaginationDto = { page: 1, limit: 10 }) {
        const { page = 1, limit = 10 } = query ?? {};
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prismaService.category.findMany({
                skip,
                take: limit,
                include: {
                    subCategories: true,
                },
                orderBy: { createdAt: "asc" },
            }),
            this.prismaService.category.count(),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findCategoryById(id: number) {
        const category = await this.prismaService.category.findUnique({
            where: { id },
            include: {
                subCategories: true,
            },
        });
        if (!category) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }
        return category;
    }

    async updateCategory(id: number, dto: UpdateCategoryDto) {
        // Check if exists
        await this.findCategoryById(id);

        return this.prismaService.category.update({
            where: { id },
            data: dto,
        });
    }

    async deleteCategory(id: number) {
        await this.findCategoryById(id);

        const productCount = await this.prismaService.product.count({
            where: { categoryId: id },
        });

        if (productCount > 0) {
            throw new BadRequestException("Category cannot be deleted while products are assigned to it");
        }

        await this.prismaService.subCategory.deleteMany({
            where: { categoryId: id },
        });

        return this.prismaService.category.delete({
            where: { id },
        });
    }

    async createSubCategory(categoryId: number, dto: CreateSubCategoryDto) {
        // Ensure category exists
        await this.findCategoryById(categoryId);

        return this.prismaService.subCategory.create({
            data: {
                ...dto,
                categoryId,
            },
        });
    }

    async updateSubCategory(categoryId: number, subCategoryId: number, dto: UpdateSubCategoryDto) {
        const subCategory = await this.prismaService.subCategory.findFirst({
            where: { id: subCategoryId, categoryId },
        });
        if (!subCategory) {
            throw new NotFoundException(`SubCategory with ID ${subCategoryId} not found in Category ${categoryId}`);
        }

        return this.prismaService.subCategory.update({
            where: { id: subCategoryId },
            data: dto,
        });
    }

    async deleteSubCategory(categoryId: number, subCategoryId: number) {
        const subCategory = await this.prismaService.subCategory.findFirst({
            where: { id: subCategoryId, categoryId },
        });
        if (!subCategory) {
            throw new NotFoundException(`SubCategory with ID ${subCategoryId} not found in Category ${categoryId}`);
        }

        const productCount = await this.prismaService.product.count({
            where: { subCategoryId },
        });

        if (productCount > 0) {
            throw new BadRequestException("Sub-category cannot be deleted while products are assigned to it");
        }

        return this.prismaService.subCategory.delete({
            where: { id: subCategoryId },
        });
    }
}
