import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalStageTemplate, Client, CustomerContact, CustomerDocumentRule, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { ListClientsQueryDto } from "./dto/list-clients-query.dto";
import { CreateCustomerContactDto, UpdateCustomerContactDto } from "./dto/customer-contact.dto";
import { CreateApprovalStageTemplateDto, UpdateApprovalStageTemplateDto } from "./dto/approval-stage-template.dto";
import { CreateCustomerDocumentRuleDto, UpdateCustomerDocumentRuleDto } from "./dto/customer-document-rule.dto";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListClientsQueryDto) {
    const where: Prisma.ClientWhereInput = { deletedAt: null };

    if (query.status) {
      where.status = query.status;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const limit = query.limit ?? 50;
    const skip = query.skip ?? 0;

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          contacts: true,
          approvalTemplates: { orderBy: { sequence: "asc" } },
          documentRules: true,
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, meta: { total, limit, offset: skip } };
  }

  async get(id: string): Promise<Client & { contacts?: CustomerContact[]; approvalTemplates?: ApprovalStageTemplate[]; documentRules?: CustomerDocumentRule[] }> {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: true,
        approvalTemplates: { orderBy: { sequence: "asc" } },
        documentRules: true,
      },
    });
    if (!client) throw new NotFoundException("Client not found.");
    return client;
  }

  async create(dto: CreateClientDto): Promise<Client> {
    const paymentTerms = dto.creditDays ?? dto.paymentTermsDays ?? 30;
    const data: Prisma.ClientUncheckedCreateInput = {
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      gstin: dto.gstin ? dto.gstin.trim().toUpperCase() : null,
      stateCode: dto.stateCode ? dto.stateCode.trim() : null,
      paymentTermsDays: paymentTerms,
      creditDays: paymentTerms,
      digitalPodEnabled: dto.digitalPodEnabled ?? false,
      status: "ACTIVE",
    } as Prisma.ClientUncheckedCreateInput;

    try {
      return await this.prisma.client.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A client with this code already exists.");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    await this.get(id);

    const VALID_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    if (dto.status !== undefined && !VALID_STATUSES.includes(dto.status)) {
      throw new BadRequestException("Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED.");
    }

    const data: Prisma.ClientUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.gstin !== undefined) data.gstin = dto.gstin ? dto.gstin.trim().toUpperCase() : null;
    if (dto.stateCode !== undefined) data.stateCode = dto.stateCode ? dto.stateCode.trim() : null;
    if (dto.paymentTermsDays !== undefined) {
      data.paymentTermsDays = dto.paymentTermsDays;
      if (dto.creditDays === undefined) data.creditDays = dto.paymentTermsDays;
    }
    if (dto.creditDays !== undefined) {
      data.creditDays = dto.creditDays;
      if (dto.paymentTermsDays === undefined) data.paymentTermsDays = dto.creditDays;
    }
    if (dto.digitalPodEnabled !== undefined) data.digitalPodEnabled = dto.digitalPodEnabled;
    if (dto.status !== undefined) data.status = dto.status;

    try {
      return await this.prisma.client.update({ where: { id }, data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A client with this code already exists.");
      }
      throw error;
    }
  }

  async deactivate(id: string): Promise<{ success: true }> {
    await this.get(id);
    await this.prisma.client.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
    return { success: true };
  }

  // ============================================================
  // CUSTOMER CONTACTS
  // ============================================================

  async listContacts(clientId: string): Promise<CustomerContact[]> {
    await this.get(clientId);
    return this.prisma.customerContact.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createContact(clientId: string, dto: CreateCustomerContactDto): Promise<CustomerContact> {
    await this.get(clientId);

    if (dto.isPrimary) {
      // Clear existing primary contact flag for this client
      await this.prisma.customerContact.updateMany({
        where: { clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.customerContact.create({
      data: {
        clientId,
        name: dto.name.trim(),
        role: dto.role?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        isPrimary: dto.isPrimary ?? false,
      } as Prisma.CustomerContactUncheckedCreateInput,
    });
  }

  async updateContact(clientId: string, contactId: string, dto: UpdateCustomerContactDto): Promise<CustomerContact> {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, clientId },
    });
    if (!contact) throw new NotFoundException("Contact not found.");

    if (dto.isPrimary) {
      await this.prisma.customerContact.updateMany({
        where: { clientId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    const data: Prisma.CustomerContactUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role?.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null;
    if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;

    return this.prisma.customerContact.update({
      where: { id: contactId },
      data,
    });
  }

  async deleteContact(clientId: string, contactId: string): Promise<{ success: true }> {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, clientId },
    });
    if (!contact) throw new NotFoundException("Contact not found.");

    await this.prisma.customerContact.delete({
      where: { id: contactId },
    });
    return { success: true };
  }

  // ============================================================
  // APPROVAL STAGE TEMPLATES
  // ============================================================

  async listApprovalTemplates(clientId: string): Promise<ApprovalStageTemplate[]> {
    await this.get(clientId);
    return this.prisma.approvalStageTemplate.findMany({
      where: { clientId },
      orderBy: { sequence: "asc" },
    });
  }

  async createApprovalTemplate(clientId: string, dto: CreateApprovalStageTemplateDto): Promise<ApprovalStageTemplate> {
    await this.get(clientId);

    try {
      return await this.prisma.approvalStageTemplate.create({
        data: {
          clientId,
          sequence: dto.sequence,
          name: dto.name.trim(),
          slaHours: dto.slaHours ?? 48,
        } as Prisma.ApprovalStageTemplateUncheckedCreateInput,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An approval stage template with this sequence number already exists for this client.");
      }
      throw error;
    }
  }

  async updateApprovalTemplate(clientId: string, templateId: string, dto: UpdateApprovalStageTemplateDto): Promise<ApprovalStageTemplate> {
    const template = await this.prisma.approvalStageTemplate.findFirst({
      where: { id: templateId, clientId },
    });
    if (!template) throw new NotFoundException("Approval stage template not found.");

    const data: Prisma.ApprovalStageTemplateUncheckedUpdateInput = {};
    if (dto.sequence !== undefined) data.sequence = dto.sequence;
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slaHours !== undefined) data.slaHours = dto.slaHours;

    try {
      return await this.prisma.approvalStageTemplate.update({
        where: { id: templateId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An approval stage template with this sequence number already exists for this client.");
      }
      throw error;
    }
  }

  async deleteApprovalTemplate(clientId: string, templateId: string): Promise<{ success: true }> {
    const template = await this.prisma.approvalStageTemplate.findFirst({
      where: { id: templateId, clientId },
    });
    if (!template) throw new NotFoundException("Approval stage template not found.");

    await this.prisma.approvalStageTemplate.delete({
      where: { id: templateId },
    });
    return { success: true };
  }

  // ============================================================
  // CUSTOMER DOCUMENT RULES
  // ============================================================

  async listDocumentRules(clientId: string): Promise<CustomerDocumentRule[]> {
    await this.get(clientId);
    return this.prisma.customerDocumentRule.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createDocumentRule(clientId: string, dto: CreateCustomerDocumentRuleDto): Promise<CustomerDocumentRule> {
    await this.get(clientId);

    try {
      return await this.prisma.customerDocumentRule.create({
        data: {
          clientId,
          documentType: dto.documentType.trim().toUpperCase(),
          isMandatory: dto.isMandatory ?? true,
          notes: dto.notes?.trim() || null,
        } as Prisma.CustomerDocumentRuleUncheckedCreateInput,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A document rule for this document type already exists for this client.");
      }
      throw error;
    }
  }

  async updateDocumentRule(clientId: string, ruleId: string, dto: UpdateCustomerDocumentRuleDto): Promise<CustomerDocumentRule> {
    const rule = await this.prisma.customerDocumentRule.findFirst({
      where: { id: ruleId, clientId },
    });
    if (!rule) throw new NotFoundException("Document rule not found.");

    const data: Prisma.CustomerDocumentRuleUncheckedUpdateInput = {};
    if (dto.documentType !== undefined) data.documentType = dto.documentType.trim().toUpperCase();
    if (dto.isMandatory !== undefined) data.isMandatory = dto.isMandatory;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    try {
      return await this.prisma.customerDocumentRule.update({
        where: { id: ruleId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("A document rule for this document type already exists for this client.");
      }
      throw error;
    }
  }

  async deleteDocumentRule(clientId: string, ruleId: string): Promise<{ success: true }> {
    const rule = await this.prisma.customerDocumentRule.findFirst({
      where: { id: ruleId, clientId },
    });
    if (!rule) throw new NotFoundException("Document rule not found.");

    await this.prisma.customerDocumentRule.delete({
      where: { id: ruleId },
    });
    return { success: true };
  }
}
