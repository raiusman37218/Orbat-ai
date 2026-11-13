import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_WEBHOOKS, WebhookPayload } from '../queue.constants';

@Processor(QUEUE_WEBHOOKS, {
  concurrency: 5,
})
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  async process(job: Job<WebhookPayload>): Promise<any> {
    const { event, endpointUrl, payload } = job.data;
    this.logger.log(`Dispatching webhook event ${event} to ${endpointUrl}`);

    // In production, execute signed HTTPS POST request with retry
    return {
      delivered: true,
      statusCode: 200,
      endpointUrl,
      event,
    };
  }
}

