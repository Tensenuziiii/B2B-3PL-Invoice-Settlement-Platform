import 'reflect-metadata';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userFindMany: jest.Mock;
  let userCount: jest.Mock;
  let userFindFirst: jest.Mock;
  let userCreate: jest.Mock;
  let userUpdate: jest.Mock;
  let refreshTokenUpdateMany: jest.Mock;
  let loginAttemptFindMany: jest.Mock;
  let loginAttemptCount: jest.Mock;
  let transaction: jest.Mock;

  const safeUser = {
    id: 'user-123',
    email: 'driver@example.com',
    name: 'Driver Example',
    initials: 'DE',
    role: Role.DRIVER,
    status: UserStatus.ACTIVE,
    displayId: 'DRV-01',
    hubName: null,
    clientId: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    userFindMany = jest.fn().mockResolvedValue([safeUser]);
    userCount = jest.fn().mockResolvedValue(1);
    userFindFirst = jest.fn().mockResolvedValue(safeUser);
    userCreate = jest.fn().mockResolvedValue(safeUser);
    userUpdate = jest.fn().mockResolvedValue(safeUser);
    refreshTokenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    loginAttemptFindMany = jest.fn().mockResolvedValue([]);
    loginAttemptCount = jest.fn().mockResolvedValue(0);

    const transactionClient = {
      user: { update: userUpdate },
      refreshToken: { updateMany: refreshTokenUpdateMany },
    };
    transaction = jest.fn((operation: unknown) => {
      if (Array.isArray(operation)) return Promise.all(operation);
      return (operation as (client: typeof transactionClient) => unknown)(
        transactionClient,
      );
    });

    service = new UsersService({
      user: {
        findMany: userFindMany,
        count: userCount,
        findFirst: userFindFirst,
        create: userCreate,
        update: userUpdate,
      },
      refreshToken: { updateMany: refreshTokenUpdateMany },
      loginAttempt: {
        findMany: loginAttemptFindMany,
        count: loginAttemptCount,
      },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it('creates a normalized user with an Argon2 hash and no credential fields in the result', async () => {
    const dto: CreateUserDto = {
      email: ' DRIVER@EXAMPLE.COM ',
      name: 'Driver Example',
      role: Role.DRIVER,
      displayId: 'DRV-01',
      password: 'StrongPassword@2026',
    };

    const result = await service.create(dto);
    const createArgs = userCreate.mock.calls[0][0];

    expect(createArgs.data.email).toBe('driver@example.com');
    expect(createArgs.data.passwordHash).not.toBe(dto.password);
    await expect(
      argon2.verify(createArgs.data.passwordHash, dto.password),
    ).resolves.toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('failedLoginAttempts');
  });

  it('filters and paginates users without selecting credential fields', async () => {
    const query = Object.assign(new ListUsersQueryDto(), {
      search: 'driver',
      role: Role.DRIVER,
      status: UserStatus.ACTIVE,
      limit: 10,
      offset: 20,
    });

    const result = await service.list(query);

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          role: Role.DRIVER,
          status: UserStatus.ACTIVE,
          OR: expect.any(Array),
        }),
        take: 10,
        skip: 20,
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
    expect(result.meta).toEqual({ total: 1, limit: 10, offset: 20 });
  });

  it('deactivates a user and revokes active refresh tokens atomically', async () => {
    const result = await service.deactivate('user-123');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({ status: UserStatus.INACTIVE }),
      }),
    );
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-123', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result).toBe(safeUser);
  });

  it('lists attempts for unknown emails in the admin audit feed', async () => {
    const query = Object.assign(new ListUsersQueryDto(), {
      search: 'missing@example.com',
      limit: 5,
      offset: 0,
    });
    loginAttemptFindMany.mockResolvedValue([
      { id: 'attempt-1', email: 'missing@example.com', succeeded: false },
    ]);
    loginAttemptCount.mockResolvedValue(1);

    const result = await service.listLoginAttempts(query);

    expect(loginAttemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ email: { contains: 'missing@example.com', mode: 'insensitive' } }, { ipAddress: { contains: 'missing@example.com', mode: 'insensitive' } }] },
        take: 5,
        skip: 0,
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});