export type PlatformRole =
  | "BUYER"
  | "SELLER"
  | "PLATFORM_OPERATOR"
  | "PLATFORM_ADMIN";

/** @deprecated Use PlatformRole — kept for gradual migration */
export type Role = PlatformRole;

export type ShopStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";

export type ShopRole = "OWNER" | "MANAGER" | "STAFF";

export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED" | "OUT_OF_STOCK";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type PaymentMethod =
  | "PIX"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "BANK_TRANSFER"
  | "CASH";

export type InventoryMovementType =
  | "IN"
  | "OUT"
  | "ADJUSTMENT"
  | "RESERVE"
  | "RELEASE";

export type AccountingEntryType =
  | "REVENUE"
  | "EXPENSE"
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "TRANSFER";

export type AccountingEntryStatus = "DRAFT" | "POSTED" | "VOID";

export interface User {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  /** Alias of platformRole returned by the API */
  role?: PlatformRole;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  totpEnabled?: boolean;
  emailVerifiedAt?: string | null;
  canBuy?: boolean;
  canSell?: boolean;
  createdAt?: string;
  addresses?: Address[];
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  _count?: { products: number };
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  city?: string | null;
  state?: string | null;
  status: ShopStatus;
  ownerId?: string;
  owner?: Pick<User, "id" | "name" | "email">;
  members?: Array<{ role: ShopRole; userId?: string }>;
  _count?: { products?: number; orders?: number };
  createdAt?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string | null;
  priceCents: number;
  compareAtCents?: number | null;
  stock: number;
  reservedStock: number;
  status: ProductStatus;
  categoryId?: string | null;
  shopId?: string | null;
  brand?: string | null;
  material?: string | null;
  dimensions?: string | null;
  color?: string | null;
  featured: boolean;
  category?: Category | null;
  shop?: Pick<
    Shop,
    "id" | "name" | "slug" | "status" | "city" | "state" | "logoUrl"
  > | null;
  images: ProductImage[];
  createdAt?: string;
}

export interface Paginated<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  subtotalCents: number;
  itemCount: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  notes?: string | null;
  createdAt: string;
  items: OrderItem[];
  address?: Address | null;
  user?: Pick<User, "name" | "email">;
  sellerShop?: Pick<Shop, "id" | "name" | "slug"> | null;
  sellerShopId?: string | null;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  reference?: string | null;
  createdAt: string;
  product?: Pick<Product, "id" | "name" | "sku" | "stock">;
  operator?: Pick<User, "id" | "name"> | null;
}

export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  type: AccountingEntryType;
  description?: string | null;
  isActive: boolean;
}

export interface AccountingEntry {
  id: string;
  entryNumber: string;
  description: string;
  type: AccountingEntryType;
  status: AccountingEntryStatus;
  amountCents: number;
  entryDate: string;
  debitAccountId: string;
  creditAccountId: string;
  notes?: string | null;
  postedAt?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  debitAccount?: AccountingAccount;
  creditAccount?: AccountingAccount;
  createdBy?: Pick<User, "id" | "name">;
}

export interface StoreSettings {
  id: string;
  storeName: string;
  storeSlug: string;
  tagline: string;
  supportEmail: string;
  supportPhone?: string | null;
  currency: string;
  shippingFlatCents: number;
  freeShippingCents: number;
  logoUrl?: string | null;
  primaryColor: string;
}

export interface DashboardOverview {
  kpis: {
    productCount: number;
    activeProducts: number;
    orderCount: number;
    pendingOrders: number;
    customerCount: number;
    revenueCents: number;
    lowStock: number;
  };
  accounting: Record<string, number>;
  recentOrders: Order[];
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export type LoginResult =
  | AuthResponse
  | {
      requiresEmailVerification: true;
      email: string;
      message?: string;
      devCode?: string;
    }
  | {
      requiresTwoFactor: true;
      sessionToken: string;
      message?: string;
    };

export interface RegisterResult {
  message: string;
  email: string;
  requiresEmailVerification: true;
  devCode?: string;
}

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl?: string;
  qrDataUrl?: string;
  message?: string;
}

export interface ApiErrorBody {
  message?: string | string[];
  statusCode?: number;
}
