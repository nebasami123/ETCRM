import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureBusinessesIndexes } from "./config/mongo.js";

const port = env.PORT;

app.listen(port, () => {
  console.log(`ETCRM API running on ${env.BETTER_AUTH_URL}`);
  // Fire-and-forget: campaign pool sorts need capital/value indexes.
  void ensureBusinessesIndexes();
});
