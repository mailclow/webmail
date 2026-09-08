import crypto from "node:crypto";

export const SESSION_COOKIE = "sm_session";

export type LocalSession = {
  email: string;
  password: string;
  duckToken: string;
  accountId?: string;
};

const sessions = new Map<string, LocalSession>();

export function createSession(data: LocalSession): string {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, data);
  return sessionId;
}

export function getSession(sessionId: string | undefined): LocalSession | undefined {
  return sessionId ? sessions.get(sessionId) : undefined;
}

export function deleteSession(sessionId: string | undefined): void {
  if (sessionId) sessions.delete(sessionId);
}
