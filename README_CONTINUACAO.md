# Strong Mail — source para continuidade

## O que existe

O projeto contém uma interface React/Vite responsiva de login e uma caixa de entrada demonstrativa em preto, branco e cinza, usando a logo ST fornecida.

## Estrutura principal

- `client/src/pages/Home.tsx`: login, estado pós-login e caixa de entrada demonstrativa.
- `client/src/index.css`: identidade visual, responsividade e estilos da caixa de entrada.
- `client/index.html`: título, meta tags e fontes.
- `client/src/App.tsx`: tema escuro e roteamento.

## Executar localmente

```bash
pnpm install
pnpm dev
```

Para validar:

```bash
pnpm check
pnpm build
```

## Comportamento atual

- `client/src/lib/auth.ts` valida formato de e-mail e tamanho mínimo de senha no frontend e simula uma checagem de login (`attemptDemoLogin`). Só a credencial de demonstração documentada no próprio arquivo (`demo@strongmail.app` / `demo1234`) abre a caixa de entrada; qualquer outra combinação retorna a mensagem genérica "E-mail ou senha incorretos.", sem indicar se o e-mail existe.
- `client/src/lib/mail-data.ts` guarda o modelo de mensagem (`MailItem`) e a simulação de novas mensagens/códigos (`simulateIncomingMail`), usada tanto no botão **Atualizar** quanto no intervalo automático de 5 segundos.
- Nenhum e-mail real é lido ou enviado — tudo é gerado no cliente para fins de demonstração.

## Próxima etapa recomendada

Para produção, transformar o projeto em uma aplicação com backend real:

1. Autenticação segura com sessões (substituir `attemptDemoLogin` por uma chamada real):
   ```
   POST /api/auth/login { email, password }
   ```
   O backend deve verificar a senha com Argon2/bcrypt, criar um cookie de sessão `HttpOnly`, `Secure` e `SameSite`, aplicar limite de tentativas e nunca revelar se o e-mail existe.
2. Banco de dados para usuários e mensagens.
3. Serviço de envio SMTP/API para códigos de verificação (gerados com hash e expiração no backend).
4. Integração IMAP ou API de provedor para buscar mensagens reais, substituindo `simulateIncomingMail` por:
   ```
   GET /api/messages
   ```
5. Variáveis de ambiente para credenciais, sem gravar segredos no frontend (nunca usar `VITE_*` para chaves de SMTP/IMAP ou senhas).

### Variáveis de ambiente (quando o backend for criado)

Nenhuma variável sensível deve viver no frontend. Sugestão de variáveis **apenas no backend** (nunca prefixadas com `VITE_`):

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | conexão com o banco de usuários/mensagens |
| `SESSION_SECRET` | assinatura dos cookies de sessão |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | envio de códigos de verificação |
| `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD` (ou credenciais OAuth do provedor) | leitura de mensagens reais |
| `LOGIN_CODE_TTL_SECONDS` | expiração dos códigos de login |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | limite de tentativas de login/código |

### Domínio e e-mail real

O endereço de hospedagem (`*.manus.space`) serve apenas para servir a aplicação — ele **não** cria caixas postais como `usuario@seudominio.com` automaticamente. Para isso é necessário: domínio próprio, provedor de e-mail configurado, registros MX/SPF/DKIM/DMARC, e o backend conectado via SMTP/IMAP ou API do provedor. Enquanto essa integração não existir, a aplicação não deve alegar que recebe e-mails reais.

Não coloque senhas de Gmail ou tokens privados diretamente nos arquivos React. Use OAuth ou um backend seguro.

## Modo "caixa real" via Google OAuth (implementado)

Para fins de estudo, já existe um caminho para ver e-mails **de verdade** dentro da interface do Strong Mail, sem reimplementar SMTP/IMAP: o backend se autentica na SUA conta Google via OAuth2 (escopo `gmail.readonly`, só leitura) e espelha as mensagens.

Arquivos:
- `server/google.ts`: cria a URL de consentimento do Google, troca o `code` por tokens, busca o e-mail da conta e lista as mensagens recentes (metadados: remetente, assunto, snippet, se está não lida).
- `server/index.ts`: expõe as rotas HTTP e guarda a sessão.
- `client/src/lib/google-inbox.ts`: chama essas rotas do frontend.

Rotas expostas pelo backend:
| Rota | O que faz |
| --- | --- |
| `GET /api/auth/google` | redireciona para a tela de consentimento do Google |
| `GET /api/auth/google/callback` | recebe o `code`, cria a sessão (cookie `HttpOnly`) |
| `GET /api/session` | diz se há sessão ativa e qual e-mail |
| `GET /api/messages` | lista as mensagens recentes da conta autenticada |
| `POST /api/auth/logout` | encerra a sessão |

### Como configurar (passo a passo)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **Gmail API**.
2. Em "APIs & Services > Credentials", crie uma credencial **OAuth client ID** do tipo "Web application".
3. Em "Authorized redirect URIs", adicione: `http://localhost:3001/api/auth/google/callback`.
4. Copie `.env.example` para `.env` e preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
5. Instale as dependências novas e rode os dois processos em terminais separados:
   ```bash
   pnpm install
   pnpm dev:api   # backend (OAuth + Gmail), porta 3001
   pnpm dev       # frontend (Vite), porta 3000 — proxya /api pra :3001
   ```
6. Abra `http://localhost:3000`, clique em **"Entrar com Google (ler caixa real)"**, autorize o acesso somente-leitura e volte para a caixa de entrada — ela vai mostrar suas mensagens reais e atualizar a cada 5s.

### Limitações e próximos passos

- Sessões ficam em memória (`Map`) — reiniciar o backend derruba todo mundo. Para algo além de estudo, troque por Redis ou uma tabela no banco.
- Não há renovação automática de `refresh_token` expirado nem revogação de acesso pela UI — para uma conta de teste isso normalmente não é um problema.
- Isso cobre **leitura** de e-mail (para conferir códigos de verificação, por exemplo). Não implementa envio nem criação de caixas `@seudominio.com` — para isso, veja a seção "Domínio e e-mail real" acima.
- Gerar endereços aleatórios/descartáveis em massa para burlar limites de "uma conta por e-mail" de terceiros (ex.: criar várias contas na mesma plataforma) normalmente viola os Termos de Serviço dessa plataforma — este fluxo foi pensado para **uma conta pessoal sua**, não para geração em escala.
