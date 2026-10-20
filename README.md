# Ninar

Ninar é um laboratório fullstack + IA para observar padrões em um áudio curto de choro de bebê. Ele retorna hipóteses como fome, sono, desconforto abdominal, necessidade de arrotar ou desconforto geral, sempre acompanhadas de confiança; quando a confiança é baixa, isso é sinalizado separadamente. Não é um dispositivo médico e não substitui avaliação profissional.

## Arquitetura em uma frase

O navegador envia o áudio diretamente ao S3 usando uma URL pré-assinada; a API NestJS registra a análise e publica uma tarefa na SQS; um worker TypeScript consome a fila, baixa o objeto, chama o classificador privado FastAPI/PyTorch e persiste o resultado no PostgreSQL. Redis acelera leituras concluídas, sem ser fonte de verdade.

```text
Next.js ── HTTPS ──> NestJS API ──> PostgreSQL
   │                    │  └──────> Redis (cache)
   │                    └─────────> SQS ──> Worker ──> FastAPI/PyTorch
   └── PUT pré-assinado ──────────> S3
```

## Por que cada tecnologia

- **Next.js + TypeScript:** interface React com build otimizado e tipos compartilhados mentalmente com o backend. O browser trata upload, gravação, polling e histórico; não conhece credenciais AWS.
- **NestJS + TypeScript:** módulos, injeção de dependência e pipes deixam explícitos os limites da API. Os casos de uso dependem de portas, não de PostgreSQL/S3/SQS.
- **Arquitetura Hexagonal:** `domain` e `application` não importam SDK. Os adapters em `adapters/` podem ser trocados por mocks, RDS, outro storage ou outra fila sem reescrever a regra.
- **SQS + DLQ:** processamento assíncrono, long polling e retentativas sem manter Kafka na EC2. O worker remove a mensagem somente depois da persistência.
- **PostgreSQL:** fonte definitiva das análises, estados e resultados. Transações e JSONB mantêm o histórico mesmo que o cache seja perdido.
- **Redis:** cache rápido e descartável para análises concluídas durante o polling do frontend. O cache usa TTL curto, é invalidado ao excluir uma análise e nunca substitui o PostgreSQL.
- **S3:** objeto grande fora da API e do banco; URL pré-assinada reduz latência e exposição de credenciais. O bucket tem retenção de sete dias na AWS.
- **FastAPI + PyTorch:** runtime isolado de ML, privado na rede do cluster e fácil de substituir por outro modelo. O checkpoint do Hugging Face é baixado no primeiro start, mas o commit do modelo e do backbone ficam fixados em `HF_MODEL_REVISION`/`HF_BASE_MODEL_REVISION`; produção não acompanha `main`. O `ffmpeg` no container permite decodificar WebM/Opus produzido pelo `MediaRecorder` do navegador, além de WAV e MP3.
- **Docker Compose:** ciclo local repetível com Postgres, Redis e LocalStack (S3/SQS).
- **k3s na EC2:** Kubernetes pequeno para estudar deployments, probes, Ingress, recursos e escala sem o custo operacional do EKS.
- **Terraform:** infraestrutura AWS declarativa: EC2, IAM Role, S3, SQS/DLQ, ECR e Security Group.

## Fluxo de uso

1. `POST /analyses/upload-url` retorna `analysisId`, `objectKey` e URL pré-assinada.
2. O frontend faz `PUT` do áudio diretamente para a URL.
3. `POST /analyses` grava o registro e publica `{ analysisId, objectKey }`.
4. O worker faz long polling, marca `processing`, busca S3 e chama `POST /classify`.
5. O resultado é salvo como JSONB; depois da persistência, o worker remove o áudio temporário do S3 e a mensagem da fila.
6. O frontend consulta `GET /analyses/:id` até `completed` ou `failed`.

Se a classificação falhar, o áudio é mantido temporariamente para a retentativa
da mensagem. Depois de exceder as retentativas da SQS, a mensagem vai para a
DLQ e o objeto deve ser revisado conforme a política de retenção do ambiente.

Endpoints auxiliares: `GET /analyses`, `DELETE /analyses/:id`, `GET /health`, `GET /metrics` e documentação `GET /docs`.

## Rodar localmente

Pré-requisitos: Docker Desktop, Node.js 22+ e pnpm 10. O `.env.local` é local,
ignorado pelo Git e contém as configurações do ambiente de desenvolvimento;
nunca commite um token.

```bash
cp .env.local.example .env.local
# preencha HF_TOKEN com um token read-only do Hugging Face
pnpm compose:up
```

URLs: web `http://localhost:3000`, API `http://localhost:3001`, Swagger `http://localhost:3001/docs`, inferência `http://localhost:8000/health`.

O `LocalStack` cria `ninar-audio`, `analyses` e `analyses-dlq`. A fase 6 funciona localmente: o mesmo worker usa `WORKER_CONCURRENCY=1`, long polling, logs estruturados, probes e `/metrics`; em k3s local você pode aplicar os manifests e aumentar réplicas somente após medir CPU/memória.

### SEO e experiência instalável

O frontend publica uma base de SEO técnico pelo App Router do Next.js:

- metadata em português, URL canônica, keywords, Open Graph e Twitter Cards;
- imagem social em [`apps/web/public/og-image.png`](./apps/web/public/og-image.png);
- favicon e ícone de instalação derivados do logo em [`apps/web/src/app/icon.svg`](./apps/web/src/app/icon.svg);
- dados estruturados JSON-LD descrevendo o Ninar como uma aplicação web gratuita;
- `robots.txt`, `sitemap.xml` e `manifest.webmanifest` gerados pelo Next.js.

Em produção, a URL canônica é `https://ninar-app.com`. Depois de publicar, valide
`/robots.txt`, `/sitemap.xml` e `/manifest.webmanifest` no domínio público e
cadastre o sitemap no Google Search Console ou ferramenta equivalente. O conteúdo
do Ninar apresenta hipóteses experimentais e deve manter essa comunicação clara,
sem prometer diagnóstico ou substituir orientação profissional de saúde.

### Teste ponta a ponta

Com os serviços locais em execução, o teste Playwright abre o frontend em Chromium, seleciona um WAV gerado em memória, valida o preflight CORS, envia o objeto ao S3/LocalStack, aguarda o worker/classificador e confirma o resultado renderizado:

```bash
pnpm test:e2e
```

O bootstrap do LocalStack aplica automaticamente a regra CORS necessária ao bucket `ninar-audio`. Isso evita o `Failed to fetch` do navegador durante o `PUT` pré-assinado.

## Deploy automatizado

O repositório inclui um workflow de deploy para ambientes com Docker Compose e
um workflow de CI para validação. A automação pode ser conectada a um runner
self-hosted ou ao provedor de hospedagem escolhido, mantendo as credenciais e
configurações específicas fora do código-fonte.

O ambiente de execução deve fornecer Docker, Compose e um arquivo de ambiente
preenchido a partir do template correspondente. Nunca coloque tokens, senhas,
chaves ou arquivos de ambiente preenchidos no GitHub; use os secrets e as
variáveis protegidas da plataforma de CI/CD.

## Código aberto, modelo e segurança

O código deste repositório é distribuído sob a [licença MIT](./LICENSE). Isso
não altera as licenças dos frameworks, dependências, imagens Docker ou do
modelo de terceiros. O classificador usa o checkpoint
[`dontcryai/dontcry`](https://huggingface.co/dontcryai/dontcry); consulte o model
card e aceite as condições de acesso do Hugging Face antes de usá-lo. Não
versione checkpoints, tokens, áudios ou qualquer arquivo de ambiente preenchido.

Antes do primeiro push público, valide o conteúdo que será versionado:

```bash
git add --dry-run .
git status --short
```

O `.gitignore` exclui ambientes locais, dependências, builds, estado do
Terraform, chaves e relatórios de teste. Se um segredo já tiver sido commitado,
removê-lo do arquivo não basta: revogue/rotacione a credencial e trate o
histórico do repositório antes de torná-lo público. Consulte também
[`SECURITY.md`](./SECURITY.md).

## Qualidade e segurança

- `pnpm typecheck`, `pnpm build` e testes unitários rodam no CI.
- Helmet, CORS configurável, rate limit de 60 requisições/minuto, validação de DTOs e limite de upload no frontend.
- S3 privado, criptografia, CORS mínimo e lifecycle de expiração.
- NetworkPolicy impede tráfego arbitrário para o classificador; somente pods `worker` podem acessá-lo.
- O resultado é apresentado como hipótese com confiança; `confidence_low` sinaliza quando o modelo ficou abaixo do limiar sem transformar a incerteza em uma categoria duplicada.

## Próximos passos profissionais

Autenticação por usuário, migrations com ferramenta dedicada, RDS Multi-AZ, ElastiCache, tracing distribuído, métricas de profundidade da SQS, autoscaling por fila e testes E2E no pipeline.

O guia [technology-architecture.html](./technology-architecture.html) explica as decisões, trade-offs e quando aplicar cada componente. Ele é material de estudo local e está no `.gitignore`.
