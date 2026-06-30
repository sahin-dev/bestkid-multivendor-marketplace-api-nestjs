import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiTags } from "@nestjs/swagger";
import { Public, Roles } from "src/common/decorators";
import { CategoryService } from "./category.service";
import { CreateCategoryDto } from "./dtos/create-category.dto";
import { UpdateCategoryDto } from "./dtos/update-category.dto";
import { CreateSubCategoryDto } from "./dtos/create-subcategory.dto";
import { UpdateSubCategoryDto } from "./dtos/update-subcategory.dto";

@ApiTags("Categories")
@Controller("categories")
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Post()
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiBody({ type: CreateCategoryDto })
    async createCategory(@Body() dto: CreateCategoryDto) {
        return this.categoryService.createCategory(dto);
    }

    @Get()
    @Public()
    async findAllCategories() {
        return this.categoryService.findAllCategories();
    }

    @Get(":id")
    @Public()
    async findCategoryById(@Param("id", ParseIntPipe) id: number) {
        return this.categoryService.findCategoryById(id);
    }

    @Patch(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateCategoryDto })
    async updateCategory(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
        return this.categoryService.updateCategory(id, dto);
    }

    @Delete(":id")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    async deleteCategory(@Param("id", ParseIntPipe) id: number) {
        return this.categoryService.deleteCategory(id);
    }

    @Post(":id/subcategories")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: CreateSubCategoryDto })
    async createSubCategory(@Param("id", ParseIntPipe) categoryId: number, @Body() dto: CreateSubCategoryDto) {
        return this.categoryService.createSubCategory(categoryId, dto);
    }

    @Patch(":catId/subcategories/:subId")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "catId", type: Number })
    @ApiParam({ name: "subId", type: Number })
    @ApiBody({ type: UpdateSubCategoryDto })
    async updateSubCategory(
        @Param("catId", ParseIntPipe) categoryId: number,
        @Param("subId", ParseIntPipe) subCategoryId: number,
        @Body() dto: UpdateSubCategoryDto,
    ) {
        return this.categoryService.updateSubCategory(categoryId, subCategoryId, dto);
    }

    @Delete(":catId/subcategories/:subId")
    @ApiBearerAuth("access-token")
    @Roles("ADMIN")
    @ApiParam({ name: "catId", type: Number })
    @ApiParam({ name: "subId", type: Number })
    async deleteSubCategory(
        @Param("catId", ParseIntPipe) categoryId: number,
        @Param("subId", ParseIntPipe) subCategoryId: number,
    ) {
        return this.categoryService.deleteSubCategory(categoryId, subCategoryId);
    }
}
