import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with search and pagination' })
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user with a hashed password' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('login-attempts')
  @ApiOperation({ summary: 'List persisted login attempts, including unknown emails' })
  listLoginAttempts(@Query() query: ListUsersQueryDto) {
    return this.usersService.listLoginAttempts(query);
  }

  @Get(':id/login-history')
  @ApiOperation({ summary: 'List persisted login attempts for a user' })
  loginHistory(@Param('id') id: string, @Query() query: ListUsersQueryDto) {
    return this.usersService.loginHistory(id, query.limit, query.offset);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user profile without credential fields' })
  get(@Param('id') id: string) {
    return this.usersService.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile, role, status, or password' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user and revoke active sessions' })
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}