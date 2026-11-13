import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/tenant-context';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Attachments & Storage')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('presign-upload')
  @ApiOperation({ summary: 'Generate presigned S3/R2 upload URL for file' })
  async presignUpload(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: PresignUploadDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.attachmentsService.createPresignedUpload(workspaceId, dto, user);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm file has finished uploading to storage' })
  async confirmUpload(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachmentsService.confirmUpload(workspaceId, attachmentId);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Get secure signed download URL for private attachment' })
  async getDownloadUrl(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachmentsService.getDownloadUrl(workspaceId, attachmentId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete attachment file and metadata' })
  async deleteAttachment(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('id', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.attachmentsService.deleteAttachment(workspaceId, attachmentId);
  }
}

