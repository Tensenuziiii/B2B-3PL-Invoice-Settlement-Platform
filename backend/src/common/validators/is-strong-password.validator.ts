import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

const POLICY = {
  minLength: 10,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasDigit: /[0-9]/,
  hasSymbol: /[^A-Za-z0-9]/,
};

@ValidatorConstraint({ name: "isStrongPassword", async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "string") return false;
    if (value.length < POLICY.minLength) return false;
    if (!POLICY.hasUppercase.test(value)) return false;
    if (!POLICY.hasLowercase.test(value)) return false;
    if (!POLICY.hasDigit.test(value)) return false;
    if (!POLICY.hasSymbol.test(value)) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const v = args.value;
    const problems: string[] = [];
    if (typeof v !== "string" || v.length < POLICY.minLength) {
      problems.push(`at least ${POLICY.minLength} characters`);
    }
    if (typeof v !== "string" || !POLICY.hasUppercase.test(v)) {
      problems.push("one uppercase letter");
    }
    if (typeof v !== "string" || !POLICY.hasLowercase.test(v)) {
      problems.push("one lowercase letter");
    }
    if (typeof v !== "string" || !POLICY.hasDigit.test(v)) {
      problems.push("one digit");
    }
    if (typeof v !== "string" || !POLICY.hasSymbol.test(v)) {
      problems.push("one symbol");
    }
    return `Password must contain: ${problems.join(", ")}.`;
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isStrongPassword",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsStrongPasswordConstraint,
    });
  };
}
