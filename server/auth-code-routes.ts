import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { createDuckMailAccount, getDuckMailToken, getPublicDomains } from "./duckmail";
import { createSession, SESSION_COOKIE } from "./session";

function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function cookie(res: Response, email: string, password: string, token: string, accountId?: string): void {
  const sessionId = createSession({ email, password, duckToken: token, accountId });
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24,
  });
}

function randomLocalPart(): string {
  return `sm${randomBytes(6).toString("hex")}`;
}

function randomMailboxPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(20);
  let output = "";
  for (const byte of bytes) output += alphabet[byte % alphabet.length];
  return output;
}

export function registerAuthCodeRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (!validEmail(email) || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." });
      return;
    }
    try {
      const normalizedEmail = normalizeEmail(email);
      const result = await getDuckMailToken(normalizedEmail, password);
      cookie(res, normalizedEmail, password, result.token!, result.id);
      res.json({ ok: true, email: normalizedEmail });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar.";
      const status = /DuckMail 401/i.test(message) ? 401 : /DuckMail 404/i.test(message) ? 404 : 400;
      res.status(status).json({ error: status === 401 ? "E-mail ou senha incorretos." : "Conta DuckMail não encontrada. Crie uma nova caixa ou confirme os dados." });
    }
  });

  app.post("/api/auth/create-mailbox", async (req: Request, res: Response) => {
    const { prefix } = req.body as { prefix?: unknown };
    const safePrefix = typeof prefix === "string" && /^[a-z0-9._-]{3,24}$/i.test(prefix)
      ? prefix.toLowerCase()
      : randomLocalPart();
    const safePassword = randomMailboxPassword();

    try {
      const domains = await getPublicDomains();
      if (!domains.length) throw new Error("Nenhum domínio público disponível no DuckMail.");

      let lastError: unknown;
      for (const domain of domains) {
        const address = `${safePrefix}@${domain}`;
        try {
          const account = await createDuckMailAccount(address, safePassword);
          const auth = await getDuckMailToken(address, safePassword);
          cookie(res, address, safePassword, auth.token!, account.id);
          res.status(201).json({ ok: true, email: address, password: safePassword });
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Não foi possível criar a caixa.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar caixa.";
      res.status(502).json({ error: message });
    }
  });
}
