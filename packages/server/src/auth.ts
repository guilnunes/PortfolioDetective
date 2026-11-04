import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * MVP auth: each friend gets a personal access token, added in Claude as a custom
 * connector request header (Authorization: Bearer <token>). OAuth comes with Firebase Auth.
 *
 * PD_USERS="token1:userId1:Name One,token2:userId2:Name Two"
 */
export interface Account {
  userId: string;
  name: string;
}

export function parseUsers(env: string | undefined): Map<string, Account> {
  const map = new Map<string, Account>();
  for (const entry of (env ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [token, userId, ...name] = entry.split(":");
    if (!token || !userId || token.length < 24) {
      throw new Error("PD_USERS entries must be token:userId:Name, with tokens of at least 24 characters");
    }
    map.set(token, { userId, name: name.join(":") || userId });
  }
  return map;
}

export function accountFromHeader(header: string | undefined, users: Map<string, Account>): Account | undefined {
  const m = header?.match(/^Bearer\s+(.+)$/i);
  if (!m) return undefined;
  const given = Buffer.from(m[1]!.trim());
  for (const [token, account] of users) {
    const t = Buffer.from(token);
    if (t.length === given.length && timingSafeEqual(t, given)) return account;
  }
  return undefined;
}

/** Short lived signed links, for evidence upload pages and case file downloads. */
export class Signer {
  constructor(private secret: string) {
    if (secret.length < 32) throw new Error("PD_SECRET must be at least 32 characters");
  }

  sign(payload: Record<string, string>, ttlSeconds: number): string {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
    const mac = createHmac("sha256", this.secret).update(body).digest("base64url");
    return `${body}.${mac}`;
  }

  verify(token: string): Record<string, string> | undefined {
    const [body, mac] = token.split(".");
    if (!body || !mac) return undefined;
    const expected = createHmac("sha256", this.secret).update(body).digest("base64url");
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, string> & { exp: number };
    if (data.exp < Date.now() / 1000) return undefined;
    return data;
  }
}
