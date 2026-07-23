import {
  AccountingEntryType,
  CarrierCode,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

async function main() {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.shopFollow.deleteMany();
  await prisma.couponRedemption.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.shipmentEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.shippingRateZone.deleteMany();
  await prisma.accountingEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.billingWebhookEvent.deleteMany();
  await prisma.billingPayment.deleteMany();
  await prisma.inboxMessage.deleteMany();
  await prisma.outboxMessage.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.readProjection.deleteMany();
  await prisma.securityFinding.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.accountingAccount.deleteMany();
  await prisma.shopMember.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.platformStaff.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.account.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.emailVerificationCode.deleteMany();
  await prisma.platformSettings.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  await prisma.organization.create({
    data: {
      name: 'iShopine',
      slug: 'ishopine',
      legalName: 'iShopine, Lda',
      supportEmail: 'contacto@ishopine.com',
      supportPhone: '+258 84 000 2026',
      primaryColor: '#008060',
      settings: {
        create: {
          marketplaceName: 'iShopine',
          tagline: 'Mercado moçambicano — compre e venda com confiança',
          shippingFlatCents: 15000,
          freeShippingCents: 250000,
          requireSeller2fa: true,
          requireEmailVerify: true,
          commissionBps: 500,
        },
      },
    },
  });

  await Promise.all(
    [
      {
        code: '1.1.01',
        name: 'Caixa / Bancos',
        type: AccountingEntryType.ASSET,
      },
      {
        code: '1.2.01',
        name: 'Estoque de Mercadorias',
        type: AccountingEntryType.ASSET,
      },
      {
        code: '2.1.01',
        name: 'Fornecedores',
        type: AccountingEntryType.LIABILITY,
      },
      {
        code: '3.1.01',
        name: 'Receita de Vendas (Marketplace)',
        type: AccountingEntryType.REVENUE,
      },
      {
        code: '3.2.01',
        name: 'Receita de Comissão',
        type: AccountingEntryType.REVENUE,
      },
      { code: '4.1.01', name: 'CMV', type: AccountingEntryType.EXPENSE },
      {
        code: '4.2.01',
        name: 'Despesas Operacionais',
        type: AccountingEntryType.EXPENSE,
      },
      {
        code: '5.1.01',
        name: 'Capital Social',
        type: AccountingEntryType.EQUITY,
      },
    ].map((account) => prisma.accountingAccount.create({ data: account })),
  );

  await Promise.all(
    [
      {
        name: 'Sofás',
        slug: 'sofas',
        description: 'Conforto para a sala',
        imageUrl: unsplash('photo-1555041469-a586c61ea9bc'),
        sortOrder: 1,
      },
      {
        name: 'Mesas',
        slug: 'mesas',
        description: 'Mesas de jantar e laterais',
        imageUrl: unsplash('photo-1533090481720-856c6e3c1fdc'),
        sortOrder: 2,
      },
      {
        name: 'Cadeiras',
        slug: 'cadeiras',
        description: 'Assentos com design',
        imageUrl: unsplash('photo-1506439773649-6e0eb8cfb237'),
        sortOrder: 3,
      },
      {
        name: 'Estantes',
        slug: 'estantes',
        description: 'Organização e estilo',
        imageUrl: unsplash('photo-1594026112284-02bb6f3353fe'),
        sortOrder: 4,
      },
      {
        name: 'Quartos',
        slug: 'quartos',
        description: 'Camas, cômodas e cabeceiras',
        imageUrl: unsplash('photo-1505693416388-ac5ce068fe85'),
        sortOrder: 5,
      },
      {
        name: 'Moda',
        slug: 'moda',
        description: 'Roupa, calçado e acessórios',
        imageUrl: unsplash('photo-1445205170230-053b83016050'),
        sortOrder: 6,
      },
      {
        name: 'Electrónica',
        slug: 'electronica',
        description: 'Telemóveis, computadores e gadgets',
        imageUrl: unsplash('photo-1498049794561-7780e7231661'),
        sortOrder: 7,
      },
      {
        name: 'Casa & Decoração',
        slug: 'casa-decoracao',
        description: 'Artigos para o lar',
        imageUrl: unsplash('photo-1616486338812-3dadae4b4ace'),
        sortOrder: 8,
      },
      {
        name: 'Beleza & Saúde',
        slug: 'beleza-saude',
        description: 'Cuidados pessoais e bem-estar',
        imageUrl: unsplash('photo-1596462502278-27bfdc403348'),
        sortOrder: 9,
      },
      {
        name: 'Desporto',
        slug: 'desporto',
        description: 'Fitness, outdoor e recreação',
        imageUrl: unsplash('photo-1461896836934-ffe607ba6851'),
        sortOrder: 10,
      },
    ].map((category) => prisma.category.create({ data: category })),
  );

  // Phase 8: real MZ shipping rate zones (centavos MZN).
  const mzZones: Array<{
    carrierCode: CarrierCode;
    province: string | null;
    city: string | null;
    priceCents: number;
    etaMinDays: number;
    etaMaxDays: number;
    sortOrder: number;
  }> = [
    { carrierCode: CarrierCode.FLAT_RATE, province: null, city: null, priceCents: 15000, etaMinDays: 3, etaMaxDays: 10, sortOrder: 100 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Maputo', city: null, priceCents: 8000, etaMinDays: 1, etaMaxDays: 3, sortOrder: 10 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Maputo', city: 'Maputo', priceCents: 6000, etaMinDays: 1, etaMaxDays: 2, sortOrder: 5 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Gaza', city: null, priceCents: 12000, etaMinDays: 2, etaMaxDays: 5, sortOrder: 20 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Inhambane', city: null, priceCents: 14000, etaMinDays: 3, etaMaxDays: 6, sortOrder: 30 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Sofala', city: null, priceCents: 16000, etaMinDays: 3, etaMaxDays: 7, sortOrder: 40 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Manica', city: null, priceCents: 17000, etaMinDays: 4, etaMaxDays: 8, sortOrder: 50 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Tete', city: null, priceCents: 19000, etaMinDays: 4, etaMaxDays: 9, sortOrder: 60 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Zambézia', city: null, priceCents: 18000, etaMinDays: 4, etaMaxDays: 9, sortOrder: 70 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Nampula', city: null, priceCents: 20000, etaMinDays: 5, etaMaxDays: 10, sortOrder: 80 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Cabo Delgado', city: null, priceCents: 22000, etaMinDays: 5, etaMaxDays: 12, sortOrder: 90 },
    { carrierCode: CarrierCode.FLAT_RATE, province: 'Niassa', city: null, priceCents: 23000, etaMinDays: 5, etaMaxDays: 12, sortOrder: 95 },
    { carrierCode: CarrierCode.FREE_THRESHOLD, province: null, city: null, priceCents: 0, etaMinDays: 2, etaMaxDays: 7, sortOrder: 100 },
    { carrierCode: CarrierCode.FREE_THRESHOLD, province: 'Maputo', city: null, priceCents: 0, etaMinDays: 1, etaMaxDays: 3, sortOrder: 10 },
    { carrierCode: CarrierCode.MANUAL, province: null, city: null, priceCents: 15000, etaMinDays: 3, etaMaxDays: 14, sortOrder: 100 },
    { carrierCode: CarrierCode.MANUAL, province: 'Maputo', city: null, priceCents: 10000, etaMinDays: 2, etaMaxDays: 7, sortOrder: 10 },
  ];

  await prisma.shippingRateZone.createMany({ data: mzZones });

  console.log('iShopine bootstrap complete — no demo users');
  console.log('Register via app / Google OAuth');
  console.log('Org: iShopine (slug=ishopine) · primaryColor=#008060');
  console.log('Categories + chart of accounts + MZ shipping zones seeded');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
