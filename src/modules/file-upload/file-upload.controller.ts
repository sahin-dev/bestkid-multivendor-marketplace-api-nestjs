import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileUploadService } from './file-upload.service';

@ApiTags('Uploads')

@Controller('uploads')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.fileUploadService.uploadFile(file);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete an uploaded file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path of the file to delete',
        },
      },
    },
  })
  async deleteFile(@Body('filePath') filePath: string) {
    return this.fileUploadService.deleteFile(filePath);
  }
}
