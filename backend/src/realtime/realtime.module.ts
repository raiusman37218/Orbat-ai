import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MessagesModule } from '../messages/messages.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { OutboxService } from './outbox.service';
import { OutboxRelayService } from './outbox-relay.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    DatabaseModule,
    forwardRef(() => MessagesModule),
  ],
  providers: [RealtimeGateway, RealtimeService, OutboxService, OutboxRelayService],
  exports: [RealtimeGateway, RealtimeService, OutboxService],
})
export class RealtimeModule {}

