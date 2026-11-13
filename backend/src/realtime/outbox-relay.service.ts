import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { RealtimeService } from './realtime.service';

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | null = null;
  private isTicking = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit() {
    const isTest = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
    const isWorkerOnly = process.env.IS_WORKER === 'true';
    const isServerless =
      process.env.VERCEL === '1' ||
      process.env.VERCEL === 'true' ||
      process.env.DISABLE_OUTBOX_RELAY === 'true';
    if (isTest || isWorkerOnly || isServerless) return;

    this.timer = setInterval(() => {
      void this.tick();
    }, 1500);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.isTicking || !this.realtime.isReady()) return;
    this.isTicking = true;
    try {
      await this.outbox.relayPendingEvents(50);
    } catch (err: any) {
      this.logger.warn(`Outbox relay sweep failed: ${err?.message || err}`);
    } finally {
      this.isTicking = false;
    }
  }
}

