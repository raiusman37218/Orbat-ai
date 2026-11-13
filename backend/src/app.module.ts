import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { InboxesModule } from './inboxes/inboxes.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { QueuesModule } from './queues/queues.module';
import { QueuesWorkersModule } from './queues/queues-workers.module';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { HealthModule } from './health/health.module';
import { WidgetModule } from './widget/widget.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      ignoreEnvFile: process.env.VERCEL === '1' || process.env.VERCEL === 'true',
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    AuthModule,
    WorkspacesModule,
    UsersModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    InboxesModule,
    RealtimeModule,
    AttachmentsModule,
    QueuesModule,
    ...(process.env.IS_WORKER === 'true' || process.env.ENABLE_EMBEDDED_WORKERS === 'true'
      ? [QueuesWorkersModule]
      : []),
    AiEngineModule,
    HealthModule,
    WidgetModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
