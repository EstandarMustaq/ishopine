import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AccountingEntryStatus,
  AccountingEntryType,
  PlatformRole,
} from '@prisma/client';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorGuard } from '../common/guards/two-factor.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, TwoFactorGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get('accounts')
  listAccounts() {
    return this.accounting.listAccounts();
  }

  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Post('accounts')
  createAccount(
    @Body()
    body: {
      code: string;
      name: string;
      type: AccountingEntryType;
      description?: string;
    },
  ) {
    return this.accounting.createAccount(body);
  }

  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get('entries')
  listEntries(
    @Query()
    query: {
      status?: AccountingEntryStatus;
      type?: AccountingEntryType;
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.accounting.listEntries(query);
  }

  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Get('summary')
  summary() {
    return this.accounting.summary();
  }

  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_OPERATOR)
  @Post('entries')
  createEntry(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      description: string;
      type: AccountingEntryType;
      amountCents: number;
      debitAccountId: string;
      creditAccountId: string;
      orderId?: string;
      notes?: string;
      entryDate?: string;
      postImmediately?: boolean;
    },
  ) {
    return this.accounting.createEntry(user.id, body);
  }

  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Patch('entries/:id/post')
  postEntry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accounting.postEntry(id, user.id);
  }

  @Roles(PlatformRole.PLATFORM_ADMIN)
  @Patch('entries/:id/void')
  voidEntry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accounting.voidEntry(id, user.id, user.platformRole);
  }
}
