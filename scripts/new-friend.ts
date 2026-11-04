/**
 * Creates an access token for a friend and prints the PD_USERS entry and connector setup.
 * Run: npm run new-friend -- <userId> "<Name>"
 */
import { randomBytes } from "node:crypto";

const [userId, ...nameParts] = process.argv.slice(2);
if (!userId || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
  console.error('Usage: npm run new-friend -- <userId> "<Name>"   (userId: letters, numbers, - or _)');
  process.exit(1);
}
const name = nameParts.join(" ") || userId;
const token = randomBytes(24).toString("base64url");

console.log(`Add to PD_USERS (comma separated):\n  ${token}:${userId}:${name}\n`);
console.log(`Send to ${name}:\n  Connector URL: <PD_PUBLIC_URL>/mcp\n  Request header: Authorization: Bearer ${token}`);
