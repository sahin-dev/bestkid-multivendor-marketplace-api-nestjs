import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { GetUser, Public } from 'src/common/decorators';
import { HomeService } from './home.service';
import type { Request } from 'express';

@ApiTags('Home')
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Homepage data: categories, trending products, new arrivals',
  })
  async getHomepage(@Req() req: Request) {
    const user = req['payload'] as { id: number } | undefined;
    return this.homeService.getHomepageData(user?.id);
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Get all trending products' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTrendingProducts(
    @Req() req: Request,
    @Query() query: PaginationDto,
  ) {
    const user = req['payload'] as { id: number } | undefined;
    return this.homeService.getTrendingProducts(user?.id, query);
  }

  @Get('new-arrivals')
  @Public()
  @ApiOperation({ summary: 'Get all new arrival products' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getNewArrivalProducts(
    @Req() req: Request,
    @Query() query: PaginationDto,
  ) {
    const user = req['payload'] as { id: number } | undefined;
    return this.homeService.getNewArrivalProducts(user?.id, query);
  }

  @Get('recently-viewed')
  @ApiOperation({ summary: 'Get recently viewed products for logged-in user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentlyViewed(@Req() req: Request, @Query() query: PaginationDto) {
    const user = req['payload'] as { id: number } | undefined;
    if (!user?.id) {
      return {
        data: [],
        message: 'Login to see your recently viewed products.',
      };
    }
    return this.homeService.getRecentlyViewedForUser(user.id, query);
  }

  @Get('featured-coupon')
  @Public()
  @ApiOperation({ summary: 'Get the currently featured coupon details' })
  getFeaturedCoupon() {
    return this.homeService.getFeaturedCoupon();
  }

  @Get('preferences')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the logged-in user currency and language preferences' })
  getUserPreferences(@GetUser('id') userId: number) {
    return this.homeService.getUserPreferences(userId);
  }
}
