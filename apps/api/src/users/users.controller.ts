import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Nest users remnant (Phase 33). Admin users HTTP → platform-ops.
 * Addresses kept as Nest fallthrough (accounts owns via gateway).
 */
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('addresses')
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.users.listAddresses(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('addresses')
  createAddress(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      label?: string;
      street: string;
      number: string;
      complement?: string;
      district: string;
      city: string;
      state: string;
      zipCode: string;
      isDefault?: boolean;
    },
  ) {
    return this.users.createAddress(user.id, body);
  }
}
