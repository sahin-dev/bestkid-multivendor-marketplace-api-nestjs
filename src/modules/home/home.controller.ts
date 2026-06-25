import { Controller, Get, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "src/common/decorators";
import { HomeService } from "./home.service";
import type { Request } from "express";

@ApiTags("Home")
@Controller("home")
export class HomeController {
    constructor(private readonly homeService: HomeService) {}

    @Get()
    @Public()
    @ApiOperation({ summary: "Homepage data: categories, trending products, new arrivals" })
    async getHomepage() {
        return this.homeService.getHomepageData();
    }

    @Get("recently-viewed")
    @ApiOperation({ summary: "Get recently viewed products for logged-in user" })
    async getRecentlyViewed(@Req() req: Request) {
        const user = req["user"] as { id: number } | undefined;
        if (!user?.id) {
            return { data: [], message: "Login to see your recently viewed products." };
        }
        return this.homeService.getRecentlyViewedForUser(user.id);
    }
}
