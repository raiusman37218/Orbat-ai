import * as crypto from 'node:crypto';
import { Processor } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_WEBHOOKS, WebhookPayload } from '../queue.constants';
import { resolveAndVerifyPublicHttpsUrl } from '../../common/security/url-safety';
import { QueuesService } from '../queues.service';
import { BaseQueueProcessor } from './base.processor';

@Processor(QUEUE_WEBHOOKS, {
  concurrency: 5,
  lockDuration: 30_000,
})
export class WebhooksProcessor extends BaseQueueProcessor {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(@Optional() queuesService?: QueuesService) {
    super(queuesService);
  }

  async process(job: Job<WebhookPayload>): Promise<any> {
    const { event, endpointUrl, payload, secretKey, workspaceId } = job.data;
    const verifiedUrl = await resolveAndVerifyPublicHttpsUrl(endpointUrl);

    const body = JSON.stringify({
      event,
      workspaceId,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'OrbatAI-Webhook-Worker/1.0',
      'X-Orbat-Event': event,
    };

    if (secretKey) {
      headers['X-Orbat-Signature'] = crypto
        .createHmac('sha256', secretKey)
        .update(body)
        .digest('hex');
    }

    const res = await fetch(verifiedUrl.toString(), {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Webhook target returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    this.logger.log(`Delivered webhook ${event} (${job.id}) -> HTTP ${res.status}`);
    return {
      delivered: true,
      statusCode: res.status,
      event,
    };
  }
}
