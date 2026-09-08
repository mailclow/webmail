import crypto from "node:crypto";

export const SESSION_COOKIE = "sm_session";

export type LocalSession = {
  email: string;
  password: string;
  duckToken: string;
  accountId?: string;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

function sessionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "strong-mail-development-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function createSession(data: LocalSession): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + SESSION_TTL_MS }), "utf8");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((value) => value.toString("base64url")).join(".");
}

export function getSession(value: string | undefined): LocalSession | undefined {
  if (!value) return undefined;
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return undefined;
    const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const payload = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]);
    const parsed = JSON.parse(payload.toString("utf8")) as LocalSession & { exp?: number };
    if (!parsed.exp || parsed.exp < Date.now() || !parsed.email || !parsed.duckToken) return undefined;
    const { exp: _exp, ...session } = parsed;
    return session;
  } catch {
    return undefined;
  }
}

export function deleteSession(_value: string | undefined): void { /* Cookie revocation is handled by clearCookie. */ }
