import { IsString } from "class-validator";
import { IsStrongPassword } from "../../common/validators/is-strong-password.validator";

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  @IsStrongPassword()
  password!: string;
}

