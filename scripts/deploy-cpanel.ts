/**
 * Sets up and deploys Portfolio Detective on a cPanel shared host (HostGator) through the cPanel API,
 * with a cPanel API token. No FTP, no SSH, no clicking.
 *
 *   npm run deploy -- --setup     first time: database, subdomain, SSL, config.php, then files
 *   npm run deploy                later: upload changed code only (config.php and storage are kept)
 *   npm run deploy -- --dry-run   list what would be uploaded
 *
 * Env: CPANEL_HOST (e.g. br123.hostgator.com.br), CPANEL_USER, CPANEL_TOKEN,
 *      PD_DOMAIN (root domain), PD_SUBDOMAIN (default "detetive"),
 *      for --setup also PD_USERS ("token:id:Name,..."), optional PD_SECRET.
 */
import { randomBytes } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const setup = args.has("--setup");

const env = (k: string, fallback?: string) => {
  const v = process.env[k] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Missing ${k}`);
  return v;
};

const APP_DIR = "portfoliodetective"; // in the cPanel home, outside public_html
const SKIP = [/^test\//, /^storage\//, /^config\.php$/, /\.test\.ts$/];

async function walk(dir: string, rel = ""): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(path.join(dir, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    if ((await stat(path.join(dir, r))).isDirectory()) out.push(...(await walk(dir, r)));
    else if (!SKIP.some((re) => re.test(r))) out.push(r);
  }
  return out;
}

class CPanel {
  constructor(private host: string, private user: string, private token: string) {}

  private get headers() {
    return { Authorization: `cpanel ${this.user}:${this.token}` };
  }

  async uapi(module: string, fn: string, params: Record<string, string> = {}) {
    const url = `https://${this.host}:2083/execute/${module}/${fn}?${new URLSearchParams(params)}`;
    const r = await fetch(url, { headers: this.headers });
    const j = (await r.json()) as { status: number; errors?: string[] | null; data?: unknown };
    if (!j.status) throw new Error(`${module}::${fn}: ${(j.errors ?? []).join("; ") || r.status}`);
    return j.data;
  }

  /** API 2 call, used only for creating folders. */
  async api2(module: string, fn: string, params: Record<string, string>) {
    const q = new URLSearchParams({ cpanel_jsonapi_user: this.user, cpanel_jsonapi_apiversion: "2", cpanel_jsonapi_module: module, cpanel_jsonapi_func: fn, ...params });
    const r = await fetch(`https://${this.host}:2083/json-api/cpanel?${q}`, { headers: this.headers });
    return r.json();
  }

  async mkdirs(home: string, dir: string) {
    let current = home;
    for (const part of dir.split("/").filter(Boolean)) {
      await this.api2("Fileman", "mkdir", { path: current, name: part }); // ignores "exists"
      current = `${current}/${part}`;
    }
  }

  async upload(dir: string, files: { name: string; data: Buffer }[]) {
    const form = new FormData();
    form.set("dir", dir);
    form.set("overwrite", "1");
    files.forEach((f, i) => form.set(`file-${i + 1}`, new Blob([new Uint8Array(f.data)]), f.name));
    const r = await fetch(`https://${this.host}:2083/execute/Fileman/upload_files`, { method: "POST", headers: this.headers, body: form });
    const j = (await r.json()) as { status: number; errors?: string[] | null };
    if (!j.status) throw new Error(`upload to ${dir}: ${(j.errors ?? []).join("; ")}`);
  }

  async saveFile(dir: string, file: string, content: string) {
    const form = new URLSearchParams({ dir, file, content });
    const r = await fetch(`https://${this.host}:2083/execute/Fileman/save_file_content`, { method: "POST", headers: this.headers, body: form });
    const j = (await r.json()) as { status: number; errors?: string[] | null };
    if (!j.status) throw new Error(`save ${dir}/${file}: ${(j.errors ?? []).join("; ")}`);
  }
}

const phpDir = path.join(root, "php");
const files = await walk(phpDir);
if (dryRun) {
  console.log(`${files.length} files would be uploaded to ~/${APP_DIR}:`);
  for (const f of files) console.log(`  ${f}`);
  process.exit(0);
}

const user = env("CPANEL_USER");
const cp = new CPanel(env("CPANEL_HOST"), user, env("CPANEL_TOKEN"));
const home = `/home/${user}`;
const domain = env("PD_DOMAIN");
const sub = env("PD_SUBDOMAIN", "detetive");
const host = `${sub}.${domain}`;

if (setup) {
  console.log("Setting up database...");
  const db = `${user}_pd`.slice(0, 64);
  const dbUser = `${user}_pd`.slice(0, 32);
  const dbPass = randomBytes(18).toString("base64url");
  await cp.uapi("Mysql", "create_database", { name: db }).catch((e) => console.log(`  ${e.message} (continuing)`));
  await cp.uapi("Mysql", "create_user", { name: dbUser, password: dbPass }).catch(async () => {
    await cp.uapi("Mysql", "set_password", { user: dbUser, password: dbPass });
  });
  await cp.uapi("Mysql", "set_privileges_on_database", { user: dbUser, database: db, privileges: "ALL PRIVILEGES" });

  console.log(`Creating subdomain ${host}...`);
  await cp.mkdirs(home, `${APP_DIR}/public`);
  await cp
    .uapi("SubDomain", "addsubdomain", { domain: sub, rootdomain: domain, dir: `${APP_DIR}/public` })
    .catch((e) => console.log(`  ${e.message} (continuing)`));

  console.log("Writing config.php...");
  const users = env("PD_USERS")
    .split(",")
    .map((e) => e.trim().split(":"))
    .map(([token, id, ...name]) => `    ${JSON.stringify(token)} => ['id' => ${JSON.stringify(id)}, 'name' => ${JSON.stringify(name.join(":") || id)}],`)
    .join("\n");
  const secret = process.env.PD_SECRET ?? randomBytes(32).toString("base64url");
  const config = `<?php
return [
    'public_url' => 'https://${host}',
    'secret' => ${JSON.stringify(secret)},
    'db' => ['dsn' => 'mysql:host=localhost;dbname=${db};charset=utf8mb4', 'user' => ${JSON.stringify(dbUser)}, 'password' => ${JSON.stringify(dbPass)}],
    'storage_dir' => __DIR__ . '/storage',
    'web_fonts' => true,
    'users' => [
${users}
    ],
];
`;
  await cp.saveFile(`${home}/${APP_DIR}`, "config.php", config);

  console.log("Requesting the SSL certificate (AutoSSL)...");
  await cp.uapi("SSL", "start_autossl_check").catch((e) => console.log(`  ${e.message} (HostGator may run it on its own schedule)`));
}

console.log(`Uploading ${files.length} files...`);
const byDir = new Map<string, string[]>();
for (const f of files) {
  const d = path.posix.dirname(f);
  byDir.set(d, [...(byDir.get(d) ?? []), f]);
}
for (const [d, list] of byDir) {
  const remote = d === "." ? `${home}/${APP_DIR}` : `${home}/${APP_DIR}/${d}`;
  await cp.mkdirs(home, d === "." ? APP_DIR : `${APP_DIR}/${d}`);
  for (let i = 0; i < list.length; i += 10) {
    const batch = await Promise.all(list.slice(i, i + 10).map(async (f) => ({ name: path.posix.basename(f), data: await readFile(path.join(phpDir, f)) })));
    await cp.upload(remote, batch);
  }
  console.log(`  ${d}: ${list.length}`);
}

const health = await fetch(`https://${host}/health`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
console.log(`Health check https://${host}/health:`, health);
console.log(`Connector URL: https://${host}/mcp`);
