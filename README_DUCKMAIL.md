# Strong Mail + DuckMail (sem API key)

Esta versão usa a API pública do DuckMail para criar/entrar em caixas e listar mensagens recebidas.

Base da API: `https://api.duckmail.sbs`

A API documenta que API key é opcional; os domínios públicos podem ser usados sem uma chave `dk_...`. A criação da conta retorna a conta e, em seguida, `POST /token` fornece o token da própria caixa. As mensagens são lidas com `GET /messages` e o corpo completo com `GET /messages/{id}`.

## Como usar

1. Na raiz, crie `.env` (não publique esse arquivo).
2. Use pelo menos:

```env
NODE_ENV=development
PORT=3001
SESSION_SECRET=sua-chave-local
```

3. Rode:

```powershell
pnpm install
pnpm dev:api
```

Em outro terminal:

```powershell
pnpm dev
```

4. Abra `http://localhost:5173`.
5. Clique em **Criar uma nova caixa**. O Strong Mail gera uma senha aleatória segura no backend e mostra os dados uma única vez na interface para você guardar. O Strong Mail consulta `/domains`, cria uma caixa em um domínio público disponível e já inicia a sessão com o token DuckMail.
6. Copie o endereço mostrado e use-o em um serviço em que você tenha autorização para testar o recebimento de e-mail.
7. As mensagens recebidas naquela caixa aparecerão no Strong Mail ao atualizar; o frontend também atualiza a cada 5 segundos.

## Login posterior

Você pode sair e entrar novamente usando o endereço criado e a a senha aleatória exibida na criação, porque o Strong Mail autentica a própria caixa através de `POST /token` do DuckMail.

## Importante

- Não é necessária uma API key para domínios públicos.
- O domínio `strongmail.shop` só pode ser usado se estiver configurado no DuckMail como domínio privado e disponível para sua conta.
- Não coloque uma API key ou senha em código React, GitHub ou variáveis `VITE_*`.
- O serviço DuckMail é externo; o site continua rodando no seu computador.
