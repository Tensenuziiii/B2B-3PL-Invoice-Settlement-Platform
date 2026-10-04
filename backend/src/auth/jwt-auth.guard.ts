import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authHeader.substring(7);

    let payload: { sub?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: UserStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        displayId: true,
        hubName: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User is inactive or no longer exists.');
    }

    req.user = {
      sub: user.id,
      email: user.email,
      role: user.role,
      displayId: user.displayId,
      hubName: user.hubName,
    };
    return true;
  }
}
