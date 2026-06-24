import { Injectable, NotFoundException } from "@nestjs/common";
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

    async findAllCategories() {
        return this.prismaService.category.findMany({
            include: {
                subCategories: true,
            },
        });
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

        // Delete all subcategories and products or let prisma handle constraints/delete them
        // First delete subcategories of this category
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

        return this.prismaService.subCategory.delete({
            where: { id: subCategoryId },
        });
    }
}
