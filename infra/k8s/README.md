# Deploy no k3s

O diretório contém manifests para a EC2 com k3s. O classificador é `ClusterIP` e não possui rota no Ingress. A exposição pública é feita apenas pelo Traefik nas portas 80/443.

## Homologação

1. Copie o `.env.hml.example` para `.env.hml` e preencha as saídas do Terraform, a senha do PostgreSQL, o `HF_TOKEN` e os domínios.
2. Crie/atualize o segredo sem commitar o arquivo:

```bash
kubectl -n ninar-hml create secret generic ninar-env \
  --from-env-file=.env.hml \
  --dry-run=client -o yaml | kubectl apply -f -
```

3. Substitua `REPLACE_ACCOUNT` no overlay ou use `kustomize edit set image` com as URLs do output `ecr_repository_urls`. Em releases, prefira o SHA da imagem em vez de `latest`.
4. Aplique:

```bash
kubectl apply -k infra/k8s/overlays/hml
kubectl -n ninar-hml rollout status deployment/api deployment/worker deployment/inference deployment/web
```

Para o MVP, PostgreSQL e Redis rodam como workloads `StatefulSet`/`Deployment` na EC2. Antes de escalar, migre-os para RDS e ElastiCache.
