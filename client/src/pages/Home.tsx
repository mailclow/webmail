import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  ChevronDown,
  Inbox,
  Languages,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { type MailItem } from "@/lib/mail-data";

const AUTO_REFRESH_INTERVAL_MS = 5000;
const API_BASE = "https://webmail-ji61.onrender.com";

type SessionResponse = { authenticated: boolean; email: string | null };
type MessagesResponse = { messages: MailItem[] };
type Folder = "inbox" | "starred" | "archived" | "trash";

async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE}/api/session`, { credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível verificar a sessão.");
  return (await response.json()) as SessionResponse;
}

async function fetchMessages(): Promise<MailItem[]> {
  const response = await fetch(`${API_BASE}/api/messages`, { credentials: "include" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Não foi possível carregar as mensagens.");
  }
  const payload = (await response.json()) as MessagesResponse;
  return payload.messages ?? [];
}

async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Não foi possível entrar.");
  }
}

async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Não foi possível sair.");
}

function renderLinkedText(text: string, links: Array<{ label: string; url: string }>) {
  const known = new Map(links.map((item) => [item.url, item]));
  const urlPattern = /(https?:\/\/[^\s<>"']+)/g;
  const parts = text.split(urlPattern);
  return parts.map((part, index) => {
    if (!part) return null;
    const url = part.replace(/[),.;]+$/, "");
    const trailing = part.slice(url.length);
    if (/^https?:\/\//i.test(url)) {
      const label = known.get(url)?.label || url;
      return (
        <span key={`${url}-${index}`}>
          <a href={url} target="_blank" rel="noopener noreferrer nofollow">{label}</a>{trailing}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function linkLabel(url: string, label: string): string {
  const normalized = label.trim();
  if (normalized && normalized.length < 70 && !/^https?:\/\//i.test(normalized)) return normalized;
  const lower = `${normalized} ${url}`.toLowerCase();
  if (lower.includes("verify") || lower.includes("confirm") || lower.includes("verif")) return "Verificar e-mail";
  if (lower.includes("reset") || lower.includes("recover") || lower.includes("senha")) return "Redefinir senha";
  if (lower.includes("login") || lower.includes("sign in") || lower.includes("entrar")) return "Entrar";
  return "Abrir link seguro";
}

function InboxView({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [mails, setMails] = useState<MailItem[]>([]);
  const [lastSync, setLastSync] = useState(new Date());
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);
  const [themeDark, setThemeDark] = useState(true);

  async function refreshInbox() {
    setSyncing(true);
    try {
      const next = await fetchMessages();
      setMails(next);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível atualizar a caixa.");
    } finally {
      setLastSync(new Date());
      setSyncing(false);
    }
  }

  useEffect(() => {
    void refreshInbox();
    const timer = window.setInterval(() => void refreshInbox(), AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(() => ({
    unread: mails.filter((mail) => mail.unread).length,
    starred: mails.filter((mail) => mail.starred).length,
    archived: mails.filter((mail) => mail.archived).length,
    trash: mails.filter((mail) => mail.trashed).length,
  }), [mails]);

  const visibleMails = mails.filter((mail) => {
    if (folder === "starred") return Boolean(mail.starred) && !mail.trashed;
    if (folder === "archived") return Boolean(mail.archived) && !mail.trashed;
    if (folder === "trash") return Boolean(mail.trashed);
    return !mail.archived && !mail.trashed;
  });

  function openMail(mail: MailItem) {
    setSelectedMail({ ...mail, unread: false });
    setMails((current) => current.map((item) => item.id === mail.id ? { ...item, unread: false } : item));
  }

  function toggleMailFlag(id: string, field: "starred" | "archived" | "trashed") {
    setMails((current) => current.map((mail) => mail.id === id ? { ...mail, [field]: !mail[field] } : mail));
  }

  return (
    <main className={`mail-shell ${themeDark ? "" : "mail-shell-light"}`}>
      <header className="mail-topbar">
        <div className="mail-brand">
          <span className="mail-brand-mark">ST</span>
          <span>strong<span>mail</span></span>
        </div>
        <div className="mail-user">
          <span>{email}</span>
          <button type="button" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <div className="mail-layout">
        <aside className="mail-sidebar">
          <nav className="mail-nav" aria-label="Pastas">
            {([
              ["inbox", "Caixa de entrada", Inbox, counts.unread],
              ["starred", "Com estrela", Star, counts.starred],
              ["archived", "Arquivadas", Archive, counts.archived],
              ["trash", "Lixeira", Trash2, counts.trash],
            ] as const).map(([key, label, Icon, count]) => (
              <button key={key} className={`mail-nav-item ${folder === key ? "active" : ""}`} type="button" onClick={() => setFolder(key)}>
                <Icon size={16} /> {label} {count > 0 && <b>{count}</b>}
              </button>
            ))}
          </nav>
          <div className="storage-card">
            <span>Armazenamento</span>
            <strong>Memória local</strong>
            <div><i /></div>
            <small>Somente durante este teste</small>
          </div>
        </aside>

        <section className="inbox-panel">
          <div className="inbox-heading">
            <div>
              <p className="inbox-kicker">seu espaço pessoal</p>
              <h1>{folder === "inbox" ? "Caixa de entrada" : folder === "starred" ? "Com estrela" : folder === "archived" ? "Arquivadas" : "Lixeira"} <span>{visibleMails.length}</span></h1>
            </div>
            <div className="heading-actions">
              <button className="icon-action" type="button" onClick={() => setThemeDark((value) => !value)} title="Alternar tema"><Moon size={15} /></button>
              <button className={`refresh-button ${syncing ? "is-syncing" : ""}`} type="button" onClick={() => void refreshInbox()} disabled={syncing} aria-busy={syncing}>
                <RefreshCw size={15} /> Atualizar
              </button>
            </div>
          </div>

          <div className="sync-line" aria-live="polite">
            <span className="live-dot" /> atualização automática a cada 5 segundos <span>•</span> última sincronização às {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {loadError && <span className="sync-error"> • {loadError}</span>}
          </div>

          <div className="mail-list">
            {visibleMails.length === 0 ? (
              <div className="empty-state"><Mail size={22} /><strong>Nenhuma mensagem aqui</strong><span>Esta caixa só mostra mensagens enviadas para este endereço.</span></div>
            ) : visibleMails.map((mail) => (
              <article className={`mail-row ${mail.unread ? "unread" : ""}`} key={mail.id} onClick={() => openMail(mail)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") openMail(mail); }}>
                <div className="mail-sender-avatar">{mail.sender.slice(0, 1)}</div>
                <div className="mail-copy">
                  <strong>{mail.sender}</strong>
                  <h2>{mail.subject}</h2>
                  <p>{mail.preview}</p>
                  {mail.code && <code>{mail.code}</code>}
                </div>
                <div className="mail-row-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title="Estrela" onClick={() => toggleMailFlag(mail.id, "starred")}><Star size={14} fill={mail.starred ? "currentColor" : "none"} /></button>
                  <button type="button" title="Arquivar" onClick={() => toggleMailFlag(mail.id, "archived")}><Archive size={14} /></button>
                  <button type="button" title="Lixeira" onClick={() => toggleMailFlag(mail.id, "trashed")}><Trash2 size={14} /></button>
                </div>
                <time>{mail.time}</time>
                {mail.unread && <span className="unread-dot" aria-label="Não lida" />}
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer className="mail-footer">Todos os direitos reservados. 2026 <span>•</span> <a href="https://support.google.com/mail/answer/10434152?hl=pt-br" target="_blank" rel="noreferrer">Privacidade</a></footer>

      {selectedMail && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMail(null); }}>
          <section className="mail-detail" role="dialog" aria-modal="true" aria-labelledby="mail-detail-title">
            <button className="modal-close" type="button" onClick={() => setSelectedMail(null)} aria-label="Fechar"><X size={17} /></button>
            <div className="detail-avatar">{selectedMail.sender.slice(0, 1)}</div>
            <p className="modal-kicker">mensagem recebida</p>
            <h2 id="mail-detail-title">{selectedMail.subject}</h2>
            <div className="detail-meta"><strong>{selectedMail.sender}</strong><span>{selectedMail.time}</span></div>
            <div className="detail-body">
              {selectedMail.html ? <div className="email-html" dangerouslySetInnerHTML={{ __html: selectedMail.html }} /> : renderLinkedText(selectedMail.body || selectedMail.preview, selectedMail.links || [])}
              {selectedMail.links && selectedMail.links.length > 0 && !selectedMail.links.every((link) => (selectedMail.body || "").includes(link.url)) && (
                <div className="detail-links">
                  {selectedMail.links.slice(0, 8).map((link) => (
                    <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer nofollow">{linkLabel(link.url, link.label)}</a>
                  ))}
                </div>
              )}
            </div>
            {selectedMail.code && <div className="detail-code">{selectedMail.code}</div>}
            <div className="detail-actions">
              <button type="button" onClick={() => { toggleMailFlag(selectedMail.id, "starred"); setSelectedMail((value) => value ? ({ ...value, starred: !value.starred }) : value); }}><Star size={15} /> Estrela</button>
              <button type="button" onClick={() => { toggleMailFlag(selectedMail.id, "archived"); setSelectedMail(null); }}><Archive size={15} /> Arquivar</button>
              <button type="button" onClick={() => { toggleMailFlag(selectedMail.id, "trashed"); setSelectedMail(null); }}><Trash2 size={15} /> Lixeira</button>
            </div>
          </section>
        </div>
      )}

    </main>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    fetchSession()
      .then((session) => {
        setAuthenticated(session.authenticated);
        if (session.authenticated && session.email) setEmail(session.email);
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingSession(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setFieldError("Informe um e-mail válido.");
      return;
    }
    if (!password) {
      setFieldError("Informe sua senha.");
      return;
    }

    setSubmitting(true);
    try {
      await login(normalizedEmail, password);
      setEmail(normalizedEmail);
      setAuthenticated(true);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try { await logout(); } finally {
      setAuthenticated(false);
      setPassword("");
      setFieldError("");
      }
  }

  if (checkingSession) return null;
  if (authenticated) return <InboxView email={email} onLogout={handleLogout} />;

  return (
    <main className="auth-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="grain" />
      <section className="login-card" aria-label="Acesso Strong Mail">
        <header className="card-header">
          <div className="header-identity"><div className="header-avatar"><UserRound size={15} strokeWidth={2.2} /></div><span>Login de usuário</span></div>
          <div className="header-controls">
            <button className="icon-button" type="button" aria-label="Tema escuro"><Moon size={16} /></button>
            <div className="theme-toggle" aria-label="Tema escuro ativado"><span /></div>
            <button className="locale-select" type="button" aria-label="Selecionar idioma"><Languages size={15} /><span>PT</span><ChevronDown size={13} /></button>
          </div>
        </header>

        <div className="card-content">
          <div className="brand-lockup"><div className="mark-stage"><div className="stage-glow" /><img className="brand-logo-image" src="/webmail/strong-mail-st-logo-transparent.png" alt="Logo ST" /></div><div className="brand-name">strong<span>mail</span><b>®</b></div><div className="brand-tagline"><span /> ST private mail <span /></div></div>
          <div className="welcome-copy"><h1>Bem-vindo</h1><p>Entre com seu e-mail e senha para acessar sua caixa de entrada.</p></div>
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="field-label" htmlFor="email">E-mail</label>
            <div className="field-wrap"><Mail className="field-icon" size={17} /><input id="email" type="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => { setEmail(event.target.value); setFieldError(""); }} autoComplete="email" aria-invalid={Boolean(fieldError)} /></div>
            <label className="field-label" htmlFor="password" style={{ marginTop: 17 }}>Senha</label>
            <div className="field-wrap"><ShieldCheck className="field-icon" size={17} /><input id="password" type="password" placeholder="Sua senha" value={password} onChange={(event) => { setPassword(event.target.value); setFieldError(""); }} autoComplete="current-password" aria-invalid={Boolean(fieldError)} /></div>
            {fieldError && <p className="field-error" role="alert">{fieldError}</p>}
            <button className="primary-button" type="submit" disabled={submitting}><span>{submitting ? "Aguarde..." : "Entrar"}</span><ArrowRight size={17} /></button>
          </form>
          <p className="privacy-note"><ShieldCheck size={13} /> acesso seguro por e-mail e senha</p>

        </div>
      </section>
      <footer className="page-footer">Todos os direitos reservados. 2026 <span className="footer-dot" /> <a href="https://support.google.com/mail/answer/10434152?hl=pt-br" target="_blank" rel="noreferrer">Privacidade</a></footer>
    </main>
  );
}
