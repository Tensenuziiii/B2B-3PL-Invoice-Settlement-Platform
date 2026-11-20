import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role, UserStatus } from '@prisma/client';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MinLength(2)
  displayId?: string;

  @IsOptional()
  @IsString()
  @IsStrongPassword()
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  initials?: string;

  @IsOptional()
  @IsString()
  hubName?: string | null;

  @IsOptional()
  @IsString()
  clientId?: string | null;
}