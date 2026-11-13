import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { BulkUpdateConversationsDto } from './dto/bulk-update-conversations.dto';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/tenant-context';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List conversation threads with pagination and status filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of conversations.' })
  async getConversations(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: QueryConversationsDto,
  ) {
    return this.conversationsService.getConversations(workspaceId, query);
  }

  @Get('handovers')
  @ApiOperation({ summary: 'List recent AI handover notes for this workspace' })
  @ApiResponse({ status: 200, description: 'List of handover rows.' })
  async getHandovers(
    @CurrentWorkspace() workspaceId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conversationsService.getHandovers(
      workspaceId,
      days ? parseInt(days, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk resolve, reopen, assign, or mark spam for conversations' })
  @ApiResponse({ status: 200, description: 'Bulk conversation action completed.' })
  async bulkUpdateConversations(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: BulkUpdateConversationsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.conversationsService.bulkUpdate(workspaceId, dto, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full conversation thread details by ID' })
  @ApiResponse({ status: 200, description: 'Conversation thread returned.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async getConversationById(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') conversationId: string,
  ) {
    return this.conversationsService.getConversationById(workspaceId, conversationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation thread' })
  @ApiResponse({ status: 201, description: 'Conversation created.' })
  async createConversation(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.createConversation(workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation status, priority, or tags' })
  @ApiResponse({ status: 200, description: 'Conversation updated.' })
  async updateConversation(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.updateConversation(workspaceId, conversationId, dto);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign conversation to an agent (or unassign)' })
  @ApiResponse({ status: 200, description: 'Conversation assignment updated.' })
  async assignConversation(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') conversationId: string,
    @Body('agentId') agentId: string | null,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.conversationsService.assignConversation(workspaceId, conversationId, agentId, actor);
  }

  @Post(':id/claim')
  @ApiOperation({ summary: 'Claim waiting handoff conversation for current agent' })
  @ApiResponse({ status: 200, description: 'Conversation claimed.' })
  async claimHandoff(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') conversationId: string,
    @CurrentUser() agent: AuthenticatedUser,
  ) {
    return this.conversationsService.claimHandoff(workspaceId, conversationId, agent);
  }

  @Post(':id/skip')
  @ApiOperation({ summary: 'Skip waiting handoff conversation and advance ringing queue' })
  @ApiResponse({ status: 200, description: 'Conversation skipped.' })
  async skipHandoff(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') conversationId: string,
    @CurrentUser() agent: AuthenticatedUser,
  ) {
    return this.conversationsService.skipHandoff(workspaceId, conversationId, agent);
  }

  @Post(':id/return-to-ai')
  @ApiOperation({ summary: 'Return human-handled conversation back to AI assistant' })
  @ApiResponse({ status: 200, description: 'Returned to AI bot.' })
  async returnToAi(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') conversationId: string,
    @CurrentUser() agent: AuthenticatedUser,
  ) {
    return this.conversationsService.returnToAi(workspaceId, conversationId, agent);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close and resolve conversation' })
  @ApiResponse({ status: 200, description: 'Conversation closed.' })
  async closeConversation(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') conversationId: string,
    @CurrentUser() agent: AuthenticatedUser,
  ) {
    return this.conversationsService.closeConversation(workspaceId, conversationId, agent);
  }
}

