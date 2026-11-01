---
name: Atualizações dos contratos gerados
description: Cuidado com migrações de segurança do gerador de contratos e da biblioteca de validação.
---

Trate atualizações do gerador de contratos e da biblioteca de validação como uma migração coordenada, não como simples atualizações independentes de pacotes.

**Why:** Durante uma auditoria, atualizações de segurança do Orval e do Zod produziram contratos incompatíveis mesmo sem alteração na especificação. Uma faixa com caret também manteve a versão nova no lockfile após reduzir o mínimo declarado.

**How to apply:** Use uma versão-alvo exata ao avaliar a migração e valide a regeneração junto com o typecheck completo antes de considerar a atualização concluída. Uma instalação bem-sucedida ou um typecheck anterior à regeneração não comprovam compatibilidade.
