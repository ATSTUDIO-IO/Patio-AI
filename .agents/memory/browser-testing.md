---
name: Testes de navegador neste ambiente
description: Alternativa quando o executor especializado de testes não está disponível e escolha do Chromium compatível.
---

O executor `subagent` recusou o tipo `testing` com `Unknown config kind` em 2026-11-01, apesar de a habilidade de testes documentar esse tipo. Não repetir a delegação quando essa incompatibilidade ocorrer; testar diretamente com Playwright local.

**Why:** a descrição da ferramenta pode anunciar uma capacidade que o runtime atual não aceita. Isso não significa que o navegador local esteja indisponível.

**How to apply:** localizar o Chromium já fornecido pelo Nix sob `/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome`, em vez de baixar um executável Linux genérico. Usar fixtures de rede isoladas para testar recuperação de sessão sem alterar contas ou estoque reais. Reavaliar a disponibilidade do executor em sessões futuras; não assumir indisponibilidade permanente.
