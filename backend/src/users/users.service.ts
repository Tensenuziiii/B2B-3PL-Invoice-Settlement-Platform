import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  initials: true,
  role: true,
  status: true,
  displayId: true,
  hubName: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { displayId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data,
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: publicUserSelect,
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await argon2.hash(dto.password);
    const data: Prisma.UserUncheckedCreateInput = {
      email: dto.email.trim().toLowerCase(),
      name: dto.name.trim(),
      initials: dto.initials?.trim().toUpperCase() ?? this.makeInitials(dto.name),
      role: dto.role,
      displayId: dto.displayId.trim(),
      passwordHash,
      hubName: dto.hubName?.trim() || null,
      clientId: dto.clientId || null,
    };

    try {
      return await this.prisma.user.create({ data, select: publicUserSelect });
    } catch (error) {
      this.throwIfEmailConflict(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.get(id);
    const data: Prisma.UserUncheckedUpdateInput = {};
    let shouldRevokeSessions = false;
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.initials !== undefined) data.initials = dto.initials.trim().toUpperCase();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.displayId !== undefined) data.displayId = dto.displayId.trim();
    if (dto.hubName !== undefined) data.hubName = dto.hubName?.trim() || null;
    if (dto.clientId !== undefined) data.clientId = dto.clientId || null;
    if (dto.password !== undefined) {
      data.passwordHash = await argon2.hash(dto.password);
      data.failedLoginAttempts = 0;
      data.lockedUntil = null;
      shouldRevokeSessions = true;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.deletedAt = dto.status === UserStatus.INACTIVE ? new Date() : null;
      if (dto.status === UserStatus.ACTIVE) {
        data.failedLoginAttempts = 0;
        data.lockedUntil = null;
      }
      if (dto.status !== UserStatus.ACTIVE) shouldRevokeSessions = true;
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.update({
          where: { id },
          data,
          select: publicUserSelect,
        });
        if (shouldRevokeSessions) {
          await transaction.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return user;
      });
    } catch (error) {
      this.throwIfEmailConflict(error);
      throw error;
    }
  }

  async deactivate(id: string) {
    await this.get(id);
    const now = new Date();
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE, deletedAt: now },
        select: publicUserSelect,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    return user;
  }

  async loginHistory(id: string, limit = 50, offset = 0) {
    await this.get(id);
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
    const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
    const [data, total] = await Promise.all([
      this.prisma.loginAttempt.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip: safeOffset,
        select: {
          id: true,
          email: true,
          succeeded: true,
          failureReason: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      this.prisma.loginAttempt.count({ where: { userId: id } }),
    ]);
    return { data, meta: { total, limit: safeLimit, offset: safeOffset } };
  }

  async listLoginAttempts(query: ListUsersQueryDto) {
    const where: Prisma.LoginAttemptWhereInput = {};
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.loginAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: {
          id: true,
          email: true,
          succeeded: true,
          failureReason: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, role: true, displayId: true },
          },
        },
      }),
      this.prisma.loginAttempt.count({ where }),
    ]);
    return {
      data,
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }

  private makeInitials(name: string) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  private throwIfEmailConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A user with this email already exists.');
    }
  }
}