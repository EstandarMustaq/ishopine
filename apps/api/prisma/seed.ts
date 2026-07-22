import {
  AccountingEntryStatus,
  AccountingEntryType,
  CarrierCode,
  PlatformRole,
  PlatformStaffRole,
  PrismaClient,
  ProductStatus,
  ShopRole,
  ShopStatus,
  TenantMemberRole,
  TenantType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

  const org = await prisma.organization.create({
    data: {
      name: 'iShopine',
      slug: 'ishopine',
      legalName: 'iShopine, Lda',
      supportEmail: 'contacto@ishopine.com',
      supportPhone: '+258 84 000 2026',
      primaryColor: '#111111',
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

  const passwordHash = await bcrypt.hash('IShopine@2026', 10);
  const now = new Date();

  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@ishopine.com',
      name: 'Admin iShopine',
      passwordHash,
      platformRole: PlatformRole.PLATFORM_ADMIN,
      phone: '+258 84 000 0001',
      emailVerifiedAt: now,
      canBuy: true,
      canSell: true,
      totpEnabled: false,
      cart: { create: {} },
    },
  });

  const operator = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'operador@ishopine.com',
      name: 'Operador Plataforma',
      passwordHash,
      platformRole: PlatformRole.PLATFORM_OPERATOR,
      phone: '+258 84 000 0002',
      emailVerifiedAt: now,
      canBuy: true,
      canSell: false,
      totpEnabled: false,
      cart: { create: {} },
    },
  });

  const seller1 = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'vendedor1@ishopine.com',
      name: 'Casa Atlas',
      passwordHash,
      platformRole: PlatformRole.SELLER,
      phone: '+258 84 000 0010',
      emailVerifiedAt: now,
      canBuy: true,
      canSell: true,
      totpEnabled: false,
      cart: { create: {} },
    },
  });

  const seller2 = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'vendedor2@ishopine.com',
      name: 'Studio Horizonte',
      passwordHash,
      platformRole: PlatformRole.SELLER,
      phone: '+258 84 000 0011',
      emailVerifiedAt: now,
      canBuy: true,
      canSell: true,
      totpEnabled: false,
      cart: { create: {} },
    },
  });

  const buyer = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'comprador@ishopine.com',
      name: 'Ana Compradora',
      passwordHash,
      platformRole: PlatformRole.BUYER,
      phone: '+258 84 000 0003',
      emailVerifiedAt: now,
      canBuy: true,
      canSell: false,
      affiliateEligible: true,
      totpEnabled: false,
      cart: { create: {} },
      addresses: {
        create: {
          label: 'Casa',
          street: 'Av. Julius Nyerere',
          number: '120',
          district: 'Polana',
          city: 'Maputo',
          state: 'Maputo',
          zipCode: '1100',
          isDefault: true,
        },
      },
    },
  });

  const shopAtlas = await prisma.shop.create({
    data: {
      organizationId: org.id,
      ownerId: seller1.id,
      name: 'Casa Atlas',
      slug: 'casa-atlas',
      description: 'Móveis e decoração contemporânea',
      status: ShopStatus.ACTIVE,
      shopType: 'REAL_ESTATE_FURNITURE',
      province: 'Maputo Cidade',
      district: 'KaMpfumo',
      latitude: -25.9692,
      longitude: 32.5732,
      ratingAvg: 4.6,
      ratingCount: 12,
      reputationScore: 88,
      members: {
        create: { userId: seller1.id, role: ShopRole.OWNER },
      },
    },
  });

  const shopHorizonte = await prisma.shop.create({
    data: {
      organizationId: org.id,
      ownerId: seller2.id,
      name: 'Studio Horizonte',
      slug: 'studio-horizonte',
      description: 'Design autoral e peças sob medida',
      status: ShopStatus.ACTIVE,
      shopType: 'FASHION',
      province: 'Sofala',
      district: 'Beira',
      latitude: -19.8333,
      longitude: 34.85,
      ratingAvg: 4.2,
      ratingCount: 7,
      reputationScore: 76,
      members: {
        create: { userId: seller2.id, role: ShopRole.OWNER },
      },
    },
  });

  // Account ≠ Tenant foundation (CaaS Phase 0)
  async function provisionAccount(
    user: { id: string; email: string; name: string; phone: string | null },
    opts?: {
      particular?: boolean;
      store?: { shopId: string; name: string; slug: string };
      staffRole?: PlatformStaffRole;
    },
  ) {
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
      },
    });

    if (opts?.staffRole) {
      await prisma.platformStaff.create({
        data: { accountId: account.id, role: opts.staffRole },
      });
    }

    if (opts?.particular) {
      const particular = await prisma.tenant.create({
        data: {
          type: TenantType.PARTICULAR,
          name: `${user.name} (Particular)`,
          slug: `p-${user.email.split('@')[0]}`,
          ownerAccountId: account.id,
          particularAccountId: account.id,
        },
      });
      await prisma.tenantMembership.create({
        data: {
          tenantId: particular.id,
          accountId: account.id,
          role: TenantMemberRole.OWNER,
        },
      });
    }

    if (opts?.store) {
      const store = await prisma.tenant.create({
        data: {
          type: TenantType.STORE,
          name: opts.store.name,
          slug: `s-${opts.store.slug}`,
          ownerAccountId: account.id,
          shopId: opts.store.shopId,
        },
      });
      await prisma.tenantMembership.create({
        data: {
          tenantId: store.id,
          accountId: account.id,
          role: TenantMemberRole.OWNER,
        },
      });
    }

    return account;
  }

  await provisionAccount(admin, { staffRole: PlatformStaffRole.OPS });
  await provisionAccount(operator, { staffRole: PlatformStaffRole.MODERATOR });
  await provisionAccount(seller1, {
    particular: true,
    store: {
      shopId: shopAtlas.id,
      name: shopAtlas.name,
      slug: shopAtlas.slug,
    },
  });
  await provisionAccount(seller2, {
    store: {
      shopId: shopHorizonte.id,
      name: shopHorizonte.name,
      slug: shopHorizonte.slug,
    },
  });
  await provisionAccount(buyer);

  const accounts = await Promise.all(
    [
      { code: '1.1.01', name: 'Caixa / Bancos', type: AccountingEntryType.ASSET },
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

  const categories = await Promise.all(
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
    ].map((category) => prisma.category.create({ data: category })),
  );

  const slugify = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const productsData = [
    {
      shopId: shopAtlas.id,
      name: 'Sofá Modular Aurora',
      sku: 'AT-SOF-001',
      categoryId: categories[0].id,
      priceCents: 459900,
      compareAtCents: 529900,
      costCents: 210000,
      stock: 12,
      featured: true,
      brand: 'Casa Atlas',
      material: 'Linho premium',
      color: 'Areia',
      dimensions: '220x90x85 cm',
      shortDescription: 'Sofá modular com chaise reversível e tecido lavável.',
      description:
        'O Sofá Modular Aurora combina linhas limpas com conforto generoso. Estrutura em madeira maciça, espuma D33 e tecido linho premium em tom areia.',
      images: [
        unsplash('photo-1555041469-a586c61ea9bc'),
        unsplash('photo-1493663284031-b7e3aefcae8e'),
      ],
    },
    {
      shopId: shopAtlas.id,
      name: 'Mesa de Jantar Nogueira',
      sku: 'AT-MES-002',
      categoryId: categories[1].id,
      priceCents: 289900,
      costCents: 140000,
      stock: 8,
      featured: true,
      brand: 'Casa Atlas',
      material: 'Madeira de nogueira',
      color: 'Natural',
      dimensions: '180x90x75 cm',
      shortDescription: 'Mesa para 6 lugares com tampo maciço.',
      description:
        'Tampo em nogueira americana com acabamento óleo natural. Pés em aço preto fosco.',
      images: [
        unsplash('photo-1533090481720-856c6e3c1fdc'),
        unsplash('photo-1617806118233-18e1de247200'),
      ],
    },
    {
      shopId: shopAtlas.id,
      name: 'Cadeira Escandinava Lumi',
      sku: 'AT-CAD-003',
      categoryId: categories[2].id,
      priceCents: 69900,
      compareAtCents: 89900,
      costCents: 28000,
      stock: 40,
      featured: true,
      brand: 'Casa Atlas',
      material: 'Carvalho e linho',
      color: 'Off-white',
      dimensions: '45x50x80 cm',
      shortDescription: 'Cadeira leve com assento estofado.',
      description:
        'Inspirada no design nórdico, a Lumi traz assento estofado removível e estrutura em carvalho claro.',
      images: [unsplash('photo-1506439773649-6e0eb8cfb237')],
    },
    {
      shopId: shopAtlas.id,
      name: 'Estante Grid 5 Prateleiras',
      sku: 'AT-EST-004',
      categoryId: categories[3].id,
      priceCents: 149900,
      costCents: 62000,
      stock: 15,
      featured: false,
      brand: 'Casa Atlas',
      material: 'MDF e metal',
      color: 'Preto',
      dimensions: '80x30x180 cm',
      shortDescription: 'Estante industrial com prateleiras reguláveis.',
      description:
        'Estrutura metálica com prateleiras em MDF texturizado. Perfeita para livros, objetos e plantas.',
      images: [unsplash('photo-1594026112284-02bb6f3353fe')],
    },
    {
      shopId: shopHorizonte.id,
      name: 'Cama Casal Horizon',
      sku: 'HZ-QUA-005',
      categoryId: categories[4].id,
      priceCents: 329900,
      costCents: 155000,
      stock: 6,
      featured: true,
      brand: 'Studio Horizonte',
      material: 'Madeira maciça e linho',
      color: 'Grafite',
      dimensions: '160x200 cm',
      shortDescription: 'Cama com cabeceira estofada e pés metálicos.',
      description:
        'Cabeceira acolchoada em linho grafite, ripas de eucalipto e pés em aço. Design hotel boutique.',
      images: [unsplash('photo-1505693416388-ac5ce068fe85')],
    },
    {
      shopId: shopHorizonte.id,
      name: 'Mesa Lateral Pedra Luna',
      sku: 'HZ-MES-006',
      categoryId: categories[1].id,
      priceCents: 89900,
      costCents: 35000,
      stock: 20,
      featured: false,
      brand: 'Studio Horizonte',
      material: 'Travertino e metal',
      color: 'Creme',
      dimensions: '45x45x50 cm',
      shortDescription: 'Mesa lateral com tampo em pedra natural.',
      description:
        'Tampo em travertino selado e base tubular bronze. Peça statement para salas e quartos.',
      images: [unsplash('photo-1499933374294-4584852892ce')],
    },
    {
      shopId: shopHorizonte.id,
      name: 'Poltrona Bouclé Nest',
      sku: 'HZ-SOF-007',
      categoryId: categories[0].id,
      priceCents: 189900,
      costCents: 82000,
      stock: 10,
      featured: true,
      brand: 'Studio Horizonte',
      material: 'Bouclé',
      color: 'Marfim',
      dimensions: '85x90x80 cm',
      shortDescription: 'Poltrona envolvente em tecido bouclé.',
      description:
        'Curvas orgânicas, espuma moldada e tecido bouclé macio. O cantinho de leitura perfeito.',
      images: [unsplash('photo-1567538096630-e4cde14f43ff')],
    },
    {
      shopId: shopHorizonte.id,
      name: 'Cômoda Veneza 4 Gavetas',
      sku: 'HZ-QUA-008',
      categoryId: categories[4].id,
      priceCents: 219900,
      costCents: 98000,
      stock: 7,
      featured: false,
      brand: 'Studio Horizonte',
      material: 'Freijó',
      color: 'Natural',
      dimensions: '120x45x80 cm',
      shortDescription: 'Cômoda com puxadores embutidos.',
      description:
        'Freijó com verniz fosco, corrediças telescópicas e puxadores embutidos minimalistas.',
      images: [unsplash('photo-1556228453-efd6c1ff04f6')],
    },
  ];

  for (const product of productsData) {
    const { images, ...data } = product;
    await prisma.product.create({
      data: {
        ...data,
        slug: slugify(data.name),
        status: ProductStatus.ACTIVE,
        images: {
          create: images.map((url, index) => ({
            url,
            alt: data.name,
            isPrimary: index === 0,
            sortOrder: index,
          })),
        },
      },
    });
  }

  const cash = accounts.find((a) => a.code === '1.1.01')!;
  const revenue = accounts.find((a) => a.code === '3.1.01')!;
  const expense = accounts.find((a) => a.code === '4.2.01')!;

  await prisma.accountingEntry.createMany({
    data: [
      {
        entryNumber: 'LC000001',
        description: 'Aporte inicial de capital',
        type: AccountingEntryType.EQUITY,
        status: AccountingEntryStatus.POSTED,
        amountCents: 5000000,
        debitAccountId: cash.id,
        creditAccountId: accounts.find((a) => a.code === '5.1.01')!.id,
        createdById: admin.id,
        reviewedById: admin.id,
        postedAt: new Date(),
      },
      {
        entryNumber: 'LC000002',
        description: 'Despesa de frete e logística da plataforma',
        type: AccountingEntryType.EXPENSE,
        status: AccountingEntryStatus.POSTED,
        amountCents: 125000,
        debitAccountId: expense.id,
        creditAccountId: cash.id,
        createdById: operator.id,
        reviewedById: admin.id,
        postedAt: new Date(),
      },
      {
        entryNumber: 'LC000003',
        description: 'Receita antecipada de campanha marketplace',
        type: AccountingEntryType.REVENUE,
        status: AccountingEntryStatus.DRAFT,
        amountCents: 89000,
        debitAccountId: cash.id,
        creditAccountId: revenue.id,
        createdById: operator.id,
      },
    ],
  });

  void buyer;
  void shopAtlas;
  void shopHorizonte;

  await prisma.coupon.createMany({
    data: [
      {
        code: 'ISHOP10',
        type: 'PERCENT',
        value: 10,
        minSubtotalCents: 10000,
        maxUses: 100,
        createdById: admin.id,
      },
      {
        code: 'BEMVINDO50',
        type: 'FIXED',
        value: 5000,
        minSubtotalCents: 20000,
        maxUses: 50,
        createdById: admin.id,
      },
    ],
  });

  await prisma.notification.create({
    data: {
      userId: buyer.id,
      type: 'SYSTEM',
      title: 'Bem-vindo ao iShopine',
      body: 'Explore o mercado, favorite produtos e converse com vendedores.',
      href: '/produtos',
    },
  });

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

  console.log('Seed iShopine concluído');
  console.log('Org: iShopine (slug=ishopine) · Moçambique · MZN · PaySuite');
  console.log('CaaS: Account ≠ Tenant (vendedor1 tem PARTICULAR + STORE)');
  console.log('Admin: admin@ishopine.com / IShopine@2026 (backoffice staff OPS)');
  console.log('Operador: operador@ishopine.com / IShopine@2026 (MODERATOR)');
  console.log(
    'Vendedor 1: vendedor1@ishopine.com / IShopine@2026 (tenant PARTICULAR + STORE Casa Atlas)',
  );
  console.log(
    'Vendedor 2: vendedor2@ishopine.com / IShopine@2026 (tenant STORE Studio Horizonte)',
  );
  console.log('Comprador: comprador@ishopine.com / IShopine@2026 (Account sem tenant seller)');
  console.log('Accounts API: GET /api/accounts/me · header x-tenant-id');
  console.log('Shipping zones: 11 províncias MZ + fallback nacional');
  console.log(
    'Para ativar 2FA: POST /api/auth/2fa/setup → POST /api/auth/2fa/enable',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
