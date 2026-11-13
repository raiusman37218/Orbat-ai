import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/tenant-context';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get messages for a conversation thread' })
  @ApiResponse({ status: 200, description: 'List of messages returned.' })
  async getMessages(
    @CurrentWorkspace() workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.messagesService.getMessages(workspaceId, conversationId, limit ? Number(limit) : 50, before);
  }

  @Post()
  @ApiOperation({ summary: 'Send a message or internal note in a conversation' })
  @ApiResponse({ status: 201, description: 'Message created and delivered.' })
  async sendMessage(
    @CurrentWorkspace() workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.sendMessage(workspaceId, conversationId, dto, user);
  }

  @Patch(':messageId')
  @ApiOperation({ summary: 'Edit a message in a conversation' })
  @ApiResponse({ status: 200, description: 'Message updated.' })
  async editMessage(
    @CurrentWorkspace() workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.editMessage(workspaceId, conversationId, messageId, dto, user);
  }

  @Delete(':messageId')
  @ApiOperation({ summary: 'Delete a message in a conversation' })
  @ApiResponse({ status: 200, description: 'Message deleted.' })
  async deleteMessage(
    @CurrentWorkspace() workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.deleteMessage(workspaceId, conversationId, messageId, user);
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark messages in conversation as read' })
  @ApiResponse({ status: 200, description: 'Read receipts recorded.' })
  async markAsRead(
    @CurrentWorkspace() workspaceId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagesService.markAsRead(workspaceId, conversationId, 'agent');
  }

  @Post('deliver')
  @ApiOperation({ summary: 'Mark messages in conversation as delivered' })
  @ApiResponse({ status: 200, description: 'Delivery receipts recorded.' })
  async markAsDelivered(
    @CurrentWorkspace() workspaceId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagesService.markAsDelivered(workspaceId, conversationId);
  }
}

