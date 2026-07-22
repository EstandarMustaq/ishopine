import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { UsageMetric } from '@prisma/client';
import { AccountsService } from '../accounts/accounts.service';
import { PrismaService } from '../prisma/prisma.service';

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

function periodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class DevelopersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  async createApiKey(userId: string, tenantId: string, name: string) {
    const account = await this.accounts.ensureAccountForUser(userId);
    await this.accounts.resolveTenantAccess(account.id, tenantId);

    const secret = randomBytes(24).toString('base64url');
    const raw = `ish_live_${secret}`;
    const keyPrefix = raw.slice(0, 16);
    const keyHash = hashKey(raw);

    const record = await this.prisma.merchantApiKey.create({
      data: {
        tenantId,
        accountId: account.id,
        name: name.trim() || 'Default',
        keyPrefix,
        keyHash,
      },
    });

    return {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      createdAt: record.createdAt,
      /** Shown once — store securely. */
      apiKey: raw,
    };
  }

  listApiKeys(tenantId: string) {
    return this.prisma.merchantApiKey.findMany({
      where: { tenantId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(userId: string, tenantId: string, keyId: string) {
    const account = await this.accounts.ensureAccountForUser(userId);
    await this.accounts.resolveTenantAccess(account.id, tenantId);
    const key = await this.prisma.merchantApiKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!key) throw new NotFoundException('API key não encontrada');
    return this.prisma.merchantApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  async authenticateApiKey(rawKey: string) {
    if (!rawKey?.startsWith('ish_live_')) {
      throw new UnauthorizedException('API key inválida');
    }
    const keyHash = hashKey(rawKey);
    const key = await this.prisma.merchantApiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: { tenant: true },
    });
    if (!key || !key.tenant.isActive) {
      throw new UnauthorizedException('API key inválida ou revogada');
    }
    await this.prisma.merchantApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    await this.prisma.usageRecord.create({
      data: {
        tenantId: key.tenantId,
        metric: UsageMetric.API_CALLS,
        quantity: 1,
        periodKey: periodKey(),
        reference: key.id,
      },
    });
    return {
      tenantId: key.tenantId,
      accountId: key.accountId,
      shopId: key.tenant.shopId,
      apiKeyId: key.id,
    };
  }

  async upsertWebhook(
    userId: string,
    tenantId: string,
    input: { url: string; events?: string[] },
  ) {
    const account = await this.accounts.ensureAccountForUser(userId);
    await this.accounts.resolveTenantAccess(account.id, tenantId);

    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new BadRequestException('URL de webhook inválida');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('Webhook deve ser http(s)');
    }

    const existing = await this.prisma.merchantWebhookEndpoint.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const secret = existing?.secret ?? `whsec_${randomBytes(24).toString('hex')}`;

    if (existing) {
      return this.prisma.merchantWebhookEndpoint.update({
        where: { id: existing.id },
        data: {
          url: input.url,
          events: input.events ?? existing.events,
          isActive: true,
        },
      });
    }

    return this.prisma.merchantWebhookEndpoint.create({
      data: {
        tenantId,
        accountId: account.id,
        url: input.url,
        secret,
        events: input.events ?? [
          'order.created',
          'order.confirmed',
          'commerce.checkout.completed',
        ],
      },
    });
  }

  listWebhooks(tenantId: string) {
    return this.prisma.merchantWebhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async rotateWebhookSecret(userId: string, tenantId: string, endpointId: string) {
    const account = await this.accounts.ensureAccountForUser(userId);
    await this.accounts.resolveTenantAccess(account.id, tenantId);
    const endpoint = await this.prisma.merchantWebhookEndpoint.findFirst({
      where: { id: endpointId, tenantId },
    });
    if (!endpoint) throw new NotFoundException('Webhook não encontrado');
    return this.prisma.merchantWebhookEndpoint.update({
      where: { id: endpointId },
      data: { secret: `whsec_${randomBytes(24).toString('hex')}` },
    });
  }

  listProducts(tenantId: string, shopId: string | null) {
    if (!shopId) return [];
    return this.prisma.product.findMany({
      where: { shopId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        priceCents: true,
        stock: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  listOrders(tenantId: string, shopId: string | null) {
    if (!shopId) return [];
    return this.prisma.order.findMany({
      where: { sellerShopId: shopId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Fan-out outbox events to merchant webhook endpoints (best-effort HTTP).
   */
  async deliverEvent(eventType: string, payload: Record<string, unknown>) {
    const shopId =
      typeof payload.sellerShopId === 'string'
        ? payload.sellerShopId
        : typeof payload.shopId === 'string'
          ? payload.shopId
          : null;

    let tenantId =
      typeof payload.tenantId === 'string' ? payload.tenantId : null;

    if (!tenantId && shopId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { shopId },
      });
      tenantId = tenant?.id ?? null;
    }

    if (!tenantId) return;

    const endpoints = await this.prisma.merchantWebhookEndpoint.findMany({
      where: { tenantId, isActive: true },
    });

    for (const endpoint of endpoints) {
      if (
        endpoint.events.length > 0 &&
        !endpoint.events.includes(eventType)
      ) {
        continue;
      }

      const body = JSON.stringify({
        id: randomBytes(8).toString('hex'),
        type: eventType,
        createdAt: new Date().toISOString(),
        data: payload,
      });
      const signature = createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');

      const delivery = await this.prisma.merchantWebhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          eventType,
          payload: JSON.parse(body) as object,
          status: 'PENDING',
          attempts: 1,
        },
      });

      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-iShopine-Signature': signature,
            'X-iShopine-Event': eventType,
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        await this.prisma.merchantWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: res.ok ? 'SUCCESS' : 'FAILED',
            responseCode: res.status,
            lastError: res.ok ? null : `HTTP ${res.status}`,
          },
        });
      } catch (error) {
        await this.prisma.merchantWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'FAILED',
            lastError:
              error instanceof Error ? error.message : 'webhook delivery failed',
          },
        });
      }
    }
  }

  /** Constant-time compare helper for future signature verification tests. */
  safeEqual(a: string, b: string) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
