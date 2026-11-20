import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/is-strong-password.validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}