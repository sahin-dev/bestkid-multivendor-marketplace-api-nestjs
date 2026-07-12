import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dtos/create-category.dto";
import { UpdateCategoryDto } from "./dtos/update-category.dto";
import { CreateSubCategoryDto } from "./dtos/create-subcategory.dto";
import { UpdateSubCategoryDto } from "./dtos/update-subcategory.dto";
import { assertEntityExists } from "src/common/validators/entity-exists.validator";

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

        const [data, total, categoryCounts, subCategoryCounts] = await Promise.all([
            this.prismaService.category.findMany({
                skip,
                take: limit,
                include: {
                    subCategories: true,
                },
                orderBy: { createdAt: "asc" },
            }),
            this.prismaService.category.count(),
            this.prismaService.product.groupBy({
                by: ["categoryId"],
                where: { status: "ACTIVE" },
                _count: { id: true },
            }),
            this.prismaService.product.groupBy({
                by: ["subCategoryId"],
                where: { status: "ACTIVE" },
                _count: { id: true },
            }),
        ]);

        const categoryCountMap = new Map(categoryCounts.map((item) => [item.categoryId, item._count.id]));
        const subCategoryCountMap = new Map(subCategoryCounts.map((item) => [item.subCategoryId, item._count.id]));

        return {
            data: data.map((category) => ({
                ...category,
                product_count: categoryCountMap.get(category.id) ?? 0,
                subCategories: category.subCategories.map((subCategory) => ({
                    ...subCategory,
                    product_count: subCategoryCountMap.get(subCategory.id) ?? 0,
                })),
            })),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async findCategoryById(id: number) {
        const [category, categoryCount, subCategoryCounts] = await Promise.all([
            this.prismaService.category.findUnique({
            where: { id },
            include: {
                subCategories: true,
            },
            }),
            this.prismaService.product.count({ where: { categoryId: id, status: "ACTIVE" } }),
            this.prismaService.product.groupBy({
                by: ["subCategoryId"],
                where: { categoryId: id, status: "ACTIVE" },
                _count: { id: true },
            }),
        ]);
        if (!category) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }

        const subCategoryCountMap = new Map(subCategoryCounts.map((item) => [item.subCategoryId, item._count.id]));

        return {
            ...category,
            product_count: categoryCount,
            subCategories: category.subCategories.map((subCategory) => ({
                ...subCategory,
                product_count: subCategoryCountMap.get(subCategory.id) ?? 0,
            })),
        };
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
        await assertEntityExists(this.prismaService.category, "Category", categoryId);

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
        await assertEntityExists(this.prismaService.category, "Category", categoryId);

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
