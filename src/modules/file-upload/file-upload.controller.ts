import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GetUser } from 'src/common/decorators';
import { uploadOptions } from 'src/common/upload/upload.options';
import { TokenPayload } from '../auth/types/TokenPayload.type';
import { FileUploadService } from './file-upload.service';

@ApiTags('Uploads')
@ApiBearerAuth('access-token')
@Controller('uploads')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
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
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @GetUser('id') userId: number,
  ) {
    return this.fileUploadService.uploadFile(file, userId);
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
  async deleteFile(
    @Body('filePath') filePath: string,
    @GetUser() payload: TokenPayload,
  ) {
    return this.fileUploadService.deleteFile(
      filePath,
      payload.id,
      payload.role === 'ADMIN',
    );
  }
}
