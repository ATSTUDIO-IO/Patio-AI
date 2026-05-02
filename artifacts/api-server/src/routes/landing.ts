import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CLAUDE_MODEL = "claude-haiku-4-5";
const MAX_MENSAGENS_SESSAO = 20;

const SYSTEM_PROMPT_VENDAS = `Você é um consultor de vendas especialista do PátioAI — uma plataforma SaaS B2B que transforma lojas de veículos seminovos com um agente de voz com IA.

SOBRE O PÁTIOAI:
O PátioAI resolve o maior problema de lojas de seminovos: leads perdidos. Cada veículo no pátio recebe um QR code exclusivo. Quando um cliente escaneia, começa uma conversa com um agente de voz em Português — 24 horas por dia, 7 dias por semana. O lead aparece automaticamente no CRM. Sem planilhas. Sem leads perdidos.

DIFERENCIAIS PRINCIPAIS:
- Voz em Português 24/7: nunca perde um lead, mesmo à meia-noite
- CRM Automático: nome, telefone, e-mail e interesse do lead capturados automaticamente
- Simulação de Financiamento com IA: calcula parcelas, entrada e taxas na hora
- QR Único por Veículo: rastreável, substituível, imprimível em 1 clique

PLANOS E PREÇOS:
- Starter: R$129,90/mês — 60 conversas/mês, 1 usuário, CRM básico
- Pro (MAIS POPULAR): R$249,90/mês — 200 conversas/mês, até 5 usuários, CRM completo, simulador de financiamento, personalização do agente
- Full: R$449,90/mês — 500 conversas/mês, usuários ilimitados, tudo do Pro + relatórios avançados, suporte prioritário, consulta documental

EXCEDENTE: R$0,75 por conversa além do plano. Buffer de 20 conversas extras antes de bloquear.

SEU OBJETIVO:
1. Responder dúvidas sobre o PátioAI com entusiasmo e clareza
2. Coletar de forma natural: NOME, E-MAIL e TELEFONE do visitante
3. Indicar o melhor plano para o tamanho da loja (pergunte quantos veículos têm no pátio)
4. Converter para: "Quer começar seu teste grátis agora? Acesse pátioai.com/cadastro"

REGRAS:
- Responda SEMPRE em Português Brasileiro
- Respostas curtas e conversacionais (máximo 3-4 frases)
- Seja entusiasmado mas direto — lojistas valorizam objetividade
- Quando perceber hesitação, use prova social: "Lojas que adotam o PátioAI relatam aumento de 40% nos leads capturados no primeiro mês"
- Não use emojis em excesso — use com parcimônia
- NÃO invente funcionalidades não listadas acima`;

router.post("/landing/chat", async (req, res): Promise<void> => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Mensagens inválidas" });
      return;
    }

    if (messages.length > MAX_MENSAGENS_SESSAO) {
      res.status(429).json({
        error: "Limite de mensagens por sessão atingido. Por favor, entre em contato diretamente.",
      });
      return;
    }

    const messagesValidas = messages
      .filter(
        (m) =>
          m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .slice(-20)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.trim(),
      }));

    if (messagesValidas.length === 0) {
      res.status(400).json({ error: "Nenhuma mensagem válida" });
      return;
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT_VENDAS,
      messages: messagesValidas,
    });

    const texto =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    res.json({ resposta: texto });
  } catch (err) {
    logger.error({ err }, "Erro na rota /api/landing/chat");
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

export default router;
