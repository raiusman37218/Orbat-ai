import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { WidgetService } from './widget.service';

@ApiTags('Widget')
@Public()
@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get public widget configuration for a workspace' })
  async getConfig(@Query('workspaceId') workspaceId: string) {
    return this.widgetService.getConfig(workspaceId);
  }

  @Get('agents')
  @ApiOperation({ summary: 'Get sanitized workspace agent presence and avatars for widget' })
  async getAgents(@Query('workspaceId') workspaceId: string) {
    return this.widgetService.getAgents(workspaceId);
  }

  @Get('help')
  @ApiOperation({ summary: 'Get published Help Center sections and articles for widget' })
  async getHelp(@Query('workspaceId') workspaceId: string) {
    return this.widgetService.getHelp(workspaceId);
  }

  @Post('session')
  @ApiOperation({ summary: 'Create or verify visitor session token for widget' })
  async session(@Body() body: Record<string, any>) {
    return this.widgetService.createOrVerifySession(body);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List visitor conversations' })
  async listConversations(
    @Query('visitorId') visitorId: string,
    @Query('token') token: string,
  ) {
    return this.widgetService.listConversations(visitorId, token);
  }

  @Post('conversations/start')
  @ApiOperation({ summary: 'Start or resume visitor conversation' })
  async startConversation(@Body() body: Record<string, any>) {
    return this.widgetService.startConversation(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      Boolean(body.forceNew ?? body.p_force_new),
    );
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Fetch visitor conversation messages' })
  async getMessages(
    @Param('id') conversationId: string,
    @Query('visitorId') visitorId: string,
    @Query('token') token: string,
  ) {
    return this.widgetService.getMessages(visitorId, token, conversationId);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send visitor message via widget' })
  async sendMessage(
    @Param('id') conversationId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.widgetService.sendMessage(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      conversationId,
      body.content ?? body.p_content ?? '',
      body.attachmentUrl ?? body.p_attachment_url ?? null,
    );
  }

  @Post('conversations/:id/handoff')
  async requestHandoff(@Param('id') conversationId: string, @Body() body: Record<string, any>) {
    return this.widgetService.requestHandoff(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      conversationId,
      body.reason ?? body.p_reason ?? null,
    );
  }

  @Post('conversations/:id/ai-assist')
  async setAiAssist(@Param('id') conversationId: string, @Body() body: Record<string, any>) {
    return this.widgetService.setAiAssist(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      conversationId,
      body.enabled ?? body.p_enabled ?? true,
    );
  }

  @Post('conversations/:id/topic')
  async setTopic(@Param('id') conversationId: string, @Body() body: Record<string, any>) {
    return this.widgetService.setTopic(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      conversationId,
      body.topic ?? body.p_topic ?? '',
    );
  }

  @Post('conversations/:id/resolve')
  async markResolved(@Param('id') conversationId: string, @Body() body: Record<string, any>) {
    return this.widgetService.markResolved(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      conversationId,
    );
  }

  @Post('conversations/:id/welcome')
  async saveWelcome(@Param('id') conversationId: string, @Body() body: Record<string, any>) {
    return this.widgetService.saveWelcome(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      conversationId,
      body.content ?? body.p_content ?? '',
    );
  }

  @Post('heartbeat')
  async heartbeat(@Body() body: Record<string, any>) {
    return this.widgetService.heartbeat(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      body,
    );
  }

  @Post('pageview')
  async recordPage(@Body() body: Record<string, any>) {
    return this.widgetService.recordPage(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      body,
    );
  }

  @Post('meta')
  async updateMeta(@Body() body: Record<string, any>) {
    return this.widgetService.updateMeta(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      body,
    );
  }

  @Post('visitor')
  async updateVisitor(@Body() body: Record<string, any>) {
    return this.widgetService.updateVisitor(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      body,
    );
  }

  @Post('offline')
  async offline(@Body() body: Record<string, any>) {
    return this.widgetService.markOffline(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
    );
  }

  @Post('mark')
  async mark(@Body() body: Record<string, any>) {
    return this.widgetService.markMessages(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      body.conversationId ?? body.p_conversation_id,
      body.read ?? body.p_read ?? true,
    );
  }

  @Post('csat')
  async submitCsat(@Body() body: Record<string, any>) {
    return this.widgetService.submitCsat(
      body.visitorId ?? body.p_visitor_id,
      body.token ?? body.p_token,
      body.conversationId ?? body.p_conversation_id,
      body.rating,
      body.feedback ?? null,
    );
  }

  @Post('rpc/:fnName')
  @ApiOperation({ summary: 'Execute a whitelisted fn_widget_* RPC cleanly through NestJS' })
  async rpc(@Param('fnName') fnName: string, @Body() body: Record<string, any>) {
    return this.widgetService.invokeWhitelistedRpc(fnName, body || {});
  }
}
