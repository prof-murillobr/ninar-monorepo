# Deploy no EC2 com Caddy e GitHub Actions

Este alvo usa Docker Compose no próprio Amazon Linux EC2. O Caddy continua
instalado no host e é o único processo exposto publicamente; os containers web
e API escutam somente em `127.0.0.1:3000` e `127.0.0.1:3001`.

## Preparar o host uma vez

Instale Docker, Git e `rsync`, habilite o serviço e adicione o usuário do
runner ao grupo Docker:

```bash
sudo dnf install -y docker git rsync
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Instale um runner self-hosted nas configurações do repositório GitHub com as
labels `self-hosted`, `linux`, `x64` e `ninar-ec2`. Execute-o como usuário sem
privilégio de root.

Crie o diretório persistente e o ambiente de produção:

```bash
mkdir -p "$HOME/apps/ninar"
cp .env.production.example "$HOME/apps/ninar/.env.production"
chmod 600 "$HOME/apps/ninar/.env.production"
$EDITOR "$HOME/apps/ninar/.env.production"
```

O arquivo deve conter os valores reais de Postgres, S3, SQS, Hugging Face e
domínios. Prefira a IAM Role da instância para S3/SQS; não coloque chaves AWS
estáticas nesse arquivo.

## Configurar o Caddy do host

Adicione os registros DNS `A` para o domínio web e o domínio da API apontando
para o Elastic IP. Libere somente `80` e `443` no Security Group. Depois:

```bash
sudo cp infra/ec2/Caddyfile.example /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Altere `ninar.example.com` e `api.ninar.example.com` no arquivo antes de
recarregar o serviço. O Caddy emitirá e renovará os certificados HTTPS.

## Configurar o GitHub Actions

O workflow [deploy-ec2.yml](../../.github/workflows/deploy-ec2.yml) executa no
runner instalado no EC2. Ele:

1. faz checkout do commit da branch `main`;
2. sincroniza o código para `$HOME/apps/ninar` (ou para a variável de repositório
   `NINAR_DEPLOY_DIR`);
3. preserva `.env.production` e volumes persistentes;
4. valida o Compose;
5. reconstrói e reinicia a stack;
6. exibe o estado dos containers.

Recomenda-se criar um GitHub Environment chamado `production` com aprovação
obrigatória antes do deploy. O workflow não recebe tokens de aplicação nem
credenciais AWS; os segredos ficam no EC2 ou são fornecidos pela IAM Role.
