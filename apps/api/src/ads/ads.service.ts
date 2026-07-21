import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdSlot, AdStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic(slot?: AdSlot) {
    const now = new Date();
    return this.prisma.ad.findMany({
      where: {
        status: AdStatus.ACTIVE,
        ...(slot ? { slot } : {}),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        shop: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  listAdmin() {
    return this.prisma.ad.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        shop: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async create(data: {
    title: string;
    subtitle?: string;
    imageUrl: string;
    linkUrl: string;
    slot?: AdSlot;
    status?: AdStatus;
    priority?: number;
    startsAt?: string;
    endsAt?: string;
    shopId?: string;
  }) {
    if (!data.title?.trim() || !data.imageUrl?.trim() || !data.linkUrl?.trim()) {
      throw new BadRequestException('Título, imagem e link são obrigatórios');
    }
    return this.prisma.ad.create({
      data: {
        title: data.title.trim(),
        subtitle: data.subtitle?.trim() || null,
        imageUrl: data.imageUrl.trim(),
        linkUrl: data.linkUrl.trim(),
        slot: data.slot ?? AdSlot.HOME_STRIP,
        status: data.status ?? AdStatus.DRAFT,
        priority: data.priority ?? 0,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        shopId: data.shopId || null,
      },
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      subtitle?: string | null;
      imageUrl?: string;
      linkUrl?: string;
      slot?: AdSlot;
      status?: AdStatus;
      priority?: number;
      startsAt?: string | null;
      endsAt?: string | null;
      shopId?: string | null;
    },
  ) {
    const existing = await this.prisma.ad.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Anúncio não encontrado');

    return this.prisma.ad.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.subtitle !== undefined
          ? { subtitle: data.subtitle?.trim() || null }
          : {}),
        ...(data.imageUrl !== undefined
          ? { imageUrl: data.imageUrl.trim() }
          : {}),
        ...(data.linkUrl !== undefined ? { linkUrl: data.linkUrl.trim() } : {}),
        ...(data.slot !== undefined ? { slot: data.slot } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.startsAt !== undefined
          ? { startsAt: data.startsAt ? new Date(data.startsAt) : null }
          : {}),
        ...(data.endsAt !== undefined
          ? { endsAt: data.endsAt ? new Date(data.endsAt) : null }
          : {}),
        ...(data.shopId !== undefined ? { shopId: data.shopId || null } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.ad.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Anúncio não encontrado');
    await this.prisma.ad.delete({ where: { id } });
    return { ok: true };
  }
}
