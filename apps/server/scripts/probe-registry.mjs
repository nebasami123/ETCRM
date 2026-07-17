import { MongoClient } from "mongodb";

const client = new MongoClient(
  "mongodb://mongo:0bygp8ufykdnWGm2BycS@23.26.4.236:27022/?authSource=admin&directConnection=true"
);
await client.connect();
const col = client.db("etbus").collection("businesses");
const rows = await col.find({}).sort({ capital: -1 }).limit(25).toArray();
let withPhone = 0;
let totalPhones = 0;
for (const b of rows) {
  const phones = new Set();
  for (const s of b.businessSectors || []) {
    const p = String(s.managerPhone || s.businessNumber || "").replace(/\D/g, "");
    if (p) phones.add(p);
  }
  if (phones.size) withPhone++;
  totalPhones += phones.size;
}
console.log({
  businesses: rows.length,
  withPhone,
  totalPhones,
  firstName: rows[0]?.businessName,
  firstSectors: (rows[0]?.businessSectors || []).slice(0, 2)
});

const phoneFilter = {
  $or: [
    { "businessSectors.managerPhone": { $nin: [null, ""] } },
    { "businessSectors.businessNumber": { $nin: [null, ""] } }
  ]
};
const t0 = Date.now();
const sampleWithPhone = await col
  .find(phoneFilter)
  .sort({ capital: -1 })
  .limit(5)
  .project({ businessName: 1, "businessSectors.managerPhone": 1, "businessSectors.businessNumber": 1 })
  .toArray();
console.log("sampleWithPhone ms", Date.now() - t0, sampleWithPhone.length);
console.log(JSON.stringify(sampleWithPhone[0], null, 2));
await client.close();
