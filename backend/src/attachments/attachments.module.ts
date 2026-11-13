import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { CloudflareR2StorageProvider } from './storage/cloudflare-r2.provider';
import { STORAGE_PROVIDER } from './storage/storage-provider.interface';

@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    CloudflareR2StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useClass: CloudflareR2StorageProvider,
    },
  ],
  exports: [AttachmentsService, STORAGE_PROVIDER],
})
export class AttachmentsModule {}

