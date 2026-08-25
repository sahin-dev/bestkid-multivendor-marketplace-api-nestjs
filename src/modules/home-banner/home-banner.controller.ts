import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorators";
import { ReorderHomeBannersDto } from "./dtos/reorder-home-banners.dto";
import { CreateHomeBannerDto, UpdateHomeBannerDto } from "./dtos/upsert-home-banner.dto";
import { HomeBannerService } from "./home-banner.service";

@ApiTags("Admin Home Banners")
@ApiBearerAuth("access-token")
@Roles("ADMIN")
@Controller("admin/home-banners")
export class HomeBannerController {
    constructor(private readonly homeBannerService: HomeBannerService) {}

    @Get()
    @ApiOperation({ summary: "Admin: list homepage banners" })
    findAll() {
        return this.homeBannerService.findAllForAdmin();
    }

    @Post()
    @ApiOperation({ summary: "Admin: create a homepage banner" })
    @ApiBody({ type: CreateHomeBannerDto })
    create(@Body() dto: CreateHomeBannerDto) {
        return this.homeBannerService.create(dto);
    }

    @Patch("reorder")
    @ApiOperation({ summary: "Admin: reorder homepage banners" })
    @ApiBody({ type: ReorderHomeBannersDto })
    reorder(@Body() dto: ReorderHomeBannersDto) {
        return this.homeBannerService.reorder(dto);
    }

    @Get(":id")
    @ApiOperation({ summary: "Admin: get homepage banner details" })
    @ApiParam({ name: "id", type: Number })
    findById(@Param("id", ParseIntPipe) id: number) {
        return this.homeBannerService.findById(id);
    }

    @Patch(":id")
    @ApiOperation({ summary: "Admin: update a homepage banner" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateHomeBannerDto })
    update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateHomeBannerDto) {
        return this.homeBannerService.update(id, dto);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Admin: delete a homepage banner" })
    @ApiParam({ name: "id", type: Number })
    delete(@Param("id", ParseIntPipe) id: number) {
        return this.homeBannerService.delete(id);
    }
}
