import { DatabaseService } from '../database/database.service';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
export declare class ContactsService {
    private readonly db;
    private readonly logger;
    constructor(db: DatabaseService);
    getContacts(workspaceId: string, query: QueryContactsDto): Promise<{
        items: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getContactById(workspaceId: string, contactId: string): Promise<any>;
    createOrUpsertContact(workspaceId: string, dto: CreateContactDto): Promise<any>;
    updateContact(workspaceId: string, contactId: string, dto: UpdateContactDto): Promise<any>;
    getConversations(workspaceId: string, contactId: string): Promise<any[]>;
}
