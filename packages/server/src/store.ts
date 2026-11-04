import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Case, UserProfile, type Lang } from "@pd/core";

/**
 * Storage behind one interface so the file store (local dev) and Firestore plus
 * Cloud Storage (production) are interchangeable.
 */
export interface Store {
  getUser(id: string): Promise<UserProfile | undefined>;
  saveUser(u: UserProfile): Promise<void>;
  listCases(ownerId: string): Promise<Case[]>;
  getCase(ownerId: string, caseId: string): Promise<Case | undefined>;
  saveCase(c: Case): Promise<void>;
  putBlob(prefix: string, data: Buffer, ext: string): Promise<string>;
  readBlob(key: string): Promise<Buffer>;
}

const safe = (s: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) throw new Error(`Invalid id: ${s}`);
  return s;
};

export class FileStore implements Store {
  constructor(private dir: string) {}

  private p(...parts: string[]) {
    const full = path.resolve(this.dir, ...parts);
    if (!full.startsWith(path.resolve(this.dir))) throw new Error("Path escapes the data dir");
    return full;
  }

  private async readJson<T>(file: string): Promise<T | undefined> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw e;
    }
  }

  private async writeJson(file: string, data: unknown) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2));
  }

  async getUser(id: string) {
    const raw = await this.readJson<unknown>(this.p("users", `${safe(id)}.json`));
    return raw ? UserProfile.parse(raw) : undefined;
  }

  async saveUser(u: UserProfile) {
    await this.writeJson(this.p("users", `${safe(u.id)}.json`), UserProfile.parse(u));
  }

  async listCases(ownerId: string) {
    let files: string[] = [];
    try {
      files = await readdir(this.p("cases", safe(ownerId)));
    } catch {
      return [];
    }
    const cases = await Promise.all(
      files.filter((f) => f.endsWith(".json")).map((f) => this.readJson<unknown>(this.p("cases", ownerId, f))),
    );
    return cases.filter(Boolean).map((c) => Case.parse(c));
  }

  async getCase(ownerId: string, caseId: string) {
    const raw = await this.readJson<unknown>(this.p("cases", safe(ownerId), `${safe(caseId)}.json`));
    return raw ? Case.parse(raw) : undefined;
  }

  async saveCase(c: Case) {
    await this.writeJson(this.p("cases", safe(c.ownerId), `${safe(c.id)}.json`), Case.parse(c));
  }

  async putBlob(prefix: string, data: Buffer, ext: string) {
    const key = `blobs/${prefix.split("/").map(safe).join("/")}/${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "")}`;
    const file = this.p(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return key;
  }

  async readBlob(key: string) {
    return readFile(this.p(key));
  }
}

export function defaultProfile(id: string, name: string, lang: Lang = "pt-BR"): UserProfile {
  return {
    id,
    name,
    interfaceLanguage: lang,
    defaultCaseLanguage: "en",
    detectiveMode: "full",
    links: {},
  };
}
