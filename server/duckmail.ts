const DUCKMAIL_API = "https://api.duckmail.sbs";

export type DuckMailAddress = { name?: string; address?: string } | string;

export type DuckMailMessage = {
  id: string;
  msgid?: string;
  accountId?: string;
  from?: DuckMailAddress;
  to?: DuckMailAddress[];
  subject?: string;
  text?: string | null;
  html?: string | string[] | null;
  seen?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type HydraCollection<T> = {
  "hydra:member"?: T[];
  member?: T[];
  data?: T[];
  "hydra:totalItems"?: number;
};

type DuckTokenResponse = { id?: string; token?: string };
type DuckAccountResponse = { id: string; address: string; authType?: string };

function jsonHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${DUCKMAIL_API}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("DuckMail demorou para responder.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let payload: unknown = undefined;
  try { payload = text ? JSON.parse(text) : undefined; } catch { payload = text; }
  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null
      ? ((payload as { message?: string; error?: string }).message || (payload as { error?: string }).error)
      : undefined;
    throw new Error(`DuckMail ${response.status}: ${detail || text.slice(0, 240)}`);
  }
  return payload as T;
}

export async function getPublicDomains(): Promise<string[]> {
  const payload = await apiFetch<HydraCollection<{ domain?: string }>>("/domains?page=1", {
    headers: { Accept: "application/json" },
  });
  const items = payload["hydra:member"] || payload.member || payload.data || [];
  return items.map((item) => item.domain?.trim()).filter((domain): domain is string => Boolean(domain));
}

export async function createDuckMailAccount(address: string, password: string): Promise<DuckAccountResponse> {
  return apiFetch<DuckAccountResponse>("/accounts", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ address, password }),
  });
}

export async function getDuckMailToken(address: string, password: string): Promise<DuckTokenResponse> {
  const payload = await apiFetch<DuckTokenResponse>("/token", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ address, password }),
  });
  if (!payload.token) throw new Error("DuckMail não retornou um token para esta conta.");
  return payload;
}

export async function listDuckMessages(token: string): Promise<DuckMailMessage[]> {
  const payload = await apiFetch<HydraCollection<DuckMailMessage>>("/messages?page=1", {
    headers: jsonHeaders(token),
  });
  return payload["hydra:member"] || payload.member || payload.data || [];
}

export async function getDuckMessage(token: string, id: string): Promise<DuckMailMessage> {
  return apiFetch<DuckMailMessage>(`/messages/${encodeURIComponent(id)}`, {
    headers: jsonHeaders(token),
  });
}

export async function markDuckMessageSeen(token: string, id: string): Promise<void> {
  await apiFetch(`/messages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ seen: true }),
  });
}

export async function deleteDuckMessage(token: string, id: string): Promise<void> {
  await apiFetch(`/messages/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
}

export function duckAddressEmail(value: DuckMailAddress | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim().toLowerCase();
  }
  return (value.address || "").trim().toLowerCase();
}

export function duckAddressLabel(value: DuckMailAddress | undefined): string {
  if (!value) return "Remetente desconhecido";
  if (typeof value === "string") return value;
  return value.name && value.address ? `${value.name} <${value.address}>` : value.address || value.name || "Remetente desconhecido";
}

export function duckHtmlToText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
