import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadsService {
  private readonly provider: string;
  private readonly uploadDir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.provider = this.config.get<string>('UPLOAD_PROVIDER', 'local');
    this.uploadDir = this.config.get<string>('UPLOAD_DIR', 'uploads');

    if (this.provider === 'cloudinary') {
      cloudinary.config({
        cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
        api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
        api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
      });
    }
  }

  async upload(
    file: Express.Multer.File,
    folder = 'products',
  ) {
    if (this.provider === 'cloudinary') {
      const result = await new Promise<{
        secure_url: string;
        public_id: string;
        bytes: number;
      }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `nkateko/${folder}` },
          (error, uploadResult) => {
            if (error || !uploadResult) {
              reject(error ?? new Error('Falha no upload Cloudinary'));
              return;
            }
            resolve({
              secure_url: uploadResult.secure_url,
              public_id: uploadResult.public_id,
              bytes: uploadResult.bytes,
            });
          },
        );
        stream.end(file.buffer);
      });

      return this.prisma.mediaAsset.create({
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          provider: 'cloudinary',
          mimeType: file.mimetype,
          sizeBytes: result.bytes,
          folder,
          alt: file.originalname,
        },
      });
    }

    const dir = join(process.cwd(), this.uploadDir, folder);
    await mkdir(dir, { recursive: true });
    const ext = file.originalname.split('.').pop() || 'bin';
    const filename = `${randomUUID()}.${ext}`;
    const absolute = join(dir, filename);
    await writeFile(absolute, file.buffer);

    const url = `/uploads/${folder}/${filename}`;
    return this.prisma.mediaAsset.create({
      data: {
        url,
        provider: 'local',
        mimeType: file.mimetype,
        sizeBytes: file.size,
        folder,
        alt: file.originalname,
      },
    });
  }

  list(folder?: string) {
    return this.prisma.mediaAsset.findMany({
      where: folder ? { folder } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
