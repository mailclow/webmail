import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import { deleteSession, getSession, SESSION_COOKIE } from "./session";
import { getInboundMessagesForSession } from "./messages";
import { registerAuthCodeRoutes } from "./auth-code-routes";
import { createServer } from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rateLimit } from "./rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function currentSession(req: express.Request) {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return getSession(bearer || req.cookies?.[SESSION_COOKIE]);
}

const app = express();
const server = createServer(app);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "https://mailclow.github.io";
app.use((req, res, next) => {
  if (req.headers.origin === frontendOrigin) {
    res.setHeader("Access-Control-Allow-Origin", frontendOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(rateLimit({ name: "global", windowMs: 60 * 1000, max: 120 }));
registerAuthCodeRoutes(app);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  const session = currentSession(req);
  res.json({ authenticated: Boolean(session), email: session?.email ?? null });
});

app.post("/api/auth/logout", (req, res) => {
  deleteSession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get("/api/messages", rateLimit({ name: "messages", windowMs: 60 * 1000, max: 30 }), async (req, res) => {
  const session = currentSession(req);
  if (!session) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }
  try {
    res.json({ messages: await getInboundMessagesForSession(session) });
  } catch (error) {
    console.error("Falha ao consultar DuckMail:", error instanceof Error ? error.message : "erro desconhecido");
    res.status(502).json({ error: "Não foi possível consultar a caixa DuckMail. Tente atualizar novamente." });
  }
});

app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () => {
  console.log(`Strong Mail API local: http://localhost:${Number(process.env.PORT || 3001)}`);
});
