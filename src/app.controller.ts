import { Controller, Get, Render, Response } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators';


@Controller()
@ApiTags("System")
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @Render("index")
  @Public()
  @ApiOperation({ summary: "Render the API landing page" })
  getHello(): Record<string, any> {
    return { message: "Hello World" }
  }

}
