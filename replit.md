# PátioAI — Workspace

## Visão Geral

PátioAI é uma plataforma SaaS B2B para lojas de veículos seminovos. Cada veículo do pátio se torna um ponto de atendimento inteligente: o lead escaneia um QR code adesivado no painel do carro e conversa em tempo real com um agente de voz IA, sem depender de um vendedor presente.

## Stack Técnica

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (`artifacts/api-server`)
- **Frontend**: React + Vite (`artifacts/painel` — a criar na Tarefa #6)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec em `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)
- **LLM**: Anthropic Claude (via Replit AI Integrations)
- **Auth**: JWT + bcrypt (implementado na Tarefa #2)

## Comandos Principais

- `pnpm run typecheck` — typecheck completo de todos os pacotes
- `pnpm run build` — typecheck + build de todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks React Query e schemas Zod da spec OpenAPI
- `pnpm --filter @workspace/db run push` — sincroniza schema com o banco (dev only)
- `pnpm --filter @workspace/api-server run dev` — roda o servidor API localmente

## Schema do Banco de Dados

Todas as tabelas estão em `lib/db/src/schema/` organizadas por domínio:

### Bloco 1 — Identidade e Acesso (`lojas.ts`)
- **lojas** — cadastro das lojas clientes (plano: starter/pro/full)
- **usuarios** — lojistas, vendedores e admins (perfil: dono/vendedor/admin_patioai)
- **sessoes** — tokens JWT persistidos

### Bloco 2 — Núcleo do Produto (`veiculos.ts`)
- **veiculos** — estoque da loja (status: ativo/vendido/pausado, campo `ativo_agente` controla billing)
- **qrcodes** — QR code único por veículo (slug único, nunca reutilizado)
- **financiamentos** — tabelas de financiamento por banco/modalidade

### Bloco 3 — Leads e Conversas (`leads.ts`)
- **leads** — leads capturados pelo agente (interesse: alto/medio/baixo, status CRM)
- **conversas** — sessões com o agente de voz (transcrição, resumo IA, consentimento LGPD)
- **mensagens** — mensagens individuais da conversa (papel: user/agente)

### Bloco 4 — Billing (`billing.ts`)
- **ciclos_billing** — snapshot mensal de veículos ativos × preço do plano (UNIQUE loja+mês)
- **eventos_billing** — log de ativações, baixas e pausas de veículos

### Bloco 5 — Admin (`admin.ts`)
- **notas_admin** — anotações internas dos admins PátioAI sobre lojas

## Módulos (ordem de build)

| # | Tarefa | Status |
|---|--------|--------|
| 1 | Schema do banco de dados | ✅ Concluído |
| 2 | Auth e Gestão de Lojas (M1) | 🔜 Próximo |
| 3 | Veículos e QR Code (M2) | ⏳ Pendente |
| 4 | Agente de Voz IA (M3) | ⏳ Pendente |
| 5 | CRM e Financiamento (M4+M5) | ⏳ Pendente |
| 6 | Billing e Painel do Lojista (React) | ⏳ Pendente |
| 7 | Painel Admin | ⏳ Pendente |

## Estrutura de Rotas Planejada

- `/api/auth/*` — autenticação e registro
- `/api/veiculos/*` — CRUD de veículos (autenticado por JWT)
- `/api/leads/*` — CRM de leads (autenticado)
- `/api/conversas/*` — histórico de conversas (autenticado)
- `/api/financiamentos/*` — tabelas de financiamento (autenticado)
- `/api/billing/*` — ciclos e eventos de billing (autenticado, dono)
- `/api/agente/*` — sessão de voz do agente (semi-público, validado por slug)
- `/api/admin/*` — painel admin (restrito a admin_patioai)
- `/v/{slug}` — página pública do agente (sem auth)
- `/dashboard/*` — painel do lojista (React, autenticado)
- `/admin/*` — painel admin (React, autenticado como admin_patioai)

## Preços por Plano

| Plano | Preço/veículo/mês |
|-------|-------------------|
| starter | R$ 30,00 |
| pro | R$ 50,00 |
| full | R$ 75,00 |

## Regras de Negócio Críticas

- `ativo_agente = false` → veículo não entra no ciclo de billing
- Venda do veículo → `ativo_agente` muda para `false` automaticamente (na camada de aplicação)
- QR code após venda: ativo por 30 dias, redireciona para "veículo indisponível"
- Slug do QR nunca é reutilizado, mesmo após exclusão
- `admin_patioai` não tem `loja_id` (super-usuário transversal)
- Consentimento LGPD obrigatório antes de qualquer gravação de voz

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
