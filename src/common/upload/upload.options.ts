import { BadRequestException } from "@nestjs/common";
import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 20;

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/avif",
    "application/pdf",
    "video/mp4",
    "video/quicktime",
]);

export const uploadOptions: MulterOptions = {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
            callback(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
            return;
        }
        callback(null, true);
    },
};

/**
 * Identifies a file from its leading bytes. The client-supplied name and Content-Type are
 * never trusted, so HTML or SVG renamed to .png cannot be stored and served from the API origin.
 * Returns the extension to store the file under, or null when the content is not allowed.
 */
export function detectUploadExtension(buffer: Buffer): string | null {
    if (buffer.length < 12) {
        return null;
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "jpg";
    }
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return "png";
    }
    if (buffer.toString("latin1", 0, 4) === "GIF8") {
        return "gif";
    }
    if (buffer.toString("latin1", 0, 4) === "RIFF" && buffer.toString("latin1", 8, 12) === "WEBP") {
        return "webp";
    }
    if (buffer.toString("latin1", 0, 5) === "%PDF-") {
        return "pdf";
    }
    if (buffer.toString("latin1", 4, 8) === "ftyp") {
        const brand = buffer.toString("latin1", 8, 12);
        if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) {
            return "heic";
        }
        if (brand === "avif" || brand === "avis") {
            return "avif";
        }
        if (brand === "qt  ") {
            return "mov";
        }
        return "mp4";
    }

    return null;
}
