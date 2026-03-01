import { uploadFileToDrive } from "@/lib/drive/client";

export class DriveService {
    /**
     * @param fileName string
     * @param mimeType string
     * @param buffer Buffer
     */
    async uploadToDrive(fileName: string, mimeType: string, buffer: Buffer): Promise<string> {
        // We reuse the existing implementation
        return await uploadFileToDrive(buffer, fileName, "archive", mimeType);
    }
}

export const driveService = new DriveService();
