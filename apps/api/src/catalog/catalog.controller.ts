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
import { ProductStatus, Role } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Get('admin/products')
  listAdminProducts(
    @Query()
    query: {
      q?: string;
      category?: string;
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
    return this.catalog.listProducts({ ...query, role: user.role as Role });
  }

  @Get('products/:slugOrId')
  getProduct(@Param('slugOrId') slugOrId: string) {
    return this.catalog.getProduct(slugOrId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Post('products')
  createProduct(@Body() body: Parameters<CatalogService['createProduct']>[0]) {
    return this.catalog.createProduct(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() body: Parameters<CatalogService['updateProduct']>[1],
  ) {
    return this.catalog.updateProduct(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OPERATOR)
  @Post('products/:id/images')
  addImage(
    @Param('id') id: string,
    @Body()
    body: { url: string; publicId?: string; alt?: string; isPrimary?: boolean },
  ) {
    return this.catalog.addProductImage(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.catalog.deleteProduct(id);
  }
}
