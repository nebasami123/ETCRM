import { app } from "./app.js";
import { env } from "./config/env.js";

const port = env.PORT;

app.listen(port, () => {
  console.log(`ETCRM API running on http://127.0.0.1:${port}`);
});
