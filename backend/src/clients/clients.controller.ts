import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { ListClientsQueryDto } from "./dto/list-clients-query.dto";
import { CreateCustomerContactDto, UpdateCustomerContactDto } from "./dto/customer-contact.dto";
import { CreateApprovalStageTemplateDto, UpdateApprovalStageTemplateDto } from "./dto/approval-stage-template.dto";
import { CreateCustomerDocumentRuleDto, UpdateCustomerDocumentRuleDto } from "./dto/customer-document-rule.dto";
import { ClientsService } from "./clients.service";

@ApiTags("clients")
@ApiBearerAuth()
@Controller("clients")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "List clients with search and pagination" })
  list(@Query() query: ListClientsQueryDto) {
    return this.clientsService.list(query);
  }

  @Get(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "Get a client by id" })
  get(@Param("id") id: string) {
    return this.clientsService.get(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Create a client" })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Update a client" })
  update(@Param("id") id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER)
  @ApiOperation({ summary: "Deactivate a client (soft delete)" })
  deactivate(@Param("id") id: string) {
    return this.clientsService.deactivate(id);
  }

  // ============================================================
  // CUSTOMER CONTACTS
  // ============================================================

  @Get(":id/contacts")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "List contacts for a customer" })
  listContacts(@Param("id") id: string) {
    return this.clientsService.listContacts(id);
  }

  @Post(":id/contacts")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Add a contact for a customer" })
  createContact(@Param("id") id: string, @Body() dto: CreateCustomerContactDto) {
    return this.clientsService.createContact(id, dto);
  }

  @Patch(":id/contacts/:contactId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Update a customer contact" })
  updateContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body() dto: UpdateCustomerContactDto,
  ) {
    return this.clientsService.updateContact(id, contactId, dto);
  }

  @Delete(":id/contacts/:contactId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Delete a customer contact" })
  deleteContact(@Param("id") id: string, @Param("contactId") contactId: string) {
    return this.clientsService.deleteContact(id, contactId);
  }

  // ============================================================
  // APPROVAL STAGE TEMPLATES
  // ============================================================

  @Get(":id/approval-templates")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "List approval stage templates for a customer" })
  listApprovalTemplates(@Param("id") id: string) {
    return this.clientsService.listApprovalTemplates(id);
  }

  @Post(":id/approval-templates")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Create an approval stage template for a customer" })
  createApprovalTemplate(@Param("id") id: string, @Body() dto: CreateApprovalStageTemplateDto) {
    return this.clientsService.createApprovalTemplate(id, dto);
  }

  @Patch(":id/approval-templates/:templateId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Update an approval stage template" })
  updateApprovalTemplate(
    @Param("id") id: string,
    @Param("templateId") templateId: string,
    @Body() dto: UpdateApprovalStageTemplateDto,
  ) {
    return this.clientsService.updateApprovalTemplate(id, templateId, dto);
  }

  @Delete(":id/approval-templates/:templateId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Delete an approval stage template" })
  deleteApprovalTemplate(@Param("id") id: string, @Param("templateId") templateId: string) {
    return this.clientsService.deleteApprovalTemplate(id, templateId);
  }

  // ============================================================
  // CUSTOMER DOCUMENT RULES
  // ============================================================

  @Get(":id/document-rules")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.ACCOUNTS, Role.STAFF, Role.VIEWER)
  @ApiOperation({ summary: "List document rules for a customer" })
  listDocumentRules(@Param("id") id: string) {
    return this.clientsService.listDocumentRules(id);
  }

  @Post(":id/document-rules")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Create a document rule for a customer" })
  createDocumentRule(@Param("id") id: string, @Body() dto: CreateCustomerDocumentRuleDto) {
    return this.clientsService.createDocumentRule(id, dto);
  }

  @Patch(":id/document-rules/:ruleId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Update a customer document rule" })
  updateDocumentRule(
    @Param("id") id: string,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateCustomerDocumentRuleDto,
  ) {
    return this.clientsService.updateDocumentRule(id, ruleId, dto);
  }

  @Delete(":id/document-rules/:ruleId")
  @Roles(Role.ADMIN, Role.DISPATCH_MANAGER, Role.STAFF)
  @ApiOperation({ summary: "Delete a customer document rule" })
  deleteDocumentRule(@Param("id") id: string, @Param("ruleId") ruleId: string) {
    return this.clientsService.deleteDocumentRule(id, ruleId);
  }
}
