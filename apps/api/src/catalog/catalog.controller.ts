import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformRole, ProductStatus } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Post('categories')
  createCategory(
    @Body()
    body: {
      name: string;
      description?: string;
      imageUrl?: string;
      parentId?: string;
      sortOrder?: number;
    },
  ) {
    return this.catalog.createCategory(body);
  }

  @Get('products')
  listProducts(
    @Query()
    query: {
      q?: string;
      category?: string;
      shop?: string;
      shopId?: string;
      featured?: string;
      status?: ProductStatus;
      minPrice?: string;
      maxPrice?: string;
      sort?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.catalog.listProducts(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get('admin/products')
  listAdminProducts(
    @Query()
    query: {
      q?: string;
      category?: string;
      shop?: string;
      shopId?: string;
      featured?: string;
      status?: ProductStatus;
      minPrice?: string;
      maxPrice?: string;
      sort?: string;
      page?: string;
      limit?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.listProducts({
      ...query,
      platformRole: user.platformRole,
    });
  }

  @Get('products/:slugOrId')
  getProduct(@Param('slugOrId') slugOrId: string) {
    return this.catalog.getProduct(slugOrId);
  }

  @UseGuards(JwtAuthGuard, TwoFactorGuard)
  @Post('products')
  createProduct(
    @CurrentUser() user: AuthUser,
    @Body() body: Parameters<CatalogService['createProduct']>[1],
  ) {
    return this.catalog.createProduct(user.id, body);
  }

  @UseGuards(JwtAuthGuard, TwoFactorGuard)
  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: Parameters<CatalogService['updateProduct']>[2],
  ) {
    return this.catalog.updateProduct(id, user.id, body);
  }

  @UseGuards(JwtAuthGuard, TwoFactorGuard)
  @Post('products/:id/images')
  addImage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: { url: string; publicId?: string; alt?: string; isPrimary?: boolean },
  ) {
    return this.catalog.addProductImage(id, user.id, body);
  }

  @UseGuards(JwtAuthGuard, TwoFactorGuard)
  @Delete('products/:id')
  deleteProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteProduct(id, user.id);
  }
}
