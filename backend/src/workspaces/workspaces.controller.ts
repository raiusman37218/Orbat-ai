import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get details of the current workspace' })
  @ApiResponse({ status: 200, description: 'Workspace details retrieved.' })
  async getCurrentWorkspace(@CurrentWorkspace() workspaceId: string) {
    return this.workspacesService.getWorkspace(workspaceId);
  }

  @Patch('current')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update workspace branding, settings, or business hours (Owner / Admin only)' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully.' })
  async updateCurrentWorkspace(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.updateWorkspace(workspaceId, dto);
  }

  @Get('current/members')
  @ApiOperation({ summary: 'List all active agents in the current workspace' })
  @ApiResponse({ status: 200, description: 'List of members returned.' })
  async getMembers(@CurrentWorkspace() workspaceId: string) {
    return this.workspacesService.getMembers(workspaceId);
  }

  @Get('current/stats')
  @ApiOperation({ summary: 'Get live real-time metrics and conversation counters' })
  @ApiResponse({ status: 200, description: 'Aggregated workspace stats returned.' })
  async getStats(@CurrentWorkspace() workspaceId: string) {
    return this.workspacesService.getWorkspaceStats(workspaceId);
  }
}

