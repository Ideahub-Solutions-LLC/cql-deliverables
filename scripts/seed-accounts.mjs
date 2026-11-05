import { pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remote = process.argv.includes("--remote");
const input = process.argv.slice(2).find((value) => !value.startsWith("--"));
const inputPath = path.resolve(root, input || "notes/accounts.local.json");
const outputPath = path.join(root, ".wrangler", "state", "dsi-users-seed.sql");
const localDevConfig = path.join(root, ".wrangler", "local-dev-db.json");
const configPath = process.env.SITES_D1_CONFIG ||
  (!remote && existsSync(localDevConfig) ? ".wrangler/local-dev-db.json" : "dist/server/wrangler.json");
const roles = new Set(["admin", "reviewer", "staff", "delegated_reviewer", "viewer"]);
const iterations = 310_000;

if (!existsSync(inputPath)) {
  throw new Error(`Account file not found: ${path.relative(root, inputPath)}. Create a private JSON file with username, password, role, displayName, and optional personId fields.`);
}

const accounts = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(accounts) || accounts.length === 0) throw new Error("The account file must contain a non-empty JSON array.");
const usernames = new Set();
function passwordHash(password, saltHex) {
  let input = Buffer.from(password, "utf8");
  let remaining = iterations;
  let round = 0;
  while (remaining > 0) {
    const count = Math.min(remaining, 100_000);
    const salt = Buffer.concat([Buffer.from(saltHex, "hex"), Buffer.from([0xff, round])]);
    input = pbkdf2Sync(input, salt, count, 32, "sha256");
    remaining -= count;
    round += 1;
  }
  return input.toString("hex");
}

const sql = accounts.map((account) => {
  const username = String(account.username || "").trim().toLowerCase();
  const role = String(account.role || "");
  const password = String(account.password || "");
  const displayName = String(account.displayName || username);
  const personId = account.personId == null ? null : String(account.personId);
  if (!/^[a-z0-9_.-]{2,40}$/.test(username)) throw new Error(`Invalid username in account file: ${username}`);
  if (usernames.has(username)) throw new Error(`Duplicate username in account file: ${username}`);
  usernames.add(username);
  if (!roles.has(role)) throw new Error(`Unsupported role for ${username}.`);
  if (password.length < 12 || password.length > 256) throw new Error(`Password for ${username} must contain 12–256 characters.`);
  const salt = randomBytes(16).toString("hex");
  const digest = passwordHash(password, salt);
  const quote = (value) => value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
  return `INSERT INTO delivery_users (username, display_name, role, person_id, password_salt, password_hash, password_iterations, active)
VALUES (${quote(username)}, ${quote(displayName)}, ${quote(role)}, ${quote(personId)}, ${quote(salt)}, ${quote(digest)}, ${iterations}, 1)
ON CONFLICT(username) DO UPDATE SET display_name=excluded.display_name, role=excluded.role, person_id=excluded.person_id, password_salt=excluded.password_salt, password_hash=excluded.password_hash, password_iterations=excluded.password_iterations, active=1;`;
}).join("\n");

writeFileSync(outputPath, sql, { mode: 0o600 });
try {
  const result = spawnSync(process.execPath, [
    "--import", "./scripts/sites-env.mjs",
    path.join(root, "node_modules", "wrangler", "bin", "wrangler.js"),
    "d1", "execute", "DB", remote ? "--remote" : "--local", "--config", configPath,
    ...(remote ? [] : ["--persist-to", ".wrangler/state"]), "--file", path.relative(root, outputPath),
  ], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else process.stdout.write(`Provisioned ${accounts.length} project accounts in the ${remote ? "remote Cloudflare" : "local"} D1 database. Passwords were hashed before storage.\n`);
} finally {
  rmSync(outputPath, { force: true });
}
