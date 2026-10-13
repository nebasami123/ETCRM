import { describe, expect, it } from "vitest";
import { phoneKey } from "./leadService.js";

describe("lead duplicate keys", () => {
  it("normalizes phone numbers to digits only", () => {
    expect(phoneKey("+251 (91) 123-4567")).toBe("251911234567");
  });

  it("normalizes licenses and preserves nullable empty values", () => {
  });
});
