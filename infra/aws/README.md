# AWS + EC2 + k3s (homologação)

Este módulo é deliberadamente explícito: ele não cria um domínio DNS nem um certificado ACM, porque ambos dependem da conta/host escolhidos. Ele cria o núcleo do laboratório: EC2, Security Group, IAM Role/Profile, ECR, S3 privado com lifecycle de 7 dias e SQS com DLQ.

## Pré-requisitos

- Terraform 1.6+ e credenciais AWS apenas na máquina de provisionamento (profile/SSO é preferível).
- VPC e subnet pública existentes, um AMI Ubuntu 24.04 da região e um key pair opcional.
- Seu IP público em CIDR `/32` para SSH e API do k3s.

```bash
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
terraform output
```

Depois do apply, copie o kubeconfig da EC2 por SSH, publique as imagens no ECR e preencha `.env.hml` com `audio_bucket` e `analyses_queue_url`. A IAM Role permite que os pods usem as credenciais temporárias do IMDSv2; não coloque `AWS_SECRET_ACCESS_KEY` em imagens ou no Secret se a Role estiver funcionando.

O `user-data.sh.tftpl` instala k3s, mas não aplica a aplicação automaticamente: isso deixa o deploy controlado e permite validar imagens, Secrets e hostnames antes de publicar.
