import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Multer } from 'multer';
import { detectUploadExtension } from 'src/common/upload/upload.options';

@Injectable()
export class FileUploadService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Ensure the uploads directory exists on service init
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    ownerId: number,
  ): Promise<{ filePath: string }> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    const extension = detectUploadExtension(file.buffer);
    if (!extension) {
      throw new BadRequestException('Unsupported file content.');
    }

    // The owner prefix is what deleteFile uses to authorize removal
    const uniqueName = `${ownerId}-${randomUUID()}.${extension}`;

    try {
      await fs.promises.writeFile(path.join(this.uploadDir, uniqueName), file.buffer);
    } catch (error) {
      throw new BadRequestException('Failed to save file.');
    }

    // Return the public path that matches the static uploads prefix
    return { filePath: `/uploads/${uniqueName}` };
  }

  async deleteFile(
    filePath: string,
    actorId: number,
    isAdmin = false,
  ): Promise<{ message: string }> {
    if (!filePath) {
      throw new BadRequestException('File path is required.');
    }

    const fileName = path.posix.basename(filePath);

    // Prevent directory traversal
    if (path.posix.normalize(filePath) !== `/uploads/${fileName}`) {
      throw new BadRequestException('Invalid file path.');
    }

    if (!isAdmin && !fileName.startsWith(`${actorId}-`)) {
      throw new ForbiddenException('You can only delete files you uploaded.');
    }

    try {
      await fs.promises.unlink(path.join(this.uploadDir, fileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found.');
      }
      throw new BadRequestException('Failed to delete file.');
    }

    return { message: 'File deleted successfully.' };
  }
}
