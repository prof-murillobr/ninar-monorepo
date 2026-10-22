# Ninar — Plano de desenvolvimento

## Objetivo

Criar uma aplicação pessoal e demonstrável em portfólio que recebe um pequeno áudio de choro de bebê, processa-o de forma assíncrona e apresenta hipóteses como fome, sono, desconforto abdominal, necessidade de arrotar ou desconforto geral, sempre com indicação de confiança. O sistema é uma ferramenta de observação, nunca um diagnóstico médico.

## Princípios de produto

- Mostrar hipótese e confiança, e não certeza clínica.
- Tratar baixa confiança como um sinal separado quando não houver confiança suficiente.
- Manter áudios privados, com retenção curta e exclusão pelo usuário.
- Não enviar áudio a APIs externas de IA: o modelo será servido localmente na EC2.
- Separar o fornecedor/modelo por uma interface, permitindo substituição futura.

## Arquitetura-alvo

Uma instância EC2 executa k3s e hospeda os serviços containerizados. Serviços de estado, objetos e mensageria permanecem gerenciados na AWS quando agregam confiabilidade ou simplificam a operação.

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Interface | Next.js, TypeScript, Tailwind | Upload/gravação, status e histórico |
| API | NestJS, OpenAPI/Swagger | Autorização, URLs pré-assinadas, histórico e contratos |
| Assíncrono | Worker TypeScript + AWS SDK para SQS | Consome tarefas, processa e controla retentativas |
| Inferência | FastAPI, PyTorch, Transformers | Classifica o áudio com modelo Hugging Face local |
| Dados | PostgreSQL local; RDS como evolução | Usuários, análises, eventos e resultados |
| Cache | Redis local; ElastiCache como evolução | Cache, rate limit e resultados recentes |
| Objetos | S3 | Áudios privados e expiração automática |
| Eventos | SQS + DLQ | Desacoplamento e tolerância a falhas |
| Runtime | EC2 + k3s + Traefik Ingress | Orquestração local e exposição HTTP/HTTPS |
| Infra | Terraform + manifests k3s/Kustomize | Infraestrutura e deployments reprodutíveis |

## Estratégia de ambientes: local primeiro

O desenvolvimento e a validação inicial acontecem **inteiramente na máquina local**. A AWS só entra depois que o fluxo ponta a ponta estiver aprovado.

| Ambiente | Runtime | Serviços locais/emulados | Objetivo |
| --- | --- | --- | --- |
| Desenvolvimento | Docker Compose | PostgreSQL, Redis e Floci (S3/SQS/DLQ) | Construir e depurar com custo zero |
| Validação Kubernetes | k3s local | Os mesmos serviços locais/emulados | Validar manifests, Ingress e rede entre pods |
| Nuvem | k3s em EC2 | S3 e SQS/DLQ reais; banco/cache locais no MVP | Publicar o fluxo já validado |

O código usa o AWS SDK. No ambiente Docker atual, `AWS_ENDPOINT_URL` aponta para o Floci e credenciais de teste são usadas; os adapters mantêm a infraestrutura substituível.

## Estado da implementação local

- **Fase 1 concluída:** monorepo com Next.js, NestJS, worker NestJS, FastAPI, Dockerfiles e Compose; PostgreSQL, Redis e Floci sobem juntos, com bucket S3, filas SQS e notificação S3 → SQS criados automaticamente.
- **Fase 2 concluída:** o serviço FastAPI carrega localmente o checkpoint `dontcryai/dontcry` (HuBERT + cabeça customizada), expõe `/health` e `/classify`, normaliza áudio para mono/16 kHz e retorna probabilidades.
- **Fase 3 concluída:** endpoints de análise, upload pré-assinado, persistência e integração real worker → S3 → classificador → resultado. A API segue portas/adapters hexagonais e o worker é idempotente para mensagens redeliveradas.
- **Fase 4 concluída:** frontend com upload, gravação via MediaRecorder, waveform, polling, resultado com confiança, histórico e exclusão.
- **Fase 5 preparada:** Terraform para EC2/IAM/ECR/S3/SQS/DLQ, user-data para k3s, manifests Kustomize e `.env.hml.example`/`.env.hml` local.
- **Fase 6 concluída no MVP:** concorrência configurável do worker, long polling, logs estruturados, probes, limites de recursos e endpoint Prometheus `/metrics`; funciona em Compose e k3s local.
- **Fase 7 inicial concluída:** Helmet, CORS configurável, throttling, NetworkPolicy, bucket privado/lifecycle/CORS, Swagger, testes unitários e GitHub Actions.

## Fases

### Fase 0 — Decisões e contratos

1. Definir categorias internas do modelo: `hungry`, `tired`, `belly_pain`, `burping`, `discomfort`.
2. Definir o limiar inicial de confiança, por exemplo 70%, abaixo do qual a API sinaliza `confidence_low=true`, sem criar uma categoria artificial.
3. Criar o contrato OpenAPI para upload, consulta de análise e histórico.
4. Definir política de retenção de áudio — sugestão inicial: 7 dias, configurável.
5. Escrever aviso de limitações e privacidade para a interface.

**Pronto quando:** existe um `openapi.yaml` aprovado e a UX deixa claro que o resultado não é diagnóstico.

### Fase 1 — Fundação local

1. Criar o monorepo com `apps/web`, `apps/api`, `apps/worker`, `apps/inference`, `packages/contracts` e `infra`.
2. Configurar TypeScript, lint, formatação, variáveis de ambiente e README.
3. Criar Dockerfiles para web, API, worker e inferência.
4. Criar Docker Compose com PostgreSQL, Redis e Floci (S3/SQS) para desenvolvimento.
5. Espelhar os serviços no k3s local antes de publicar na EC2.
6. Criar filas `analyses` e `analyses-dlq`, o bucket `ninar-audio` e a notificação S3 → SQS automaticamente ao iniciar o Floci.
7. Manter arquivos `.env.local.example` e `.env.production.example`; o adapter AWS deve variar apenas por configuração, nunca por regra de negócio.

**Pronto quando:** um único comando sobe todos os serviços locais, cria S3/SQS simulados e os health checks respondem.

### Fase 2 — Prova de conceito do modelo

1. Solicitar acesso ao modelo `dontcryai/dontcry` no Hugging Face e registrar a revisão usada.
2. Construir o serviço FastAPI com endpoint interno `POST /classify`.
3. Validar tipo, duração, canal e taxa do áudio; normalizar para WAV mono a 16 kHz.
4. Carregar o modelo localmente no container e retornar rótulos/probabilidades normalizados.
5. Criar testes com arquivo válido, áudio curto, arquivo inválido, ruído e áudio sem choro.

**Pronto quando:** o container classifica um WAV sem acesso de runtime ao Hugging Face e responde com o contrato definido.

### Fase 3 — API e processamento assíncrono

1. Criar `POST /analyses/upload-url`: registra o upload como `upload_pending` e gera um plano pré-assinado (direto ou multipart).
2. Criar worker TypeScript sem servidor HTTP: faz long polling na SQS, baixa o objeto S3, chama o classificador e persiste resultado.
3. Implementar estados `upload_pending`, `processing`, `completed` e `failed`.
4. Configurar retentativas exponenciais e DLQ.
5. Expor `GET /analyses/:id` e `GET /analyses`.
6. Executar o fluxo completo usando Floci: upload, evento S3, consumo, classificação e consulta de resultado.

**Incremento implementado:** a API possui `POST /analyses/upload-url`, `POST /analyses/:id/complete-upload`, `GET /analyses` e `GET /analyses/:id`. O núcleo segue Arquitetura Hexagonal: casos de uso dependem de portas, enquanto S3, SQS, PostgreSQL e Redis são adaptadores substituíveis. O worker recebe o evento S3 no SQS, baixa o objeto, chama o FastAPI, persiste o resultado e só remove a mensagem depois da conclusão.

**Pronto quando:** upload não bloqueia a requisição, a mensagem só é removida da SQS após a persistência e uma falha transitória é reprocessada sem duplicar o resultado.

### Fase 4 — Interface e experiência

1. Criar landing page que explica produto, limites e arquitetura.
2. Criar tela de nova análise com upload e gravação opcional.
3. Exibir processamento por polling inicial; evoluir para SSE se necessário.
4. Criar resultado com hipótese, confiança, versão do modelo e espectrograma.
5. Criar histórico por data, filtros e exclusão de análise.

**Pronto quando:** uma pessoa consegue concluir um fluxo de upload e entender o resultado, incluindo um aviso de baixa confiança.

**Implementado:** a tela principal permite selecionar arquivo ou gravar no microfone, desenha uma prévia da onda, envia por URL pré-assinada, acompanha o processamento, exibe probabilidades/modelo e lista/exclui o histórico.

### Fase 5 — EC2 e k3s na AWS

1. Iniciar esta fase somente após o fluxo E2E ter passado localmente com Floci.
2. Provisionar EC2, Security Group, Elastic IP opcional, ECR, S3, SQS/DLQ e IAM Instance Profile com Terraform.
3. Instalar k3s na EC2 e configurar Traefik Ingress para HTTPS e roteamento de `web` e `api`.
4. Publicar imagens no ECR e aplicar manifests/kustomize no k3s.
5. Trocar somente as configurações de ambiente: remover `AWS_ENDPOINT_URL`, apontar filas para SQS real e bucket para S3 real.
6. Manter `classifier` como `ClusterIP`, sem Ingress público; somente o worker pode acessá-lo.
7. Associar uma IAM Role de menor privilégio à EC2, com IMDSv2 obrigatório:
   - API: gerar URL pré-assinada para S3.
   - Worker: S3 e SQS.
   - Classificador: sem permissões AWS.
8. Rodar PostgreSQL e Redis no k3s no MVP; planejar a migração para RDS/ElastiCache antes de escalar ou exigir alta disponibilidade.

**Pronto quando:** a aplicação funciona pela URL HTTPS, somente 80/443 são públicos e a EC2 não usa chaves AWS estáticas.

**Implementado como preparação:** `infra/aws` contém Terraform para a EC2 com IMDSv2, IAM least privilege, Security Group, ECR, S3 com expiração/CORS e SQS/DLQ. `infra/k8s` contém base e overlay de homologação para k3s/Traefik. A aplicação real na AWS exige preencher `.env.hml` e executar o Terraform/aplicação manualmente.

### Fase 6 — Escala, resiliência e observabilidade

1. Começar com uma réplica de worker e concorrência 1; aumentar réplicas somente se CPU/memória permitirem.
2. Definir `requests`/`limits`, probes de liveness/readiness e `restartPolicy` adequados.
3. Usar long polling na SQS para reduzir leituras vazias.
4. Logs estruturados com `analysisId`, métricas de tempo de inferência e profundidade da fila.
5. Alarmes para DLQ, falhas elevadas, latência, erros do classificador e uso de disco/memória da EC2.

**Pronto quando:** o sistema tolera reinício de pod e o processamento de fila se recupera automaticamente.

**Implementado:** worker usa long polling, `WORKER_CONCURRENCY` (padrão 1), `Promise.allSettled`, visibilidade de 900 s, idempotência para análises concluídas, logs JSON; API/inference possuem probes, requests/limits e `/metrics` básico.

### Fase 7 — Segurança, testes e entrega

1. SSM Parameter Store ou Secrets Manager para segredos de aplicação; montar no k3s sem incluí-los nas imagens.
2. Bucket privado, criptografia, CORS mínimo e regra de ciclo de vida de expiração.
3. Network Policies: somente o worker pode chamar o classificador; Security Group expõe somente 80/443.
4. Testes unitários, integração, contrato e fluxo E2E de upload.
5. GitHub Actions: lint, testes, build, validação Terraform e push ao ECR; `terraform plan`/deploy devem ser jobs controlados com credenciais OIDC da conta.
6. Documentar decisões, trade-offs, diagrama e instruções de execução no README.

**Pronto quando:** o pipeline CI valida a aplicação e o repositório é compreensível como peça de portfólio.

**Implementado:** Helmet, CORS por ambiente, throttling, Swagger, NetworkPolicy, lifecycle/CORS do bucket, teste unitário de caso de uso, workflow CI e documentação geral/guia HTML.

## Decisões operacionais iniciais

- Usar CPU, não GPU, até haver evidência de gargalo.
- Fixar versão do modelo no build, não baixar “latest” em produção.
- Usar S3 como origem de áudio e não enviar o arquivo pela API.
- Não armazenar áudio no PostgreSQL ou Redis.
- Usar k3s em uma EC2 para aprender Kubernetes com custo controlado; EKS fica como laboratório futuro.
- Manter SQS como fila gerenciada: EC2 hospeda os consumidores, mas não substitui a mensageria.

## Critérios de aceite do MVP

- Um áudio é enviado diretamente ao S3 por URL pré-assinada.
- O worker processa a tarefa de forma assíncrona e idempotente.
- O classificador roda em container privado no k3s/EC2, sem mandar áudio ao Hugging Face.
- A interface mostra status, hipótese principal, confiança e aviso de baixa confiança quando aplicável.
- Resultados e histórico são persistidos no PostgreSQL.
- Falhas vão para retentativa e, no limite, DLQ.
- O áudio expira automaticamente conforme a política definida.
