import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations')
  list(@CurrentUser() user: AuthUser) {
    return this.messages.listConversations(user.id);
  }

  @Post('conversations')
  start(
    @CurrentUser() user: AuthUser,
    @Body() body: { shopId: string; productId?: string; subject?: string },
  ) {
    return this.messages.start(user.id, body);
  }

  @Get('conversations/:id/messages')
  listMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.listMessages(id, user.id);
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.messages.send(id, user.id, body.body);
  }
}
