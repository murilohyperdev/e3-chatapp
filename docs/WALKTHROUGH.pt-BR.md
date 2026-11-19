# Explicação do código (itens 1 a 4)

Notas para a entrevista: o que cada parte faz e por que foi feita assim. Versão em inglês: [WALKTHROUGH.md](WALKTHROUGH.md).

## 1. Como as peças se encaixam

```
Navegador (React, :5173)
   |  requisições de mesma origem: /api, /sanctum, /storage, /app
   v
Servidor Vite (proxy)  ---->  API Laravel (:8000)  ---->  PostgreSQL
   |                                |    |
   |                                |    +--> Mailpit (SMTP :1025, caixa de entrada :8025)
   |  upgrade WebSocket: /app       |
   v                                | publica novas mensagens (HTTP)
Servidor WebSocket Reverb (:8080) <-+
```

* **Uma só origem.** O navegador só fala com o Vite, que repassa `/api`, `/sanctum` e `/storage` ao Laravel e o caminho de WebSocket `/app` ao Reverb. Os cookies
  são de primeira parte, não há CORS, e o mesmo formato funciona atrás de um único proxy reverso em produção.
* **Sessões, não tokens.** O modo SPA do Laravel Sanctum guarda o login em um cookie de sessão `HttpOnly` que o
  JavaScript não consegue ler; assim, uma falha de XSS não rouba token. Revogar é só encerrar a sessão.
* **Fluxo orientado a especificação.** Cada item passou pelo OpenSpec: explore, propose (proposta, specs, design,
  tarefas), apply e archive. As specs de cada capacidade ficam em `openspec/specs/` (`user-auth`, `password-recovery`,
  `user-roles`, `user-profiles`, `user-directory`, `chat-messages`, `chat-realtime`, `chat-page`) e o histórico em `openspec/changes/archive/`.

## 2. Item 1: autenticação

**Backend**

| Arquivo | O quê e por quê |
|---------|-----------------|
| `bootstrap/app.php` | `statefulApi()` inicia a sessão e verifica o CSRF das requisições vindas da origem do SPA. |
| `.env` `SANCTUM_STATEFUL_DOMAINS` | Sem `localhost:5173` nessa lista, o Sanctum trataria o SPA como cliente sem estado e nenhuma sessão começaria. |
| `Http/Requests/Auth/LoginRequest.php` | Validação mais limite de tentativas (5 falhas por e-mail+IP, depois espera). Mesmo erro para e-mail desconhecido e senha errada, para que não dê para descobrir quais contas existem. |
| `Http/Controllers/Auth/AuthController.php` | Enxuto: `login` (regenera o id da sessão contra fixação de sessão), `logout` (invalida a sessão, troca o token CSRF, devolve 204) e `me`. |
| `Http/Controllers/Auth/PasswordResetController.php` | Usa o broker de senhas do Laravel: tokens com hash, de uso único e 60 minutos de validade, com limite de 60 segundos entre pedidos. `forgot` responde igual para e-mail conhecido e desconhecido. |
| `Providers/AppServiceProvider.php` | `ResetPassword::createUrlUsing` faz o link do e-mail apontar para a página React (`/reset-password?token=..&email=..`) em vez de uma rota do Laravel que não existe. |
| `config/app.php` `frontend_url` | Chave de configuração lida de `FRONTEND_URL`; o código nunca chama `env()` fora dos arquivos de config. |
| `Http/Resources/UserResource.php` | Lista fixa de campos devolvidos: a senha nunca vaza por acidente. |

**Frontend**

| Arquivo | O quê e por quê |
|---------|-----------------|
| `api/client.ts` | Wrapper do `fetch`. Busca `/sanctum/csrf-cookie` quando preciso e devolve o cookie `XSRF-TOKEN` no cabeçalho `X-XSRF-TOKEN` (o axios faz isso sozinho, o fetch não). Trata 204, mantém o mapa de erros `errors` do 422 em `ApiError`, tenta de novo uma vez em 419 e avisa o provider de autenticação em qualquer 401. |
| `auth/AuthProvider.tsx` | Único responsável por "quem está logado". Pergunta ao servidor (`GET /api/user`) ao carregar; nada fica guardado no navegador. Um context basta para um único estado global. |
| `auth/guards.tsx` | Wrappers de rota `RequireAuth` e `GuestOnly`: os redirecionamentos ficam fora das páginas. |
| `pages/Login`, `ForgotPassword`, `ResetPassword` | Formulários que mostram os erros por campo vindos do servidor. A página de redefinição fica fora do `GuestOnly` para que o link do e-mail funcione em qualquer estado. |

**Por que essas decisões.** Sessão por cookie em vez de JWT: não há token para guardar, a revogação é simples e o
preço (CSRF) é tratado em um único lugar. Broker de redefinição: expiração, hash e limite de tentativas são problemas
já resolvidos; tokens feitos à mão são fonte clássica de vulnerabilidades.

## 3. Item 2: tipos de usuário e permissões

* `users.role` é uma coluna string com padrão `user`, convertida para o enum `UserRole` (`user`, `administrator`).
  O cast para enum mantém a validade no PHP e a migration simples (um tipo enum do banco é difícil de alterar).
* `Enums/Ability.php` lista as seis habilidades do enunciado. `UserRole::abilities()` é a **tabela única** de quem
  pode o quê; os gates, a resposta da API, a tabela do README e os testes leem dela.
* `AppServiceProvider` registra um **Gate** por habilidade. Gates (e não policies) porque são capacidades da aplicação
  inteira, ainda sem modelo. Uma rota futura é protegida com
  `->middleware(['auth:sanctum', 'can:start-alerts'])`: visitante recebe 401, usuário sem a habilidade recebe 403.
* `role` **não** está em `#[Fillable]` nem em nenhuma regra de validação, então nenhuma requisição promove um usuário.
  Um teste garante isso. O seeder e a factory definem o papel explicitamente (`forceFill`, estado `administrator()`).
* `GET /api/user` devolve `role` e um mapa `abilities`. A interface React usa isso só para esconder controles; quem
  decide cada requisição é o servidor.
* Alertas e chat ainda não existem, então `RoleEnforcementTest` registra rotas descartáveis com o middleware real
  para provar 401/403/200 e chamadas diretas com sessão de verdade.
* Seeds (`DatabaseSeeder`): `admin@example.com` (administrador), `user@example.com` e mais três usuários; idempotente;
  senha `password` (apenas demonstração).

## 4. Item 3: perfis e diretório

* Colunas `phone`, `address` e `avatar_path` em `users` (relação um para um, pequena, então sem tabela separada).
  Só `name`, `phone` e `address` são preenchíveis em massa; `email`, `role` e `avatar_path` não são.
* A **propriedade** é a `UserPolicy::update` (`$actor->is($target)`). Uma policy cabe aqui porque a regra depende de
  uma instância de modelo. Administradores deliberadamente não são exceção, pois o enunciado diz que ninguém edita o
  perfil de outra pessoa.
* Os form requests autorizam com a policy, então a autorização roda **antes** da validação: editar o perfil de outro é
  sempre 403, nunca um 422 que revele algo sobre o alvo.
* **Validação:** nome obrigatório, até 100 caracteres; telefone com `+`, dígitos, espaços, hífens e parênteses, de 7 a
  20 caracteres; endereço até 255; foto `image`, `mimes:jpg,jpeg,png,webp` (confere o conteúdo real; SVG fica de fora
  porque pode carregar scripts), 2 MB, de 64 a 4096 px.
* **Armazenamento:** disco `public`, nomes com hash, e o banco guarda um caminho relativo; o novo caminho é salvo antes
  de apagar o arquivo antigo, então uma falha nunca deixa um perfil apontando para o nada. A URL do disco `public` é
  relativa (`/storage/...`) para funcionar pelo proxy do Vite; o entrypoint do container cria o `storage:link`.
* **Dois resources:** `UserResource` (próprio usuário: e-mail, telefone, endereço) e `DirectoryUserResource` (id,
  nome, foto, papel). Classes separadas tornam um vazamento um contrato visível, e não um `when()` esquecido; a consulta
  do diretório também seleciona só essas colunas. `GET /api/users` é paginado (12 por página) e ordenado por nome.
* **Frontend:** `AppLayout` (navegação), `ProfilePage` (formulário, envio e remoção de foto; salvar atualiza o usuário
  logado), `PeoplePage` (diretório com "Load more" e avatar com inicial quando não há foto). O upload usa `FormData`
  sem `Content-Type` manual para o navegador definir o boundary do multipart. O envio da foto é POST porque o PHP não
  interpreta corpo multipart em PATCH.

## 5. Item 4: a sala de chat

**Caminho de uma mensagem.** O navegador faz `POST /api/messages` (cookie de sessão + CSRF) -> gate `can:send-messages` ->
`StoreMessageRequest` valida -> a mensagem é salva com o usuário logado como remetente -> `NewMessage` é transmitida no
canal privado `chat` para o Reverb -> o Reverb envia pelos WebSockets abertos de todas as outras abas -> o `useChat`
junta a mensagem à lista. Quem enviou recebe o mesmo JSON na resposta HTTP, então vê a mensagem na hora e uma única vez.

**Por que Reverb + Echo (decidido no explore).** Polling é simples, mas atrasa e desperdiça requisições, então não é
tempo real de verdade. Server-Sent Events manteriam uma conexão aberta por usuário e o `php artisan serve` atende uma
requisição por vez, então a API travaria (e o Laravel não tem autorização de canal para SSE nativa). Pusher e Ably exigem
conta externa. Um sidecar Node com socket.io traz uma segunda linguagem e um segundo sistema de autenticação. O Reverb é
oficial, roda em casa, fala o protocolo Pusher (então `pusher-js` e Echo funcionam sem adaptação) e autoriza canais
privados com a sessão que já existe. O item 5 (alertas) vai publicar na mesma conexão, e o chat continua funcionando
durante um alerta porque são canais separados.

**Backend**

| Arquivo | O quê e por quê |
|---------|-----------------|
| `database/migrations/..._create_messages_table.php` | `user_id` (chave estrangeira, cascade, indexada) + `body` (texto) + timestamps. O histórico é paginado por `id`, então não precisa de outro índice. |
| `Models/Message.php` | Só `body` está em `#[Fillable]`; o remetente é definido por `$user->messages()->create(...)`, então uma requisição nunca forja o `user_id` (um teste garante). |
| `Http/Requests/StoreMessageRequest.php` | `required|string|max:2000`. O middleware `TrimStrings` do Laravel apara o texto e transforma texto em branco em `null`, então só espaços falha em `required`. |
| `Http/Controllers/MessageController.php` | `index`: paginação por cursor (`id < before`, mais novas primeiro, `limit 51` para saber `has_more` sem consulta de contagem, depois invertida para ordem cronológica). Paginação por página deslocaria e duplicaria linhas enquanto chegam mensagens novas. `store`: salva e depois transmite com `toOthers()` dentro de try/catch, então uma queda do Reverb nunca perde uma mensagem já salva. |
| `Http/Resources/MessageResource.php` | Um só formato para as respostas HTTP **e** para o broadcast. O remetente expõe só id, nome e foto. |
| `Events/NewMessage.php` | `ShouldBroadcastNow` em `PrivateChannel('chat')`, nome `message.created`. "Now" em vez de fila: não precisa de worker de fila, é uma chamada HTTP ao Reverb. Contrapartida: o POST espera essa chamada (aceitável aqui, e falhas são engolidas e reportadas). |
| `routes/channels.php` | `Broadcast::channel('chat', ...)`: qualquer usuário logado pode ouvir. Escrever é protegido pelo gate da rota. |
| `bootstrap/app.php` | `withBroadcasting(..., ['prefix' => 'api', 'middleware' => ['api', 'auth:sanctum']])` expõe `POST /api/broadcasting/auth` sob `/api`, então passa pelo proxy existente e usa o cookie de sessão. |
| `routes/api.php` | `GET /messages` e `POST /messages` com `can:send-messages` + `throttle:30,1` (anti-flood). |
| `docker-compose.yml` | Novo serviço `reverb`: mesma imagem, roda `php artisan reverb:start`. A API ganhou healthcheck e o `reverb` espera por ela, para dois contêineres não rodarem `composer install` juntos num clone novo. |

**Frontend**

| Arquivo | O quê e por quê |
|---------|-----------------|
| `lib/echo.ts` | O único arquivo que conhece WebSockets. Conecta na **origem da própria página** (o Vite repassa `/app` ao Reverb: sem CORS, sem porta extra). A autorização do canal usa um `headersProvider` que lê o cookie `XSRF-TOKEN` a cada tentativa, então um token rotacionado nunca fica velho. Expõe `subscribeToChat({onMessage, onStatus})`. `disconnectEcho()` roda ao sair. |
| `api/client.ts` | Envia `X-Socket-ID` (o Echo só o adiciona sozinho para axios, não para `fetch`), o que permite ao `toOthers()` do servidor pular a aba de quem enviou. |
| `chat/useChat.ts` | Dono do estado: histórico, mensagens ao vivo, envio, carregar antigas, status da conexão. As mensagens são **unidas por id** e ordenadas, então uma que chega ao vivo e pelo histórico (ou duas vezes) aparece uma vez só; isso faz do `toOthers()` uma otimização, não uma necessidade de correção. Depois de reconectar, busca de novo a página mais recente, cobrindo tudo que passou enquanto estava offline. |
| `components/ChatPanel.tsx` | Apresentação: lista (minhas mensagens à direita e coloridas), aviso de offline, campo de envio. Enter envia, Shift+Enter quebra linha, Enter durante composição (IME) não envia. Fica no fim da lista para mensagens novas e mantém a posição quando antigas são inseridas acima. Um envio com erro mostra a mensagem do servidor e **mantém o texto**. O texto é renderizado pelo React como texto, então HTML guardado nunca é executado. |
| `pages/HomePage.tsx` | Mostra o chat (campo desabilitado sem `send-messages`) e o texto branco de 1 px exigido pelo enunciado, como texto real da página (não `display: none`). |

## 6. Testes


* **Backend (99 testes, 337 asserções, PHPUnit contra o banco separado `e3chat_test`):** login com sucesso, falha e
  limite de tentativas, logout e 401, redefinição de senha (destino do link, e-mail desconhecido, limite, token
  expirado, reutilizado ou inválido, senha fraca), gates para os dois papéis, imposição de 401/403/200, atribuição em
  massa, validação de cada campo do perfil, 403 para outro usuário e para administrador, uploads (válido, substituído,
  removido, tipo errado, formato errado, grande demais, pequeno demais, pixels demais, ausente), ordenação e paginação
  do diretório e ausência de campos privados; chat: envio (válido, aparado, exatamente 2000, 2001, vazio/em branco/ausente/array,
  remetente forjado, 403 sem a habilidade, 401), histórico (vazio, ordem, 50 por página, `before`, `has_more`, cursor
  inválido, sem campos privados, sem N+1, 401), broadcast (canal/nome/conteúdo certos, mesmo formato da resposta HTTP,
  nada em caso de falha, broadcaster fora do ar continua 201 e salva) e autorização do canal (membro assinado, visitante
  401, outros canais 403).
* **Frontend (52 testes, Vitest + Testing Library):** cliente da API (CSRF, 204, 422, nova tentativa em 419, handler de
  401, multipart, cabeçalho do socket), guards de rota, páginas de login/esqueci a senha/redefinir, página de perfil, de
  pessoas e inicial (incluindo o texto exato branco de 1 px), opções do Echo (origem própria, CSRF atualizado) e o painel de
  chat com uma camada de tempo real falsa (histórico, mensagem ao vivo, sem duplicar, envio por botão/Enter/Shift+Enter,
  em branco, erro do servidor mantém o texto, sem habilidade, mensagens antigas, aviso offline, recuperação após
  reconexão, tentar de novo, HTML mostrado como texto, cancelar inscrição ao desmontar).
* Para rodar: `docker compose exec backend php artisan test` e `docker compose exec frontend npm test`.

## 7. Trade-offs para mencionar

* Proxy de mesma origem e sessão por cookie pedem implantação com origem única em produção (ou configuração de
  domínios do Sanctum).
* As credenciais de demonstração são públicas de propósito; o seeder é para uso local.
* Sem redimensionamento de imagem nem CDN: fora do escopo do exercício e fácil de acrescentar atrás do endpoint da foto.
* Sem verificação de e-mail nem cadastro: não fazem parte dos itens 1 a 4.
* Os gates por habilidade valem para a aplicação toda de propósito; regras por recurso (perfis) usam uma policy.
* O servidor WebSocket é um processo só (sem escala com Redis) e o chat é uma sala só: adequado ao escopo, e o Reverb
  escala com Redis se um dia for preciso.
* As mensagens são texto simples, nunca editadas nem apagadas e sem moderação: fora do escopo.
* O texto branco de 1 px é exigido pelo enunciado; é invisível e não tem interação.
