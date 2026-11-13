import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';

@ApiTags('Contacts (Visitors)')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts / visitors with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of contacts.' })
  async getContacts(
    @CurrentWorkspace() workspaceId: string,
    @Query() query: QueryContactsDto,
  ) {
    return this.contactsService.getContacts(workspaceId, query);
  }

  @Get('live-meta')
  @ApiOperation({ summary: 'Batch load recent page history and open tickets for live visitors' })
  @ApiResponse({ status: 200, description: 'Live visitor metadata returned.' })
  async getLiveMeta(
    @CurrentWorkspace() workspaceId: string,
    @Query('visitorIds') visitorIds?: string,
  ) {
    const ids = (visitorIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.contactsService.getLiveVisitorMeta(workspaceId, ids);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact profile and page history by ID' })
  @ApiResponse({ status: 200, description: 'Contact details returned.' })
  @ApiResponse({ status: 404, description: 'Contact not found.' })
  async getContactById(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') contactId: string,
  ) {
    return this.contactsService.getContactById(workspaceId, contactId);
  }

  @Post()
  @ApiOperation({ summary: 'Create or upsert contact' })
  @ApiResponse({ status: 201, description: 'Contact created or updated.' })
  async createContact(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.createOrUpsertContact(workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact details' })
  @ApiResponse({ status: 200, description: 'Contact updated.' })
  async updateContact(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.updateContact(workspaceId, contactId, dto);
  }

  @Get(':id/conversations')
  @ApiOperation({ summary: 'Get all conversation threads for this contact' })
  @ApiResponse({ status: 200, description: 'List of conversations.' })
  async getConversations(
    @CurrentWorkspace() workspaceId: string,
    @Param('id') contactId: string,
  ) {
    return this.contactsService.getConversations(workspaceId, contactId);
  }
}

