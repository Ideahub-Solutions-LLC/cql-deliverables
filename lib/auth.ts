import { env } from "cloudflare:workers";
import { headers } from "next/headers";

export const PASSWORD_ITERATIONS = 310_000;
const MAX_PBKDF2_ITERATIONS_PER_CALL = 100_000;
export const SESSION_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE = "dsi_session";

export type AccountRole =
  | "admin"
  | "reviewer"
  | "staff"
  | "delegated_reviewer"
  | "viewer";

export type AuthenticatedUser = {
  userId: string;
  username: string;
  displayName: string;
  role: AccountRole;
  personId: string | null;
  workspaceId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  avatarData: string | null;
  timezone: "PDT" | "PST" | "PHT";
  themeMode: "default" | "dark" | "light";
};

export function hasReviewAccess(role: AccountRole) {
  return role === "admin" || role === "reviewer" || role === "delegated_reviewer";
}

export function canEditAll(role: AccountRole) {
  return role === "admin";
}

export function canEditMetrics(role: AccountRole) {
  return role === "admin" || role === "reviewer";
}

export function canEditTask(user: AuthenticatedUser, ownerId: string) {
  return hasReviewAccess(user.role) || (user.role === "staff" && user.personId === ownerId);
}

export function canReview(role: AccountRole) {
  return hasReviewAccess(role);
}

export async function passwordDigest(password: string, saltHex: string, iterations = PASSWORD_ITERATIONS) {
  const salt = hexToBytes(saltHex);
  let input = new TextEncoder().encode(password);
  let remaining = iterations;
  let round = 0;

  // Workers cap each WebCrypto PBKDF2 call at 100,000 iterations. Chaining
  // round-specific salts preserves the configured total work factor.
  while (remaining > 0) {
    const count = Math.min(remaining, MAX_PBKDF2_ITERATIONS_PER_CALL);
    const roundSalt = new Uint8Array(salt.length + 2);
    roundSalt.set(salt);
    roundSalt[salt.length] = 0xff;
    roundSalt[salt.length + 1] = round;
    const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: roundSalt, iterations: count },
      key,
      256,
    );
    input = new Uint8Array(bits);
    remaining -= count;
    round += 1;
  }

  return bytesToHex(input);
}

export async function verifyPassword(password: string, salt: string, expected: string, iterations: number) {
  const actual = await passwordDigest(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToHex(bytes);
}

export async function sha256Hex(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

export async function getAuthenticatedUser(request?: Request): Promise<AuthenticatedUser | null> {
  if (!env.DB) return null;
  const cookieHeader = request?.headers.get("cookie") ?? (await headers()).get("cookie") ?? "";
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token || token.length > 160) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.username, u.display_name, u.role, u.person_id, s.workspace_id,
            u.email, u.first_name, u.last_name, u.avatar_data, u.timezone, u.theme_mode
     FROM delivery_sessions s
     JOIN delivery_users u ON u.username = s.username
     JOIN workspaces w ON w.id = s.workspace_id AND w.active = 1
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
  ).bind(tokenHash, new Date().toISOString()).first<{
    username: string;
    display_name: string;
    role: AccountRole;
    person_id: string | null;
    workspace_id: string;
    email: string | null;
    first_name: string;
    last_name: string;
    avatar_data: string | null;
    timezone: "PDT" | "PST" | "PHT";
    theme_mode: "default" | "dark" | "light";
  }>();
  if (!row) return null;
  return {
    userId: row.username,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    personId: row.person_id,
    workspaceId: row.workspace_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarData: row.avatar_data,
    timezone: row.timezone,
    themeMode: row.theme_mode,
  };
}

export function sessionCookie(token: string, requestUrl: string, maxAge = SESSION_SECONDS) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function readCookie(header: string, name: string) {
  const prefix = `${name}=`;
  for (const part of header.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) return value.slice(prefix.length);
  }
  return null;
}

function hexToBytes(hex: string) {
  if (!/^(?:[\da-f]{2})+$/i.test(hex)) throw new Error("Invalid stored credential format.");
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
