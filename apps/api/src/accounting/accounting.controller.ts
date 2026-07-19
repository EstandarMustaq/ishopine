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
  Role,
} from '@prisma/client';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Roles(Role.ADMIN, Role.OPERATOR)
  @Get('accounts')
  listAccounts() {
    return this.accounting.listAccounts();
  }

  @Roles(Role.ADMIN)
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

  @Roles(Role.ADMIN, Role.OPERATOR)
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

  @Roles(Role.ADMIN, Role.OPERATOR)
  @Get('summary')
  summary() {
    return this.accounting.summary();
  }

  @Roles(Role.ADMIN, Role.OPERATOR)
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

  @Roles(Role.ADMIN)
  @Patch('entries/:id/post')
  postEntry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accounting.postEntry(id, user.id);
  }

  @Roles(Role.ADMIN)
  @Patch('entries/:id/void')
  voidEntry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.accounting.voidEntry(id, user.id, user.role as Role);
  }
}
