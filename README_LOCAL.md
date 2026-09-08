# Strong Mail — ambiente local

Esta versão foi preparada exclusivamente para testes locais. O frontend e a API rodam em `localhost`; não há integração com Gmail, OAuth, domínio próprio, IMAP ou publicação pública no fluxo principal. O único serviço externo opcional é o Mailtrap Sandbox, usado somente como caixa SMTP de testes.

## O que foi configurado

- Login por código de 6 dígitos enviado por SMTP.
- Código armazenado apenas como hash em memória, com validade de 10 minutos e até 5 tentativas.
- Sessões em memória no backend.
- `GET /api/messages` com mensagens de teste em memória.
- Atualização automática da caixa a cada 5 segundos.
- Proxy Vite de `/api` para `http://localhost:3001`.
- Logo ST servida localmente, sem depender do `manus-storage`.

## Arquivos principais

Criados:

- `server/email.ts`
- `server/session.ts`
- `server/messages.ts`
- `README_LOCAL.md`

Alterados:

- `server/index.ts`
- `server/auth-code-routes.ts`
- `client/src/pages/Home.tsx`
- `package.json`
- `.env.example`
- `.gitignore`

Removidos do fluxo local:

- `server/google.ts` não é mais importado.
- `client/src/lib/auth.ts` e `client/src/lib/google-inbox.ts` foram removidos porque o login por senha/demo e o Gmail não fazem parte desta etapa.

## Dependências

```bash
pnpm install
```

As dependências `nodemailer` e `dotenv` foram adicionadas ao `package.json`, junto de `@types/nodemailer`.

## Mailtrap Sandbox

Copie o exemplo:

```powershell
copy .env.example .env
notepad .env
```

Preencha somente no arquivo `.env` local:

```dotenv
NODE_ENV=development
PORT=3001
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=COLE_SEU_NOVO_USUARIO
SMTP_PASSWORD=COLE_SUA_NOVA_SENHA
SMTP_SECURE=false
SMTP_FROM=Strong Mail <no-reply@strongmail.test>
SESSION_SECRET=troque-por-um-valor-local
```

No Mailtrap, use as credenciais novas exibidas nas configurações SMTP do Sandbox. Não coloque essas credenciais no React, em `VITE_*`, no Git ou no `..env.example`.

## Mailpit sem Docker

O Mailpit funciona como um binário único, sem exigir Docker, e por padrão usa SMTP `1025` e painel web `8025`. Os binários estáticos para Windows ficam na página oficial de releases. Consulte a documentação oficial para a versão atual: https://mailpit.axllent.org/docs/install/

Baixe o arquivo para Windows, extraia `mailpit.exe` e execute em um terminal:

```powershell
.\mailpit.exe
```

Depois abra:

```text
http://localhost:8025
```

Para usar o Mailpit com este projeto, altere `.env` para:

```dotenv
NODE_ENV=development
PORT=3001
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_FROM=Strong Mail <no-reply@strongmail.test>
SESSION_SECRET=troque-por-um-valor-local
```

Não é necessário autenticação SMTP nessa configuração local.

## Iniciar no Windows

Terminal 1 — API:

```powershell
pnpm dev:api
```

Terminal 2 — frontend:

```powershell
pnpm dev
```

Abra o endereço mostrado pelo Vite, normalmente:

```text
http://localhost:5173
```

A API deve aparecer no terminal como:

```text
http://localhost:3001
```

## Fluxo de teste

1. Inicie Mailtrap ou Mailpit.
2. Inicie a API.
3. Inicie o Vite.
4. Abra `http://localhost:5173`.
5. Informe `knkn244@strongmail.test`.
6. Clique em `Enviar código`.
7. Abra o Sandbox do Mailtrap ou `http://localhost:8025` no Mailpit.
8. Copie o código recebido.
9. Digite os 6 dígitos no Strong Mail.
10. Clique em `Entrar`.
11. A caixa de entrada local será carregada.
12. A cada 5 segundos o frontend chama `GET /api/messages`.
13. Use `Atualizar` para uma sincronização manual.
14. Use `Sair` para apagar a sessão do backend.

Também valide código incorreto, campos vazios, expiração após 10 minutos e bloqueio após 5 tentativas.

## Rotas locais

```text
POST /api/auth/send-code
POST /api/auth/verify-code
GET  /api/session
POST /api/auth/logout
GET  /api/messages
```

## Limitações desta etapa

As sessões e mensagens ficam somente em memória e desaparecem ao reiniciar a API. O `/api/messages` é uma caixa de testes simulada; ele não lê IMAP nem mensagens externas. Mailtrap e Mailpit são usados para visualizar o e-mail SMTP enviado pelo backend, mas o conteúdo da caixa dentro do Strong Mail continua sendo o armazenamento local de protótipo.

## Teste local de cadastro Discord

O botão **Testar cadastro Discord** executa apenas uma simulação local. Ele não chama a API do Discord e não cria contas reais. O objetivo é validar o fluxo de cadastro + verificação de e-mail dentro do Strong Mail.

Fluxo: nome de usuário + e-mail → código enviado pelo SMTP configurado → código aparece no Mailtrap/Mailpit → confirmação → mensagem **Discord (simulação)** aparece na caixa local.

## Teste de mensagem “Discord” via Mailtrap

O botão **Simular e-mail do Discord** não cria uma conta real no Discord. Ele gera um código aleatório no backend e envia uma mensagem de teste pelo SMTP configurado. Com Mailtrap, essa mensagem aparece no Sandbox como se viesse de `Discord <noreply@discord.com>` e também é adicionada à caixa local em memória.

Fluxo:

```text
Strong Mail → /api/dev/discord/send-code
           → SMTP Mailtrap
           → mensagem “Verifique seu endereço de e-mail — Discord”
           → caixa local do Strong Mail
```

Depois de enviar o código, use **Atualizar** no Strong Mail para carregar a mensagem. Abra a mensagem e use o código para concluir o teste local.


## Login local por e-mail e senha

O Strong Mail local agora usa login por e-mail + senha. Configure no `.env`:

```env
```

Se o e-mail não for o cadastrado, a API responde `E-mail não cadastrado.`. Se o e-mail existir e a senha estiver errada, responde `Senha incorreta.`.

O código de 6 dígitos continua disponível somente para testes de mensagens SMTP; ele não é usado para entrar no Strong Mail.


## Mailtrap Inbound para mensagens reais

O SMTP Sandbox serve para testar o envio do próprio Strong Mail. Para receber mensagens enviadas por serviços externos, use uma Inbox do produto Inbound Email do Mailtrap. Uma inbox hospedada recebe um endereço real, por exemplo `app-3f2a@inbound.mailtrap.io`, sem exigir domínio próprio ou DNS.

No `.env`, mantenha apenas `DUCKMAIL_API`, `PORT`, `NODE_ENV` e `SESSION_SECRET` para esta versão. A caixa e o token são criados por conta, sem API key global.

Não use `knkn244@strongmail.test` para receber mensagens externas: `.test` não é uma caixa de correio pública. Use o endereço hospedado que o Mailtrap fornecer ou um domínio real configurado no Mailtrap Inbound.
