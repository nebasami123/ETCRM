import { describe, expect, it } from "vitest";
import { flattenBusinessToRegistryLeads } from "./registryService.js";

describe("flattenBusinessToRegistryLeads", () => {
  it("creates one lead per unique sector phone", () => {
    const rows = flattenBusinessToRegistryLeads({
      _id: { toString: () => "abc123" },
      tin: "0000000002",
      businessName: "Test Co",
      managerFirstName: "Mana",
      managerLastName: "Asefa",
      businessSectors: [
        {
          region: "Addis Ababa",
          subcity: "Bole",
          managerPhone: "0914807228",
          businessNumber: "0911408313",
          sector: "6411",
          englishDescription: "Hotels"
        },
        {
          region: "Addis Ababa",
          subcity: "Bole",
          managerPhone: "0914807228",
          businessNumber: "0911408313",
          sector: "6222",
          englishDescription: "Retail"
        },
        {
          region: "Addis Ababa",
          subcity: "Kirkos",
          managerPhone: "0923456789",
          businessNumber: "",
          sector: "6411",
          englishDescription: "Hotels"
        }
      ]
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.phoneKey).sort()).toEqual(["0914807228", "0923456789"].sort());
    expect(rows[0]?.mongoBusinessId).toBe("abc123");
    expect(rows[0]?.region).toBe("Addis Ababa");
  });

  it("skips sectors without phones", () => {
    const rows = flattenBusinessToRegistryLeads({
      _id: { toString: () => "xyz" },
      businessName: "Empty Phones",
      businessSectors: [{ region: "Oromia", subcity: "Adama", managerPhone: "", businessNumber: "" }]
    });
    expect(rows).toHaveLength(0);
  });
});
