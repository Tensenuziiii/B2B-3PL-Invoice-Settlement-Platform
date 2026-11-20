import { IsStrongPasswordConstraint } from "./is-strong-password.validator";

describe("IsStrongPassword", () => {
  const validator = new IsStrongPasswordConstraint();

  const valid = [
    "Enterprise@2026",
    "MyPassw0rd!",
    "Aa1!567890",
  ];
  const invalid = [
    "",                    // empty
    "short1!",             // too short
    "alllowercase1!",      // no uppercase
    "ALLUPPERCASE1!",      // no lowercase
    "NoDigitsHere!",       // no digit
    "NoSymbols123",        // no symbol
    "Aa1!56789",           // 9 chars, too short
  ];

  it("accepts strong passwords", () => {
    for (const p of valid) {
      expect(validator.validate(p)).toBe(true);
    }
  });

  it("rejects weak passwords", () => {
    for (const p of invalid) {
      expect(validator.validate(p)).toBe(false);
    }
  });

  it("rejects non-string input", () => {
    expect(validator.validate(null)).toBe(false);
    expect(validator.validate(undefined)).toBe(false);
    expect(validator.validate(12345)).toBe(false);
  });

  it("lists all missing rules in the message", () => {
    const msg = validator.defaultMessage({
      value: "abc",
      constraints: [],
      targetName: "",
      object: {},
      property: "password",
    } as any);
    expect(msg).toContain("10 characters");
    expect(msg).toContain("uppercase");
    expect(msg).toContain("digit");
    expect(msg).toContain("symbol");
  });
});
