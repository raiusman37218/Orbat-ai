import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { RealtimeService } from './realtime.service';
export declare class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
    private readonly outbox;
    private readonly realtime;
    private readonly logger;
    private timer;
    private isTicking;
    constructor(outbox: OutboxService, realtime: RealtimeService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private tick;
}
