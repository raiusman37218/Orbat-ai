import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NOTIFICATIONS, NotificationPayload } from '../queue.constants';

@Processor(QUEUE_NOTIFICATIONS, {
  concurrency: 10,
})
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<NotificationPayload>): Promise<any> {
    const { template, recipientEmail, subject } = job.data;
    this.logger.log(`Sending notification [${template}] to ${recipientEmail}: "${subject}"`);

    // In production, integrate with SendGrid/SMTP or Resend
    return {
      sent: true,
      recipient: recipientEmail,
      template,
      timestamp: new Date().toISOString(),
    };
  }
}

