import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { createHash, randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

export type UploadScope = {
  accountId?: string | null;
  tenantId?: string | null;
  shopId?: string | null;
  uploadedById?: string | null;
};

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
    scope: UploadScope = {},
  ) {
    if (this.provider === 'cloudinary') {
      const result = await new Promise<{
        secure_url: string;
        public_id: string;
        bytes: number;
      }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `ishopine/${folder}` },
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
          accountId: scope.accountId ?? null,
          tenantId: scope.tenantId ?? null,
          shopId: scope.shopId ?? null,
          uploadedById: scope.uploadedById ?? null,
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
        accountId: scope.accountId ?? null,
        tenantId: scope.tenantId ?? null,
        shopId: scope.shopId ?? null,
        uploadedById: scope.uploadedById ?? null,
      },
    });
  }

  list(opts: {
    folder?: string;
    tenantId?: string;
    accountId?: string;
    shopId?: string;
  }) {
    return this.prisma.mediaAsset.findMany({
      where: {
        ...(opts.folder ? { folder: opts.folder } : {}),
        ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
        ...(opts.accountId ? { accountId: opts.accountId } : {}),
        ...(opts.shopId ? { shopId: opts.shopId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async remove(id: string, userId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media não encontrado');
    if (asset.uploadedById && asset.uploadedById !== userId) {
      throw new ForbiddenException('Sem permissão para apagar este media');
    }

    if (asset.provider === 'local' && asset.url.startsWith('/uploads/')) {
      const absolute = join(process.cwd(), asset.url.replace(/^\//, ''));
      try {
        await unlink(absolute);
      } catch {
        // file may already be gone
      }
    }
    if (asset.provider === 'cloudinary' && asset.publicId) {
      try {
        await cloudinary.uploader.destroy(asset.publicId);
      } catch {
        // ignore remote delete failures
      }
    }

    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }

  /** Stable fingerprint helper (unused externally; keeps crypto import useful). */
  hashBuffer(buf: Buffer) {
    return createHash('sha256').update(buf).digest('hex');
  }
}
