import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import { env } from "./env.js";

let client: MongoClient | null = null;
let connectPromise: Promise<MongoClient> | null = null;
let indexesPromise: Promise<void> | null = null;

export function getMongoClient() {
  if (!client) {
    client = new MongoClient(env.MONGODB_URL);
  }
  return client;
}

export async function connectMongo() {
  if (!connectPromise) {
    connectPromise = getMongoClient().connect();
  }
  return connectPromise;
}

export async function getMongoDb(): Promise<Db> {
  const connected = await connectMongo();
  return connected.db(env.MONGODB_DB_NAME);
}

export async function getBusinessesCollection<T extends Document = Document>(): Promise<Collection<T>> {
  const db = await getMongoDb();
  return db.collection<T>(env.MONGODB_BUSINESSES_COLLECTION);
}

/**
 * Ensure indexes used by campaign pool selection (sort by capital/value).
 * Idempotent; safe to call on every boot. Does not block the HTTP server.
 */
export async function ensureBusinessesIndexes() {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const collection = await getBusinessesCollection();
      await Promise.all([
        collection.createIndex({ capital: -1 }, { name: "capital_desc", background: true }),
        collection.createIndex({ value: -1 }, { name: "value_desc", background: true })
      ]);
      console.log("[mongo] businesses indexes ready: capital_desc, value_desc");
    })().catch((error) => {
      indexesPromise = null;
      console.warn("[mongo] failed to ensure businesses indexes:", error);
    });
  }
  return indexesPromise;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    connectPromise = null;
    indexesPromise = null;
  }
}
