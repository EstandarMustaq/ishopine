import {
  AccountingEntryStatus,
  AccountingEntryType,
  PrismaClient,
  ProductStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

async function main() {
  await prisma.accountingEntry.deleteMany();
  await prisma.payment.deleteMany();
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
  await prisma.storeSettings.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('mavula123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@mavula.com.br',
      name: 'Admin Mavula',
      passwordHash,
      role: Role.ADMIN,
      phone: '+55 11 90000-0001',
      cart: { create: {} },
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: 'operador@mavula.com.br',
      name: 'Operador Loja',
      passwordHash,
      role: Role.OPERATOR,
      phone: '+55 11 90000-0002',
      cart: { create: {} },
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'cliente@mavula.com.br',
      name: 'Ana Cliente',
      passwordHash,
      role: Role.CUSTOMER,
      phone: '+55 11 90000-0003',
      cart: { create: {} },
      addresses: {
        create: {
          label: 'Casa',
          street: 'Rua das Palmeiras',
          number: '120',
          district: 'Pinheiros',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '05422-000',
          isDefault: true,
        },
      },
    },
  });

  await prisma.storeSettings.create({
    data: {
      storeName: 'Mavula Móveis',
      tagline: 'Móveis com alma brasileira',
      supportEmail: 'contato@mavula.com.br',
      supportPhone: '+55 11 4000-1234',
      shippingFlatCents: 4900,
      freeShippingCents: 99900,
      primaryColor: '#61005D',
    },
  });

  const accounts = await Promise.all(
    [
      { code: '1.1.01', name: 'Caixa / Bancos', type: AccountingEntryType.ASSET },
      { code: '1.2.01', name: 'Estoque de Mercadorias', type: AccountingEntryType.ASSET },
      { code: '2.1.01', name: 'Fornecedores', type: AccountingEntryType.LIABILITY },
      { code: '3.1.01', name: 'Receita de Vendas', type: AccountingEntryType.REVENUE },
      { code: '4.1.01', name: 'CMV', type: AccountingEntryType.EXPENSE },
      { code: '4.2.01', name: 'Despesas Operacionais', type: AccountingEntryType.EXPENSE },
      { code: '5.1.01', name: 'Capital Social', type: AccountingEntryType.EQUITY },
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
        imageUrl: unsplash('photo-1595428773922-5d1a5a3b6b8a'),
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

  const productsData = [
    {
      name: 'Sofá Modular Aurora',
      sku: 'MV-SOF-001',
      categoryId: categories[0].id,
      priceCents: 459900,
      compareAtCents: 529900,
      costCents: 210000,
      stock: 12,
      featured: true,
      brand: 'Mavula',
      material: 'Linho premium',
      color: 'Areia',
      dimensions: '220x90x85 cm',
      shortDescription: 'Sofá modular com chaise reversível e tecido lavável.',
      description:
        'O Sofá Modular Aurora combina linhas limpas com conforto generoso. Estrutura em madeira maciça, espuma D33 e tecido linho premium em tom areia. Ideal para salas contemporâneas.',
      images: [unsplash('photo-1555041469-a586c61ea9bc'), unsplash('photo-1493663284031-b7e3aefcae8e')],
    },
    {
      name: 'Mesa de Jantar Nogueira',
      sku: 'MV-MES-002',
      categoryId: categories[1].id,
      priceCents: 289900,
      costCents: 140000,
      stock: 8,
      featured: true,
      brand: 'Mavula',
      material: 'Madeira de nogueira',
      color: 'Natural',
      dimensions: '180x90x75 cm',
      shortDescription: 'Mesa para 6 lugares com tampo maciço.',
      description:
        'Tampo em nogueira americana com acabamento óleo natural. Pés em aço preto fosco. Serve até 6 pessoas com conforto.',
      images: [unsplash('photo-1533090481720-856c6e3c1fdc'), unsplash('photo-1617806118233-18e1de247200')],
    },
    {
      name: 'Cadeira Escandinava Lumi',
      sku: 'MV-CAD-003',
      categoryId: categories[2].id,
      priceCents: 69900,
      compareAtCents: 89900,
      costCents: 28000,
      stock: 40,
      featured: true,
      brand: 'Mavula',
      material: 'Carvalho e linho',
      color: 'Off-white',
      dimensions: '45x50x80 cm',
      shortDescription: 'Cadeira leve com assento estofado.',
      description:
        'Inspirada no design nórdico, a Lumi traz assento estofado removível e estrutura em carvalho claro.',
      images: [unsplash('photo-1506439773649-6e0eb8cfb237')],
    },
    {
      name: 'Estante Grid 5 Prateleiras',
      sku: 'MV-EST-004',
      categoryId: categories[3].id,
      priceCents: 149900,
      costCents: 62000,
      stock: 15,
      featured: false,
      brand: 'Mavula',
      material: 'MDF e metal',
      color: 'Preto',
      dimensions: '80x30x180 cm',
      shortDescription: 'Estante industrial com prateleiras reguláveis.',
      description:
        'Estrutura metálica com prateleiras em MDF texturizado. Perfeita para livros, objetos e plantas.',
      images: [unsplash('photo-1594026112284-02bb6f3353fe')],
    },
    {
      name: 'Cama Casal Horizon',
      sku: 'MV-QUA-005',
      categoryId: categories[4].id,
      priceCents: 329900,
      costCents: 155000,
      stock: 6,
      featured: true,
      brand: 'Mavula',
      material: 'Madeira maciça e linho',
      color: 'Grafite',
      dimensions: '160x200 cm',
      shortDescription: 'Cama com cabeceira estofada e pés metálicos.',
      description:
        'Cabeceira acolchoada em linho grafite, ripas de eucalipto e pés em aço. Design hotel boutique.',
      images: [unsplash('photo-1505693416388-ac5ce068fe85')],
    },
    {
      name: 'Mesa Lateral Pedra Luna',
      sku: 'MV-MES-006',
      categoryId: categories[1].id,
      priceCents: 89900,
      costCents: 35000,
      stock: 20,
      featured: false,
      brand: 'Mavula',
      material: 'Travertino e metal',
      color: 'Creme',
      dimensions: '45x45x50 cm',
      shortDescription: 'Mesa lateral com tampo em pedra natural.',
      description:
        'Tampo em travertino selado e base tubular bronze. Peça statement para salas e quartos.',
      images: [unsplash('photo-1499933374294-4584852892ce')],
    },
    {
      name: 'Poltrona Bouclé Nest',
      sku: 'MV-SOF-007',
      categoryId: categories[0].id,
      priceCents: 189900,
      costCents: 82000,
      stock: 10,
      featured: true,
      brand: 'Mavula',
      material: 'Bouclé',
      color: 'Marfim',
      dimensions: '85x90x80 cm',
      shortDescription: 'Poltrona envolvente em tecido bouclé.',
      description:
        'Curvas orgânicas, espuma moldada e tecido bouclé macio. O cantinho de leitura perfeito.',
      images: [unsplash('photo-1567538096630-e4cde14f43ff')],
    },
    {
      name: 'Cômoda Veneza 4 Gavetas',
      sku: 'MV-QUA-008',
      categoryId: categories[4].id,
      priceCents: 219900,
      costCents: 98000,
      stock: 7,
      featured: false,
      brand: 'Mavula',
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
        slug: data.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
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

  // Fix: ProductImage doesn't have provider - remove that
  // Actually I included provider: undefined which might fail. Let me check - I used `provider: undefined as never` which is weird.
  // Better to recreate without it - but seed already written with it. Prisma create will ignore unknown? No, it will error.
  // I'll fix the seed file.

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
        description: 'Despesa de frete e logística',
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
        description: 'Receita antecipada de campanha',
        type: AccountingEntryType.REVENUE,
        status: AccountingEntryStatus.DRAFT,
        amountCents: 89000,
        debitAccountId: cash.id,
        creditAccountId: revenue.id,
        createdById: operator.id,
      },
    ],
  });

  // silence unused
  void customer;
  void operator;

  console.log('Seed concluído');
  console.log('Admin: admin@mavula.com.br / mavula123');
  console.log('Operador: operador@mavula.com.br / mavula123');
  console.log('Cliente: cliente@mavula.com.br / mavula123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
