import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/tenant-context';

@ApiTags('Users & Team')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all agents and team members in current workspace' })
  @ApiResponse({ status: 200, description: 'List of agents returned.' })
  async getAgents(@CurrentWorkspace() workspaceId: string) {
    return this.usersService.getAgents(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent profile by ID' })
  @ApiResponse({ status: 200, description: 'Agent details returned.' })
  @ApiResponse({ status: 404, description: 'Agent not found.' })
  async getAgentById(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') agentId: string,
  ) {
    return this.usersService.getAgentById(workspaceId, agentId);
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create or invite a new agent to the workspace' })
  @ApiResponse({ status: 201, description: 'Agent created successfully.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async createAgent(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateAgentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.createAgent(workspaceId, dto, actor);
  }

  @Patch('me/status')
  @ApiOperation({ summary: 'Update current agent status (online, away, offline)' })
  @ApiResponse({ status: 200, description: 'Status updated.' })
  async updateMyStatus(
    @CurrentWorkspace() workspaceId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body('status') status: 'online' | 'away' | 'offline',
  ) {
    return this.usersService.updateMyStatus(workspaceId, actor.id, status);
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update agent profile or permissions' })
  @ApiResponse({ status: 200, description: 'Agent updated successfully.' })
  async updateAgent(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') agentId: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateAgent(workspaceId, agentId, dto, actor);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Deactivate an agent' })
  @ApiResponse({ status: 200, description: 'Agent deactivated.' })
  async deactivateAgent(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') agentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.deactivateAgent(workspaceId, agentId, actor);
  }
}

