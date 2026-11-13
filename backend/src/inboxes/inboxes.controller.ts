import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InboxesService } from './inboxes.service';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/tenant-context';

@ApiTags('Inboxes & Queues')
@ApiBearerAuth()
@Controller('inboxes')
export class InboxesController {
  constructor(private readonly inboxesService: InboxesService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get summary counts for all inbox queues (my assigned, unassigned, waiting handoff, etc.)' })
  @ApiResponse({ status: 200, description: 'Overview counts returned.' })
  async getOverview(
    @CurrentWorkspace() workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inboxesService.getInboxOverview(workspaceId, user);
  }

  @Get('my-assigned')
  @ApiOperation({ summary: 'Get open conversations assigned to the current agent' })
  @ApiResponse({ status: 200, description: 'Paginated list of assigned conversations.' })
  async getMyAssigned(
    @CurrentWorkspace() workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inboxesService.getMyAssigned(workspaceId, user, page ? Number(page) : 1, limit ? Number(limit) : 25);
  }

  @Get('unassigned')
  @ApiOperation({ summary: 'Get unassigned open conversations waiting for triage' })
  @ApiResponse({ status: 200, description: 'Paginated list of unassigned conversations.' })
  async getUnassigned(
    @CurrentWorkspace() workspaceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inboxesService.getUnassigned(workspaceId, page ? Number(page) : 1, limit ? Number(limit) : 25);
  }

  @Get('waiting-handoff')
  @ApiOperation({ summary: 'Get conversations waiting for human agent handoff or in offline queue' })
  @ApiResponse({ status: 200, description: 'List of handoff conversations.' })
  async getWaitingHandoff(
    @CurrentWorkspace() workspaceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inboxesService.getWaitingHandoff(workspaceId, page ? Number(page) : 1, limit ? Number(limit) : 25);
  }

  @Post(':conversationId/auto-assign')
  @ApiOperation({ summary: 'Trigger round-robin / workload-based auto assignment to next available agent' })
  @ApiResponse({ status: 200, description: 'Auto-assignment result.' })
  async autoAssign(
    @CurrentWorkspace() workspaceId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.inboxesService.autoAssignNext(workspaceId, conversationId);
  }
}

