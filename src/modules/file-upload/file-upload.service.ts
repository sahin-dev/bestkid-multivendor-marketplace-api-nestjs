import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Multer } from 'multer';

@Injectable()
export class FileUploadService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Ensure the uploads directory exists on service init
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<{ filePath: string }> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    // Build a unique filename: timestamp-originalname
    const uniqueName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadDir, uniqueName);

    try {
      fs.writeFileSync(filePath, file.buffer);
    } catch (error) {
      throw new BadRequestException('Failed to save file.');
    }

    // Return the relative path from project root
    return { filePath: `uploads/${uniqueName}` };
  }

  async deleteFile(filePath: string): Promise<{ message: string }> {
    if (!filePath) {
      throw new BadRequestException('File path is required.');
    }

    const absolutePath = path.join(process.cwd(), filePath);

    // Prevent directory traversal
    if (!absolutePath.startsWith(this.uploadDir)) {
      throw new BadRequestException('Invalid file path.');
    }

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('File not found.');
    }

    try {
      fs.unlinkSync(absolutePath);
    } catch (error) {
      throw new BadRequestException('Failed to delete file.');
    }

    return { message: 'File deleted successfully.' };
  }
}
