import path from "node:path";
import { createApp } from "./app.ts";
import { parseUsers, Signer } from "./auth.ts";
import { FileStore } from "./store.ts";

const port = Number(process.env.PORT ?? 8787);
const publicUrl = (process.env.PD_PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, "");
const secret = process.env.PD_SECRET;
if (!secret) throw new Error("Set PD_SECRET (32+ random characters). See .env.example.");

const users = parseUsers(process.env.PD_USERS);
if (users.size === 0) console.warn("PD_USERS is empty: nobody can connect yet.");

const app = createApp({
  store: new FileStore(path.resolve(process.env.PD_DATA_DIR ?? ".data")),
  users,
  signer: new Signer(secret),
  publicUrl,
});

app.listen(port, () => {
  console.log(`Portfolio Detective listening on ${publicUrl} (MCP endpoint: ${publicUrl}/mcp)`);
});
