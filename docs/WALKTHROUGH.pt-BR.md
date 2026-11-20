# Explicação do código (itens 1 a 8)

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
  `user-roles`, `user-profiles`, `user-directory`, `chat-messages`, `chat-realtime`, `chat-page`, `alert-lifecycle`, `alert-locations`, `alert-realtime`, `alert-page`) e o histórico em `openspec/changes/archive/`.

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
privados com a sessão que já existe. O item 5 (alertas) publica na mesma conexão, e o chat continua funcionando
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

## 6. Item 5: alertas e localização

**Fluxo.** O administrador clica em *Start alert*: `POST /api/alerts` -> gate `can:start-alerts` -> uma linha é inserida em
`alerts` -> `AlertChanged` é transmitido no canal privado `alerts` -> toda sessão aberta recebe o alerta completo e o
`AlertModal` abre sozinho. Cada pessoa clica num quadrado: `POST /api/alerts/{alert}/responses` -> `can:submit-locations`
-> a linha do alerta é travada, confere-se "ainda ativo", a resposta é salva e o `revision` sobe -> `AlertChanged` de novo
-> todas as sessões redesenham o painel com o nome dentro do quadrado. *End alert* (`POST /api/alerts/{alert}/end`, gate
`can:end-alerts`) faz o mesmo caminho e fecha as escolhas. O chat é outro canal e não é tocado.

**A ideia central: snapshots, não deltas.** Cada evento e cada resposta HTTP é o alerta *inteiro* (status, revisão, quem
está em qual quadrado). O cliente só precisa responder "qual snapshot é o mais novo?" (`applySnapshot`: vence o maior id de
alerta e, no mesmo alerta, o maior `revision`). Assim uma mensagem duplicada, atrasada ou fora de ordem é inofensiva, e
recuperar-se de uma conexão perdida é só chamar `GET /api/alerts/current`. Deltas ("Bob escolheu B") exigiriam ordenação e
detecção de lacunas, e a reconexão precisaria de um refetch de qualquer jeito.

**As regras ficam no banco.** Checagens em PHP não bastam quando duas requisições disputam, então:

| Regra | Onde é garantida |
|-------|------------------|
| Um único alerta ativo | Índice único parcial `CREATE UNIQUE INDEX alerts_single_active ON alerts ((true)) WHERE ended_at IS NULL`: toda linha ativa tem a mesma chave constante, então a segunda é recusada. Numa disputa, uma recebe 201 e a outra 409. |
| Uma resposta por usuário por alerta | `UNIQUE (alert_id, user_id)`. O controller transforma a violação em 409 ("a primeira escolha é definitiva"). |
| Só quadrados a a d | `CHECK (square IN ('a','b','c','d'))` mais o enum `Square` para validação. |
| Nenhuma escolha depois do fim | `SELECT ... FOR UPDATE` na linha do alerta dentro de uma transação, tanto em "escolher" quanto em "encerrar": a escolha ou entra antes do fim ou espera, vê `ended_at` preenchido e recebe 409. |
| Alerta novo começa vazio | As respostas pertencem a um `alert_id`; um alerta novo é uma linha nova sem respostas. |

"Ativo" é apenas `ended_at IS NULL`; uma coluna `status` separada poderia discordar do timestamp, então não existe.

**Permissões (no servidor, inclusive em requisições diretas).** Cada rota declara sua ability por middleware `can:`, então
quem não tem recebe 403 antes de qualquer código do controller: iniciar `start-alerts`, encerrar `end-alerts`, escolher
`submit-locations` e ler (`GET /alerts/current` e o canal) `receive-alerts` **e** `view-locations`, porque o payload diz
quem está onde e um broadcast não pode ser filtrado por usuário. Os testes chamam os endpoints diretamente como usuário
comum e como visitante.

**Backend**

| Arquivo | O quê e por quê |
|---------|-----------------|
| `database/migrations/..._create_alerts_table.php` | `alerts` (`started_by`, `ended_by` com `nullOnDelete` para o histórico sobreviver à exclusão de um admin, `ended_at`, `revision`) e `alert_responses` (FKs com cascade, par único, CHECK). |
| `Enums/Square.php` | As quatro chaves. Os rótulos ("Square A") pertencem à interface. |
| `Models/Alert.php`, `Models/AlertResponse.php` | `Alert` não tem nada em mass assignment (o servidor define quem/quando). `AlertResponse` só permite `square`; pessoa e alerta vêm da sessão e da rota, então o corpo não consegue forjá-los. |
| `Http/Controllers/AlertController.php` | `current` (último alerta, ativo ou encerrado, ou `data: null`), `store` (captura a violação de unicidade -> 409), `end` (travado, 409 se já encerrado). |
| `Http/Controllers/AlertResponseController.php` | Trava o alerta, rejeita alerta encerrado (409), salva a escolha, incrementa `revision` e converte a violação de unicidade em 409. |
| `Http/Requests/StoreAlertResponseRequest.php` | `square` obrigatório e um dos valores do enum. |
| `Http/Resources/AlertResource.php` | O único formato de snapshot para HTTP e broadcast. As pessoas expõem só id, nome e foto. |
| `Events/AlertChanged.php` | `ShouldBroadcastNow` em `private-alerts`, nome `alert.changed`. `announce()` envolve o broadcast em try/catch: a mudança já foi salva, então uma queda do Reverb é registrada, não vira falha da requisição. Sem `toOthers()`: os snapshots são idempotentes, então quem enviou pode ser atualizado pelo mesmo evento dos outros. |
| `routes/channels.php` | Canal `alerts`: exige `receive-alerts` e `view-locations`. |

**Frontend**

| Arquivo | O quê e por quê |
|---------|-----------------|
| `api/alerts.ts` | Tipos, os quatro quadrados com rótulos e as quatro chamadas. |
| `alerts/applySnapshot.ts` | A regra pura "o mais novo vence" (testada isoladamente). |
| `alerts/useAlert.ts` | Dono do estado: carrega `/current`, assina o canal, aplica snapshots, rebusca depois de reconectar (é assim que um alerta encerrado enquanto estava offline aparece) e expõe `start`, `end`, `pick`. Uma primeira carga que devolve `null` nunca apaga um alerta que um evento ao vivo já entregou. |
| `lib/echo.ts` | Novo `subscribeToAlerts`; o código de status da conexão foi extraído para chat e alertas compartilharem. |
| `components/AlertModal.tsx` | `Dialog` do MUI sem `onClose`, então Esc e clique fora não fazem nada: a pessoa precisa escolher. Abre só para alerta *ativo* quando o usuário pode enviar e ainda não escolheu; assim, recarregar antes de escolher abre de novo, e depois de escolher fica fechado. Um erro do servidor aparece e o modal continua aberto. |
| `components/AlertBoard.tsx` | A grade 2x2 com o rótulo de cada quadrado e os nomes dentro (vários por quadrado), mais o aviso "ativo / encerrado". |
| `components/AlertSection.tsx` | Junta hook + painel + modal + os botões Start/End do administrador (só com `start-alerts` / `end-alerts`). O hook mora aqui, não no modal, para a assinatura continuar aberta com o modal fechado. |
| `pages/HomePage.tsx` | Renderiza `AlertSection` acima do chat, então o chat segue utilizável durante um alerta. |

**Teste manual com duas sessões** (stack rodando, dados demo carregados):

1. Abra <http://localhost:5173> numa janela normal e entre como `admin@example.com` / `password`. Abra uma janela anônima
   (cookies separados) e entre como `user@example.com` / `password`.
2. Na janela do administrador clique em **Start alert**. As duas janelas abrem o modal com Square A a D sozinhas.
3. Na janela do usuário clique em **Square B**: o modal fecha e "Demo User (you)" aparece no Square B. Na janela do
   administrador o nome "Demo User" aparece no Square B sem recarregar.
4. Na janela do administrador clique em **Square B** também: os dois nomes ficam no Square B nas duas janelas (quadrados
   podem ser compartilhados).
5. Envie uma mensagem de chat de cada janela com o alerta ativo: o chat continua funcionando.
6. Recarregue a janela do usuário: não abre modal (já escolheu) e o painel ainda mostra os dois nomes.
7. Requisições diretas: com o alerta ativo não há botão Start. No console do navegador de uma janela logada (ela leva o
   cookie de sessão; o token CSRF é lido do cookie) rode o trecho abaixo. Na janela do usuário responde **403** (sem
   `start-alerts`); na janela do administrador responde **409** (já existe um alerta ativo).
   ```js
   const t = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
   fetch('/api/alerts', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': t } }).then((r) => r.status)
   ```
8. Clique em **End alert**: as duas janelas mostram "This alert has ended" e novas escolhas são recusadas
   (`POST .../responses` responde 409).
9. Reconexão: clique em **Start alert** para um novo alerta, pare o Reverb (`docker compose stop reverb`) e encerre o
   alerta na janela do administrador (funciona, é HTTP puro, e respondeu em cerca de 0,1 s mesmo com o Reverb fora do ar). A
   janela do usuário ainda o mostra como ativo. Suba o Reverb de novo (`docker compose start reverb`): a janela do usuário
   reconecta e mostra o alerta encerrado sozinha em um ou dois segundos (medido com um roteiro de dois navegadores).
10. Clique em **Start alert** de novo: o painel está vazio e todos podem escolher outra vez.

## 7. Item 6: encerramento e recuperação

**O que o enunciado pede.** O administrador encerra o alerta, as duas sessões atualizam, novos envios são recusados, e
atualizar, reabrir ou reconectar restaura o estado verdadeiro, inclusive um alerta encerrado enquanto a sessão estava
desconectada. Um alerta novo começa sem respostas.

**Quase tudo já existia depois do item 5, de propósito.** Encerrar, o 409 para escolhas tardias e o snapshot do "último
alerta, ativo ou encerrado" vieram com a mudança de alertas, porque o modelo de snapshots faz a recuperação ser um único
`GET /api/alerts/current`. Então o item 6 começou como uma auditoria (mudança OpenSpec `harden-alert-closure`) que achou
três lacunas reais, em vez de reimplementar o que já funciona.

| Lacuna encontrada | Correção e motivo |
|-------------------|-------------------|
| Um cliente com estado velho (socket caiu, perdeu o encerramento) que tentava escolher recebia 409, mostrava o erro e o modal continuava aberto. | O `useAlert` agora trata **409 em pick, end ou start** como "o servidor seguiu sem mim": busca `/alerts/current` de novo, aplica, e ainda relança o erro para a mensagem aparecer. O modal fecha porque o alerta está `ended`. 409 é o gatilho certo porque é exatamente o status que o servidor usa para "conflito de estado". |
| O catch-up só rodava depois de reconectar o WebSocket. Um notebook que dormiu ou uma aba de celular em segundo plano pode manter um socket que parece conectado mas perdeu eventos. | A mesma `resync()` também roda em `visibilitychange` (só quando a aba fica visível) e no evento `online` do navegador. Uma função, quatro gatilhos (reconexão, 409, visível, online), listeners removidos ao desmontar, e uma falha no resync mantém o que está na tela. Sem polling por timer. |
| Nada provava o ciclo de vida inteiro de ponta a ponta. | `AlertLifecycleJourneyTest`: inicia, escolhe, encerra, um usuário "atrasado" restaura o alerta encerrado com as respostas, a escolha tardia é recusada e não grava nada, o próximo alerta começa com zero respostas e o antigo fica intacto. `AlertResourceTest` garante que o snapshot encerrado mantém respostas e horário de término. |

**Por que a ordem dos eventos é segura.** Escolher e encerrar travam a linha do alerta (`SELECT ... FOR UPDATE`, item 5): a
escolha ou confirma antes do encerramento ou espera, vê `ended_at` e recebe 409. Como toda mensagem é um snapshot completo
protegido por `revision`, uma resposta de resync concorrendo com um evento ao vivo nunca faz a tela voltar no tempo
(`applySnapshot`).

**Sem endpoint novo, sem migration, sem PHP de produção.** O servidor já estava correto; o risco estava no cliente e na
falta de testes. Essa é a mudança honesta e mínima.

**Teste manual (duas sessões, administrador e usuário).**

1. Inicie um alerta, deixe o usuário escolher, encerre na janela do administrador: as duas janelas mostram "This alert has ended".
2. Modal velho: inicie um novo alerta, pare o Reverb (`docker compose stop reverb`), encerre o alerta como administrador. Na
   janela do usuário (ainda com o modal) clique em um quadrado: o servidor responde 409 e o modal fecha sozinho, mostrando o
   painel encerrado. Suba o Reverb de novo.
3. Encerramento perdido com a aba oculta: inicie outro alerta, oculte a aba do usuário, encerre o alerta, volte à aba: ela
   mostra o estado encerrado sem recarregar.
4. Recarregue qualquer janela depois do encerramento: o alerta encerrado e os nomes continuam lá. Clique em **Start alert**: o painel está vazio.

## 8. Testes


* **Backend (162 testes, 563 asserções, PHPUnit contra o banco separado `e3chat_test`):** login com sucesso, falha e
  limite de tentativas, logout e 401, redefinição de senha (destino do link, e-mail desconhecido, limite, token
  expirado, reutilizado ou inválido, senha fraca), gates para os dois papéis, imposição de 401/403/200, atribuição em
  massa, validação de cada campo do perfil, 403 para outro usuário e para administrador, uploads (válido, substituído,
  removido, tipo errado, formato errado, grande demais, pequeno demais, pixels demais, ausente), ordenação e paginação
  do diretório e ausência de campos privados; chat: envio (válido, aparado, exatamente 2000, 2001, vazio/em branco/ausente/array,
  remetente forjado, 403 sem a habilidade, 401), histórico (vazio, ordem, 50 por página, `before`, `has_more`, cursor
  inválido, sem campos privados, sem N+1, 401), broadcast (canal/nome/conteúdo certos, mesmo formato da resposta HTTP,
  nada em caso de falha, broadcaster fora do ar continua 201 e salva) e autorização do canal (membro assinado, visitante
  401, outros canais 403); alertas: iniciar (administrador 201 e vazio, usuário comum 403 e nada criado, visitante 401, segundo alerta ativo 409, alerta novo depois do fim começa vazio), atual (nenhum, ativo com respostas, encerrado enquanto offline, só o último, sem campos privados, 401), escolher (válido, administrador também, quadrado compartilhado, segunda escolha 409 e a primeira mantida, de novo em outro alerta, quadrado inválido/ausente/maiúsculo/array 422, alerta encerrado 409, alerta inexistente 404, pessoa forjada ignorada, 403 sem a habilidade, 401), encerrar (respostas mantidas, duas vezes 409, 403 para usuário, 401, 404, escolha depois do fim recusada), constraints do banco acionadas com inserts diretos (segundo alerta ativo, resposta duplicada, quadrado fora de a a d, cascatas, mass assignment), broadcast (canal/nome/snapshot, revisão, nada em requisição rejeitada, broadcaster fora do ar continua funcionando) e o canal `alerts` (usuário permitido, sem habilidade 403, visitante 401). Duas requisições realmente simultâneas são cobertas pelas constraints do banco, não por um teste concorrente.
* **Frontend (118 testes, Vitest + Testing Library):** cliente da API (CSRF, 204, 422, nova tentativa em 419, handler de
  401, multipart, cabeçalho do socket), guards de rota, páginas de login/esqueci a senha/redefinir, página de perfil, de
  pessoas e inicial (incluindo o texto exato branco de 1 px), opções do Echo (origem própria, CSRF atualizado) e o painel de
  chat com uma camada de tempo real falsa (histórico, mensagem ao vivo, sem duplicar, envio por botão/Enter/Shift+Enter,
  em branco, erro do servidor mantém o texto, sem habilidade, mensagens antigas, aviso offline, recuperação após
  reconexão, tentar de novo, HTML mostrado como texto, cancelar inscrição ao desmontar); alertas: `applySnapshot` (id mais novo, revisão maior, antigo ignorado, idempotente), `useAlert` com Echo falso (resync em 409 de pick e end, em aba visível e em online, silencioso em falha, listeners removidos; início ao vivo, antigo ignorado, primeira carga vazia não apaga alerta ao vivo, recuperação de alerta encerrado offline, ações, erros, tentar de novo), `AlertModal` (quatro quadrados rotulados, escolha, não fecha com Esc, erro do servidor mantém aberto, fechado depois de escolher / encerrado / sem habilidade), `AlertBoard` (nomes nos quadrados, quadrados compartilhados, aviso de encerrado) e `AlertSection` (modal abre ao vivo, nome aparece depois de escolher, recarregar restaura, encerrar fecha o modal, controles por papel, nada para quem não pode receber alertas).
* **Item 7 (última passada desta seção): auditoria e depois cobrir lacunas reais.** Mapeei cada regra de rota, validação, enum, seeder, canal e módulo do frontend para um teste com nome, em vez de perseguir percentual de cobertura (não há driver de cobertura instalado, e um número não diz *qual comportamento* está provado). A auditoria achou estes buracos, agora fechados:
  * `SeederTest`: o seeder cria um administrador e um usuário comum, é idempotente, repara papel e senha de uma conta existente, e as duas contas entram pelo endpoint real com a senha documentada (o enunciado pede "pelo menos duas contas").
  * Limite de `POST /messages`: o 31º envio em um minuto é 429 e não grava nada (prova a ligação do `throttle:30,1` na rota real, sem mock).
  * `GET /alerts/current` devolve 403 quando falta `receive-alerts` ou `view-locations` (o gate é sobrescrito por teste porque os dois papéis têm as duas habilidades).
  * Testes unitários sem HTTP: `Square`, `UserRole::can` (usuário nunca recebe iniciar/encerrar, administrador é superconjunto) e `Alert::isActive` coerente com o escopo `active`.
  * Frontend: `AuthProvider` (carregando, autenticado, visitante, login ok/recusado, logout fecha o WebSocket, um 401 posterior derruba o usuário, handler removido ao desmontar), `AppLayout`, `UserAvatar`, `errors.ts` e as falhas do esqueci-a-senha (422 no campo, erro genérico de rede).
* **Um comando:** `./scripts/test.sh` (a stack precisa estar no ar) roda testes do backend, testes do frontend, lint e type-check/build. Todos os estágios rodam mesmo se um falhar, o resumo mostra PASS/FAIL por estágio e o código de saída é diferente de zero em qualquer falha. Ele só chama `php artisan test`, nunca `migrate:fresh`, então não consegue apagar o banco de desenvolvimento (o ambiente de teste é o banco separado `e3chat_test` do `phpunit.xml`).
* **Decisões para defender:** auditoria por comportamento em vez de número de cobertura; middleware real no teste de limite; sobrescrever o gate em vez de inventar um terceiro papel; um login por teste (o Laravel guarda o guard em cache, então um segundo login no mesmo teste cai em outra classe de guard: use um login por teste ou um data provider); sem testes end-to-end de navegador porque a demonstração ao vivo cobre isso; sem CI nesta mudança.
* **Item 8 como código: testes end-to-end (`e2e/`, Playwright).** Testes unitários e de feature provam cada peça; estes provam que as peças funcionam juntas em navegadores de verdade, que é exatamente o que a demonstração ao vivo mostra. Cada arquivo abre um administrador e um usuário em **contextos de navegador separados** (cookies e WebSocket próprios), ou seja, são duas sessões independentes, não uma sessão fingindo ser duas.
  * `journey.spec.ts`: chat nos dois sentidos sem atualizar; só o administrador vê Start/End; iniciar um alerta abre o modal de localização ao vivo para todos que podem enviar localização (o administrador também, porque o enunciado dá a ele todas as habilidades); cada escolha aparece no quadrado certo nos dois quadros; encerrar fecha as localizações; um novo alerta começa vazio.
  * `permissions.spec.ts`: um usuário comum recebe 403 ao iniciar ou encerrar alerta e ao editar o perfil de outra pessoa chamando a API direto, e o estado do alerta não muda; um visitante recebe 401 e é redirecionado para o login.
  * `recovery.spec.ts`: recarregar antes de escolher restaura o modal; recarregar depois de escolher mantém a escolha e não reabre o modal; um alerta encerrado enquanto o navegador do usuário estava offline aparece como encerrado quando ele volta; mensagens enviadas durante o offline são buscadas ao reconectar.
  * `password.spec.ts`: pede o link, lê o e-mail real no Mailpit, define a nova senha, o link só funciona uma vez, a senha antiga é recusada, a nova funciona e a senha é restaurada.
  * Decisões: um worker só (uma sala, um "alerta atual", testes são jornadas ordenadas); roda no host porque os containers não têm navegador; seletores por papel e rótulo, então renomear algo na interface quebra as duas suítes; chamadas diretas à API enviam o cabeçalho `Origin`, porque o Sanctum só trata a requisição como de sessão quando ela vem da origem do frontend (sem isso aparece um 401 enganoso). Sem banco E2E separado: os testes são seguros com os dados (mensagens únicas com marcação, qualquer alerta ativo é encerrado antes e de novo no fim, a senha alterada é restaurada em um `finally`, nenhum comando de migração) e são opcionais via `./scripts/test.sh --e2e`.
  * Pegadinhas que apareceram: o administrador também recebe o modal de localização, que esconde o resto da página da árvore de acessibilidade, então o próximo clique tem de ser a escolha; os rótulos do MUI incluem o asterisco de obrigatório, então `getByLabel('New password', {exact: true})` nunca casa; e `locator.isVisible()` ignora o timeout.
* Para rodar: `./scripts/test.sh` (tudo; adicione `--e2e` para os testes de navegador), ou `docker compose exec backend php artisan test` e `docker compose exec frontend npm test` separadamente.

* **Item 8 como roteiro e runner guiado (`docs/DEMO.md`, `e2e/demo/demo.ts`, `./scripts/demo.sh`).** O enunciado pede uma demonstração ao vivo de sete cenários com duas sessões independentes. São dois artefatos, porque a call ao vivo precisa de coisas diferentes de um teste: um **roteiro** para seguir (o que cada janela faz, o que falar, perguntas prováveis) e um **runner** que executa a mesma jornada em ritmo humano.
  * O runner é um script Playwright como *biblioteca*, não um teste: sem timeouts nem reporter, e as legendas e pausas fazem parte do objetivo. Ele reutiliza `e2e/support/helpers.ts`, então demo e testes compartilham o mesmo jeito de logar, chamar a API e ler o Mailpit.
  * Duas **instâncias separadas do Chromium**, lado a lado (modo visível), cada uma com seu contexto: cookies e WebSockets independentes. `--record` salva um `.webm` por sessão (`e2e/recordings/`, ignorado pelo git): plano B se a execução ao vivo falhar.
  * Uma **legenda** na tela (overlay injetado, reaplicado após navegações com `addInitScript` + `sessionStorage`) nomeia cada cenário, para a plateia e a gravação acompanharem, sem mexer no código da aplicação.
  * A ordem importa: chat, permissões (UI e um 403 direto), entrega do alerta, atualização de localização, recuperação por refresh e offline, encerramento, e recuperação de senha **por último**, porque o e-mail de reset é limitado a um por minuto e o passo desloga a janela do usuário.
  * Segurança de dados em um ambiente de dev compartilhado: começa encerrando qualquer alerta ativo, encerra o que inicia, marca as mensagens do chat, nunca roda comandos de migrate e restaura a senha alterada (inclusive após uma execução com falha) a partir de um navegador headless separado.
  * Rodei duas vezes seguidas durante o desenvolvimento para provar que é repetível. Rode do host (variáveis `DEMO_SLOW`, `DEMO_HEADLESS`, `DEMO_RECORD` por trás das flags `--slow`, `--headless`, `--record`).
## 9. Trade-offs para mencionar

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
* Alertas: a primeira escolha é definitiva (o enunciado diz uma resposta por usuário por alerta); trocar a escolha seria um upsert, mas é outra regra.
* Ler o estado do alerta exige `receive-alerts` e `view-locations` porque um único payload de broadcast vai para todos e diz quem está onde.
* O índice `alerts_single_active` é um índice parcial por expressão específico do Postgres; o projeto só usa Postgres, e o banco é o único lugar que não sofre corrida.
* Um alerta encerrado fica no painel como "encerrado" até um novo começar; esconder alertas antigos é refinamento de interface, não problema de dados.
* O resync roda por eventos (reconexão, 409, aba visível, online), não por timer: sem polling constante, e a proteção por `revision` torna qualquer busca extra inofensiva.
