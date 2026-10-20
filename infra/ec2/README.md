# Deploy no EC2 com Caddy e GitHub Actions

Este alvo usa Docker Compose na mesma Amazon Linux EC2 que já hospeda o
`personal-site`. Não é necessário criar outro usuário, outra EC2 ou outro
Docker. A stack adiciona web, API, worker, inference, Postgres, Redis e
LocalStack (S3/SQS emulado) e usa os volumes Docker para persistência local.

O Caddy existente do `personal-site` continua sendo a única entrada pública.
Os serviços do Ninar entram na rede Docker externa `ninar_edge`; o Caddy deve
usar os aliases `ninar-web`, `ninar-api` e `ninar-storage`.

## Preparar o host uma vez

Como o host já executa o `personal-site`, mantenha o usuário e o acesso Docker
que o runner atual já utiliza. Apenas confirme que `rsync` está instalado:

```bash
sudo dnf install -y rsync
docker info
```

O runner do `personal-site` pode ser reutilizado se for compartilhado pela
organização. Se ele estiver registrado somente naquele repositório, registre
uma segunda instância do runner para este repositório, sob o mesmo usuário e
em outro diretório; não crie um usuário Linux novo. A nova instância precisa
das labels `self-hosted`, `linux`, `x64` e `ninar-ec2`.

Crie o diretório persistente e o ambiente de produção:

```bash
mkdir -p "$HOME/apps/ninar"
cp .env.production.example "$HOME/apps/ninar/.env.production"
chmod 600 "$HOME/apps/ninar/.env.production"
$EDITOR "$HOME/apps/ninar/.env.production"
```

O arquivo contém a configuração local do Postgres, Redis e LocalStack, além do
token do Hugging Face e dos domínios. `AWS_ACCESS_KEY_ID=test` e
`AWS_SECRET_ACCESS_KEY=test` são somente credenciais fictícias aceitas pelo
LocalStack; nunca substitua esses valores por chaves AWS reais nesse ambiente.

## Integrar o Caddy existente

Adicione registros DNS `A` para o domínio web, API e storage apontando para o
Elastic IP. Libere somente `80` e `443` no Security Group. Não inicie outro
Caddy: o Caddy do `personal-site` já ocupa essas portas.

Crie a rede externa antes da primeira subida:

```bash
docker network inspect ninar_edge >/dev/null 2>&1 || docker network create ninar_edge
```

Para que a conexão sobreviva a reinícios do `personal-site`, adicione a rede
externa ao serviço `caddy` do `docker-compose.production.yml` dele:

```yaml
services:
  caddy:
    networks:
      - default
      - ninar_edge

networks:
  ninar_edge:
    external: true
    name: ninar_edge
```

Depois, adicione os três blocos de [`Caddyfile.example`](./Caddyfile.example)
ao Caddyfile existente.
Os destinos são `ninar-web:3000`, `ninar-api:3001` e `ninar-storage:4566`.
No bloco de storage, preserve o header `Host`; ele faz parte da URL assinada
do upload S3. Depois valide e recarregue o Caddy normalmente.

## Configurar o GitHub Actions

O workflow [deploy-ec2.yml](../../.github/workflows/deploy-ec2.yml) executa no
runner instalado no EC2. Ele:

1. faz checkout do commit da branch `main`;
2. sincroniza o código para `$HOME/apps/ninar` (ou para a variável de repositório
   `NINAR_DEPLOY_DIR`);
3. cria a rede `ninar_edge` se necessário;
4. preserva `.env.production` e volumes persistentes;
5. valida o Compose;
6. reconstrói e reinicia a stack;
7. exibe o estado dos containers.

Recomenda-se criar um GitHub Environment chamado `production` com aprovação
obrigatória antes do deploy. O workflow não recebe tokens de aplicação nem
credenciais AWS; os segredos ficam no EC2 ou são fornecidos pela IAM Role.
