# Segurança

Ninar é um projeto de estudo. O resultado da classificação é uma hipótese
experimental e não deve ser usado para decisões médicas.

## Segredos e dados locais

- Nunca faça commit de tokens, senhas, chaves, kubeconfigs ou arquivos de áudio.
- Copie um dos arquivos `.env.*.example` para um arquivo local e preencha os
  valores somente na sua máquina ou em um gerenciador de segredos.
- Use um token do Hugging Face com escopo mínimo (`read`) e revogue/rotacione-o
  imediatamente se ele aparecer em um commit, log ou captura de tela.
- O worker remove o áudio temporário depois de uma classificação concluída;
  durante falhas, ele preserva o objeto para permitir retentativa.

## Reporte responsável

Para uma instalação real, não publique detalhes de uma vulnerabilidade em uma
issue pública. Abra um canal privado com os mantenedores antes de divulgar o
problema. Este repositório não oferece garantia de disponibilidade ou suporte
de produção.
