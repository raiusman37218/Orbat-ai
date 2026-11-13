import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiEngineService } from './ai-engine.service';
import { AiUsageService } from './ai-usage.service';
import { GenerateAiReplyDto } from './dto/generate-reply.dto';

@ApiTags('AI Engine')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/ai')
export class AiEngineController {
  constructor(
    private readonly aiService: AiEngineService,
    private readonly aiUsage: AiUsageService,
  ) {}

  @Post('generate-reply')
  @ApiOperation({ summary: 'Generate grounded AI bot reply for conversation' })
  async generateReply(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: GenerateAiReplyDto,
  ) {
    return this.aiService.generateBotResponse(
      workspaceId,
      dto.conversationId,
      dto.triggerMessage,
      dto.triggerMessageId,
    );
  }

  @Post('conversations/:id/copilot-suggest')
  @ApiOperation({ summary: 'Generate agent copilot reply suggestions' })
  async copilotSuggest(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.aiService.suggestCopilotReply(workspaceId, conversationId);
  }

  @Post('conversations/:id/summarize')
  @ApiOperation({ summary: 'Summarize conversation messages for handoff' })
  async summarize(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ) {
    return this.aiService.summarizeConversation(workspaceId, conversationId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get workspace AI token usage and accounting metrics' })
  async getUsageMetrics(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.aiUsage.getWorkspaceAiMetrics(workspaceId);
  }
}

