# Deploy com Docker Compose

Este diretório reúne exemplos para executar a stack em um host que já tenha
Docker, Docker Compose e um proxy reverso configurados. Os detalhes específicos
do servidor, domínio, rede Docker, runner e credenciais devem permanecer na
documentação privada do ambiente, não neste repositório público.

## Pré-requisitos

- Docker Engine e Docker Compose Plugin;
- armazenamento persistente para os volumes da aplicação;
- portas HTTPS publicadas pelo proxy reverso do ambiente;
- arquivo de ambiente preenchido a partir de `.env.production.example`;
- acesso protegido ao runner ou mecanismo de CI/CD utilizado pelo projeto.

## Configuração

1. Crie o arquivo de ambiente fora do Git e preencha os valores do ambiente.
2. Garanta que o proxy reverso encaminhe o frontend, a API e o endpoint de
   storage para os serviços correspondentes da stack.
3. Configure CORS, DNS e certificados no provedor responsável pelo domínio.
4. Valide a configuração antes de subir os serviços:

   ```bash
   docker compose --env-file .env.production \
     -f docker-compose.production.yml config
   ```

5. Suba ou atualize a aplicação:

   ```bash
   docker compose --env-file .env.production \
     -f docker-compose.production.yml up -d --build --remove-orphans
   ```

6. Confira o estado e os logs dos serviços antes de liberar o tráfego:

   ```bash
   docker compose --env-file .env.production \
     -f docker-compose.production.yml ps
   docker compose --env-file .env.production \
     -f docker-compose.production.yml logs --tail=100
   ```

## GitHub Actions

O workflow de deploy pode ser executado em um runner self-hosted ou adaptado
para o provedor de CI/CD escolhido. Configure a seleção do runner, variáveis,
aprovações e segredos diretamente na plataforma, sem registrá-los no código.

Nunca versione `.env.production`, tokens, senhas, chaves ou detalhes de acesso
à infraestrutura. O arquivo [`Caddyfile.example`](./Caddyfile.example) é
somente um exemplo de roteamento e deve ser adaptado ao proxy reverso privado
do ambiente.
