import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @MinLength(2)
  displayId!: string;

  @IsString()
  @IsStrongPassword()
  password!: string;

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