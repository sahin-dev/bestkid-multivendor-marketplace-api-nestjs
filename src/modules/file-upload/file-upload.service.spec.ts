import { BadRequestException, ForbiddenException } from "@nestjs/common";
import * as fs from "fs";
import { FileUploadService } from "./file-upload.service";

describe("FileUploadService", () => {
    const pngBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
    const upload = (buffer: Buffer, originalname = "photo.png") => ({ buffer, originalname }) as Express.Multer.File;

    let service: FileUploadService;
    let writeFile: jest.SpyInstance;
    let unlink: jest.SpyInstance;

    beforeEach(() => {
        writeFile = jest.spyOn(fs.promises, "writeFile").mockResolvedValue();
        unlink = jest.spyOn(fs.promises, "unlink").mockResolvedValue();
        service = new FileUploadService();
    });

    afterEach(() => jest.restoreAllMocks());

    it("stores a file under a generated name that keeps nothing from the client", async () => {
        const { filePath } = await service.uploadFile(upload(pngBytes, "../../evil.html"), 7);

        expect(filePath).toMatch(/^\/uploads\/7-[0-9a-f-]{36}\.png$/);
        expect(filePath).not.toContain("evil");
    });

    it("rejects HTML disguised as an image", async () => {
        const html = Buffer.from("<html><script>alert(document.domain)</script></html>");

        await expect(service.uploadFile(upload(html, "photo.png"), 7)).rejects.toBeInstanceOf(BadRequestException);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it("rejects SVG, which can carry scripts", async () => {
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');

        await expect(service.uploadFile(upload(svg, "icon.svg"), 7)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("lets a user delete their own file", async () => {
        await expect(service.deleteFile("/uploads/7-abc.png", 7)).resolves.toEqual({ message: "File deleted successfully." });
        expect(unlink).toHaveBeenCalled();
    });

    it("stops a user deleting someone else's file", async () => {
        await expect(service.deleteFile("/uploads/8-abc.png", 7)).rejects.toBeInstanceOf(ForbiddenException);
        expect(unlink).not.toHaveBeenCalled();
    });

    it("lets an admin delete any upload", async () => {
        await expect(service.deleteFile("/uploads/8-abc.png", 1, true)).resolves.toBeDefined();
    });

    it.each(["/uploads/../.env", "/uploads/../../etc/passwd", "../.env", "/uploads_private/7-a.png", "/etc/passwd"])(
        "refuses the traversal path %s",
        async (filePath) => {
            await expect(service.deleteFile(filePath, 7, true)).rejects.toBeInstanceOf(BadRequestException);
            expect(unlink).not.toHaveBeenCalled();
        },
    );
});
