import { Controller, Get, Render, Response } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @Render("index")
  @Public()
  getHello(): Record<string, any> {
    return { message: "Hello World" }
  }

}
