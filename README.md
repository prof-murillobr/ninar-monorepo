# Ninar

> Uma aplicação fullstack + IA para ajudar pessoas cuidadoras a observar possíveis necessidades por meio de um áudio curto.

O Ninar recebe alguns segundos de áudio, processa a gravação de forma
assíncrona e retorna hipóteses como fome, sono, desconforto abdominal,
necessidade de arrotar ou desconforto geral, sempre com percentuais de
confiança.

O projeto é experimental: o resultado serve como apoio à observação e não
substitui orientação profissional de saúde.

## O que este projeto demonstra

- construção de um produto completo, do frontend à inferência de ML;
- API organizada com SOLID, casos de uso e Arquitetura Hexagonal;
- upload direto para object storage usando URL pré-assinada;
- processamento assíncrono com fila, worker, retentativas e DLQ;
- isolamento do runtime Python/IA em um serviço FastAPI independente;
- PostgreSQL como fonte de verdade e Redis como otimização descartável;
- ambiente local reproduzível com Docker Compose e LocalStack;
- testes unitários, validação de tipos, lint e teste E2E com Playwright;
- preocupação com privacidade, limites do modelo e comunicação responsável.

## Arquitetura

```text
                           ┌──────────────────────────┐
                           │  FastAPI + PyTorch        │
                           │  classificação do áudio   │
                           └────────────▲─────────────┘
                                        │ HTTP interno
┌──────────────┐  HTTPS  ┌──────────────┴──────────────┐
│ Next.js      ├─────────►│ NestJS API                  │
│ gravação/UI  │          │ casos de uso + adapters     │
└──────┬───────┘          └──────┬──────────┬───────────┘
       │                         │          │
       │ upload pré-assinado     │          │ publicação
       ▼                         ▼          ▼
┌──────────────┐          ┌───────────┐  ┌──────────────┐
│ S3/LocalStack│          │PostgreSQL │  │ SQS/LocalStack│
│ áudio        │          │fonte real │  │ fila + DLQ    │
└──────────────┘          └───────────┘  └──────┬───────┘
                                                 │ consumo
                                          ┌──────▼───────┐
                                          │ Worker        │
                                          │ TS + AWS SDK  │
                                          └───────────────┘

                         Redis: cache de leituras concluídas
```

O caminho local usa LocalStack para emular S3 e SQS sem depender de uma conta
cloud. Os adapters preservam os contratos necessários para trocar a
implementação por serviços gerenciados quando isso fizer sentido.

O diagrama visual está em [`arch-plan.html`](./arch-plan.html), e o plano de
desenvolvimento está em [`plan.md`](./plan.md).

## Decisões técnicas e trade-offs

### Next.js + TypeScript

Entrega a interface React, build otimizado, metadata SEO, experiência mobile e
um caminho simples para evoluir a aplicação para PWA. TypeScript reduz erros no
contrato entre tela, API e resultado da classificação.

### NestJS + Arquitetura Hexagonal

A API separa domínio, casos de uso, portas e adapters. Os casos de uso não
conhecem diretamente PostgreSQL, Redis, S3 ou SQS; isso facilita testes, troca
de infraestrutura e manutenção do código.

### Upload direto para object storage

O áudio não atravessa a API. O frontend solicita uma URL pré-assinada e envia o
arquivo diretamente ao storage. Isso reduz memória, latência e pressão sobre o
processo HTTP da API.

### Fila e worker

A API registra e enfileira rapidamente. O worker consome, baixa o áudio, chama a
inferência, persiste o resultado e só então confirma a mensagem. Esse desenho
absorve picos, permite retentativas e escala o processamento de forma
independente.

SQS/LocalStack foi escolhido para este cenário por oferecer fila, visibilidade,
retentativa e DLQ sem o custo operacional de manter Kafka. Kafka seria uma
alternativa quando throughput muito alto, replay de eventos ou vários grupos de
consumidores fossem requisitos centrais.

### PostgreSQL

É a fonte de verdade das análises, estados e resultados. O histórico continua
consistente mesmo quando o cache é perdido.

### Redis

É um cache rápido e descartável para análises concluídas durante o polling do
frontend. O TTL é curto, a exclusão invalida a chave e nenhuma informação
essencial depende exclusivamente dele. Se o cache falhar, a API pode consultar
o PostgreSQL.

### FastAPI + PyTorch

O runtime de inferência fica isolado das dependências Node/NestJS. Isso permite
trocar o checkpoint, atualizar o modelo ou mover a inferência para outro
serviço sem reescrever a API. A revisão do modelo fica fixada por commit.

### Docker Compose e LocalStack

Compose reduz o tempo entre alteração e feedback e reproduz localmente API,
worker, inferência, PostgreSQL, Redis e storage/fila. LocalStack mantém o
contrato de S3/SQS sem exigir recursos cloud durante o desenvolvimento.

Os manifestos em `infra/k8s` representam uma trilha de evolução para k3s, mas
Kubernetes não é necessário para executar o ambiente local atual.

## Fluxo de uma análise

1. A pessoa grava até 12 segundos de áudio no navegador.
2. O frontend solicita uma URL pré-assinada à API.
3. O áudio é enviado diretamente ao storage.
4. A API cria a análise no PostgreSQL e publica uma mensagem na fila.
5. O worker consome a mensagem e chama o serviço FastAPI.
6. O resultado é persistido e o áudio temporário é removido após o processamento.
7. O frontend consulta o estado até `completed` ou `failed` e atualiza o histórico.

## Qualidade e confiabilidade

- SOLID e portas/adapters na API;
- validação de DTOs, CORS configurável, Helmet e rate limit;
- health checks para API, banco, Redis, LocalStack e inferência;
- logs estruturados e endpoint de métricas;
- retentativas da fila e DLQ;
- testes unitários para casos de uso, adapters e worker;
- teste E2E com Playwright cobrindo upload, CORS, fila, inferência e resultado;
- scripts locais para lint, typecheck, build e testes.

## Rodar localmente

Pré-requisitos: Docker Desktop, Node.js 22+ e pnpm 10.

```bash
cp .env.local.example .env.local
# preencha HF_TOKEN com um token read-only do Hugging Face
pnpm compose:up
```

Serviços principais:

- frontend: `http://localhost:3000`;
- API: `http://localhost:3001`;
- Swagger: `http://localhost:3001/docs`;
- inferência: `http://localhost:8000/health`.

O LocalStack cria automaticamente o bucket, a fila e a DLQ necessárias para o
fluxo local.

## Testes

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

O teste E2E usa Chromium, gera um WAV em memória, valida o preflight CORS,
envia o objeto ao LocalStack, aguarda worker/classificador e confirma o
resultado renderizado no frontend.

## Deploy e segurança

O repositório inclui um workflow de deploy que pode ser adaptado a um runner
self-hosted ou ao provedor escolhido. Configurações
específicas de host, proxy, DNS, secrets e credenciais devem permanecer fora do
código-fonte.

Nunca versione tokens, senhas, chaves, áudios ou arquivos de ambiente
preenchidos. Consulte [`SECURITY.md`](./SECURITY.md) para o processo de
reporte.

## Próximas evoluções

- autenticação e histórico por usuário;
- feedback humano para avaliar a qualidade das hipóteses;
- observabilidade distribuída e métricas de profundidade da fila;
- escala independente do worker conforme CPU, latência e backlog;
- substituição progressiva de emuladores por serviços gerenciados quando houver
  necessidade real de disponibilidade e operação cloud.

## Licença

Código distribuído sob a [licença MIT](./LICENSE). O modelo de terceiros possui
suas próprias condições de uso; consulte o model card do
[`dontcryai/dontcry`](https://huggingface.co/dontcryai/dontcry).
