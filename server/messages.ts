import type { MailItem } from "../client/src/lib/mail-data";
import { duckAddressLabel, duckHtmlToText, duckAddressEmail, getDuckMessage, listDuckMessages } from "./duckmail";
import type { LocalSession } from "./session";

const bodyCache = new Map<string, { text: string; html?: string; links: Array<{ label: string; url: string }> }>();

function extractCode(value: string): string | undefined {
  return value.match(/\b\d{6}\b/)?.[0];
}

function formatTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function sanitizeEmailHtml(source: string): string {
  return source
    .replace(/<\/?(script|iframe|object|embed|form|input|button|textarea|select|style)[^>]*>/gi, "")
    .replace(/<[^>]+\s+on[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "")
    .replace(/<(img)([^>]*?)>/gi, (_match, tag: string, attrs: string) => {
      const safeAttrs = attrs.replace(/\s+(src|href)\s*=\s*(["'])\s*(?!https?:|data:image\/)[^"']*\2/gi, "");
      return `<${tag}${safeAttrs}>`;
    });
}

function htmlBody(value: string | string[] | null | undefined): { text: string; html?: string; links: Array<{ label: string; url: string }> } {
  if (!value) return { text: "", links: [] };
  const source = Array.isArray(value) ? value.join("\n") : value;
  const links: Array<{ label: string; url: string }> = [];
  const cleaned = source.replace(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, label: string) => {
    const text = duckHtmlToText(label);
    links.push({ label: text || href, url: href });
    return ` ${text || href} `;
  });
  return { text: duckHtmlToText(cleaned), html: sanitizeEmailHtml(source), links };
}

function extractLinks(text: string, links: Array<{ label: string; url: string }>): Array<{ label: string; url: string }> {
  const seen = new Set(links.map((item) => item.url));
  const result = [...links];
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const url = match[0].replace(/[),.;]+$/, "");
    if (!seen.has(url)) {
      seen.add(url);
      result.push({ label: url, url });
    }
  }
  return result.slice(0, 20);
}

export async function getInboundMessagesForSession(session: LocalSession): Promise<MailItem[]> {
  const summaries = await listDuckMessages(session.duckToken);
  const messages = await Promise.all(summaries.slice(0, 50).map(async (summary) => {
    const cached = bodyCache.get(summary.id);
    let body = cached?.text || "";
    let html = cached?.html;
    let links = cached?.links || [];
    let detail = summary;
    if (!cached) {
      detail = await getDuckMessage(session.duckToken, summary.id);
      const parsed = detail.text
        ? { text: detail.text, links: [] as Array<{ label: string; url: string }> }
        : htmlBody(detail.html);
      body = parsed.text.replace(/\s+/g, " ").trim();
      html = parsed.html;
      links = extractLinks(body, parsed.links);
      bodyCache.set(summary.id, { text: body, links });
    }

    const recipients = (detail.to || summary.to || []).map(duckAddressEmail);
    if (!recipients.includes(session.email.toLowerCase())) return null;

    return {
      id: detail.id,
      sender: duckAddressLabel(detail.from || summary.from),
      subject: detail.subject || "Sem assunto",
      preview: body.slice(0, 240) || "Mensagem recebida.",
      body,
      html,
      links,
      time: formatTime(detail.createdAt || detail.updatedAt),
      unread: detail.seen === false,
      ...(extractCode(`${detail.subject || ""} ${body}`) ? { code: extractCode(`${detail.subject || ""} ${body}`) } : {}),
    } satisfies MailItem;
  }));

  return messages.filter((message) => message !== null);
}
