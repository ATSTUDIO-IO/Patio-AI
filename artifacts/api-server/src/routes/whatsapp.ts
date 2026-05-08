import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import {
  db,
  lojas,
  conversas,
  mensagens,
  leads,
  veiculos,
  type Loja,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";
import { simular, formatarSimulacaoParaAgente } from "../lib/simulator";
import { getPlanoConfig } from "../lib/planos";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const CLAUDE_MODEL = "claude-haiku-4-5";

interface VeiculoInventario {
  id: string;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  anoModelo: number;
  quilometragem: number;
  precoVenda: string;
  cor: string | null;
  descricaoAgente: string | null;
}

interface WhatsAppSession {
  conversaId: string;
  lojaId: string;
  from: string;
  timer: ReturnType<typeof setTimeout>;
  inventario: VeiculoInventario[];
  veiculoIdDetectado?: string;
}

const sessions = new Map<string, WhatsAppSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;

const PERFIS_COMPORTAMENTO: Record<string, string> = {
  profissional_cordial: `Perfil de comportamento: PROFISSIONAL E CORDIAL
- Use linguagem formal mas acessível, sempre com educação e empatia.
- Trate o cliente por "você". Evite gírias.
- Apresente-se como consultor especialista, transmitindo segurança e confiança.
- Ouça com atenção antes de responder. Valide as preocupações do cliente.
- Se o cliente demonstrar hesitação, explore as objeções com perguntas abertas.
- Finalize com call-to-action clara: agendamento de test drive, proposta de financiamento ou visita à loja.`,

  descontraido_amigavel: `Perfil de comportamento: DESCONTRAIDO E AMIGAVEL
- Use linguagem informal e leve, como uma conversa entre amigos.
- Seja entusiasmado: demonstre genuíno prazer em ajudar.
- Crie conexão pessoal: pergunte o nome do cliente logo no início e use-o.
- Quando o cliente hesitar, use humor leve para quebrar o gelo.
- Transforme cada objeção numa conversa descontraída.
- Finalize sugerindo o test drive de forma natural.`,

  consultivo_tecnico: `Perfil de comportamento: CONSULTIVO E TECNICO
- Priorize dados concretos: quilometragem, histórico de manutenção, especificações.
- Antecipe perguntas técnicas e responda com precisão.
- Ajude o cliente a construir uma decisão racional, baseada em custo-benefício.
- Explore o perfil de uso do cliente.
- Explique o financiamento em números claros.
- Não pressione: o cliente técnico decide com informação.`,

  direto_objetivo: `Perfil de comportamento: DIRETO E OBJETIVO
- Responda de forma direta e concisa.
- Apresente diferenciais logo de início.
- Se o cliente perguntar o preço, responda imediatamente.
- Não faça rodeios em objeções.
- Respeite o tempo do cliente.
- Call-to-action direta.`,
};

async function buscarInventario(lojaId: string): Promise<VeiculoInventario[]> {
  return db
    .select({
      id: veiculos.id,
      marca: veiculos.marca,
      modelo: veiculos.modelo,
      anoFabricacao: veiculos.anoFabricacao,
      anoModelo: veiculos.anoModelo,
      quilometragem: veiculos.quilometragem,
      precoVenda: veiculos.precoVenda,
      cor: veiculos.cor,
      descricaoAgente: veiculos.descricaoAgente,
    })
    .from(veiculos)
    .where(
      and(
        eq(veiculos.lojaId, lojaId),
        eq(veiculos.status, "ativo"),
        eq(veiculos.ativoAgente, true),
      ),
    )
    .limit(20);
}

function formatarInventarioParaPrompt(estoque: VeiculoInventario[]): string {
  if (estoque.length === 0) return "";
  const linhas = estoque.map((v) => {
    const preco = parseFloat(String(v.precoVenda)).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    });
    const km = (v.quilometragem ?? 0).toLocaleString("pt-BR") + " km";
    const cor = v.cor ? ` · ${v.cor}` : "";
    const ano =
      v.anoFabricacao === v.anoModelo
        ? String(v.anoFabricacao)
        : `${v.anoFabricacao}/${v.anoModelo}`;
    const desc = v.descricaoAgente ? ` — ${v.descricaoAgente}` : "";
    return `• ${v.marca} ${v.modelo} ${ano}${cor} · ${km} · ${preco}${desc}`;
  });
  return `ESTOQUE DISPONIVEL (${estoque.length} veículo${estoque.length !== 1 ? "s" : ""} ativo${estoque.length !== 1 ? "s" : ""}):\n${linhas.join("\n")}`;
}

function detectarVeiculoDeInteresse(
  texto: string,
  estoque: VeiculoInventario[],
): string | undefined {
  const lower = texto.toLowerCase();
  for (const v of estoque) {
    const modelo = v.modelo.toLowerCase();
    const marca = v.marca.toLowerCase();
    if (lower.includes(modelo) || lower.includes(`${marca} ${modelo}`)) {
      return v.id;
    }
  }
  return undefined;
}

function buildSystemPromptWhatsApp(
  loja: Pick<
    Loja,
    | "nomeFantasia"
    | "cidade"
    | "telefone"
    | "nomeAgente"
    | "tomAgente"
    | "horarioAtendimento"
    | "instrucoesEspecificas"
    | "aceitaTroca"
    | "descricaoGarantia"
    | "bancosParceiros"
  >,
  inventarioBloco: string,
): string {
  const nomeAgente = loja.nomeAgente || "Agente PátioAI";
  const tomKey = loja.tomAgente || "profissional_cordial";
  const scriptComportamento =
    PERFIS_COMPORTAMENTO[tomKey] ??
    PERFIS_COMPORTAMENTO["profissional_cordial"]!;

  const localizacao = loja.cidade ? ` em ${loja.cidade}` : "";
  const blocoIdentidade = `Você é ${nomeAgente}, agente de vendas especialista em veículos seminovos da loja "${loja.nomeFantasia}"${localizacao}, atendendo pelo WhatsApp.
Atenda SEMPRE em Português Brasileiro. Nunca quebre o personagem.`;

  const linhasContato: string[] = [];
  if (loja.telefone) linhasContato.push(`Telefone da loja: ${loja.telefone}`);
  if (loja.horarioAtendimento)
    linhasContato.push(`Horário de atendimento: ${loja.horarioAtendimento}`);
  const blocoContato =
    linhasContato.length > 0
      ? `CONTATO E HORARIO:\n${linhasContato.map((l) => `- ${l}`).join("\n")}`
      : "";

  const blocoComportamento = scriptComportamento;

  const aceitaTroca = loja.aceitaTroca !== false;
  const blocoTroca = aceitaTroca
    ? `POLITICA DE TROCA:\nAceitamos troca de veículos. Se o cliente mencionar que tem um carro para dar de entrada, incentive e colete informações sobre o veículo dele.`
    : `POLITICA DE TROCA:\nNão trabalhamos com troca de veículos. Seja direto e gentil ao informar.`;

  const descricaoGarantia = loja.descricaoGarantia
    ? loja.descricaoGarantia
    : "90 dias de garantia legal conforme Código de Defesa do Consumidor";
  const blocoGarantia = `GARANTIA:\n${descricaoGarantia}`;

  const bancosInfo = loja.bancosParceiros
    ? `Trabalhamos com: ${loja.bancosParceiros}.`
    : "Trabalhamos com as principais financeiras do mercado.";
  const blocoFinanciamento = `FINANCIAMENTO:\n${bancosInfo}
Quando o cliente perguntar sobre financiamento, colete: valor de entrada e número de parcelas desejadas. Informe que fará uma simulação e apresente condições aproximadas.`;

  const blocoInstrucoes = loja.instrucoesEspecificas
    ? `INSTRUCOES ESPECIAIS DA LOJA (siga obrigatoriamente):\n${loja.instrucoesEspecificas}`
    : "";

  const blocoRestricoes = `REGRAS FIXAS (nunca viole):
- Você está atendendo via WhatsApp (texto). Pode usar formatação simples e emojis com moderação.
- Respostas curtas e diretas: máximo 3-4 frases por mensagem. Prefira parágrafos curtos.
- Ao longo da conversa, colete nome, telefone (se diferente do WhatsApp) e e-mail do lead de forma natural.
- Pergunte sobre o veículo de interesse: modelo, ano, faixa de preço, uso (cidade/estrada), família.
- Quando o cliente demonstrar interesse em um veículo do estoque, apresente os detalhes com base nas informações do ESTOQUE DISPONIVEL acima.
- NUNCA invente especificações, preços ou condições não fornecidas. Use APENAS os dados do estoque acima.
- Se o veículo não estiver no estoque, diga que vai verificar disponibilidade com a equipe.
- Se não souber responder, diga: "Vou verificar com nossa equipe e te retorno em breve${loja.telefone ? `. Ou ligue: ${loja.telefone}` : ""}."
- Quando o cliente se despedir (tchau, até logo, etc.), agradeça, ofereça o contato da loja e encerre cordialmente.
- NÃO faça promessas de preço sem confirmação da equipe.`;

  return [
    blocoIdentidade,
    blocoComportamento,
    inventarioBloco,
    blocoContato,
    blocoTroca,
    blocoGarantia,
    blocoFinanciamento,
    blocoInstrucoes,
    blocoRestricoes,
  ]
    .filter(Boolean)
    .join("\n\n");
}

type LeadExtraido = {
  nome: string | null;
  telefone: string | null;
  email: string | null;
  interesse: "alto" | "medio" | "baixo";
  pediu_financiamento: boolean;
  pediu_test_drive: boolean;
  resumo: string;
};

async function extrairLeadDaTranscricao(
  transcricao: string,
): Promise<LeadExtraido> {
  const prompt = `Analise esta conversa de venda de veículo via WhatsApp e extraia as informações em JSON estrito, sem markdown:
{
  "nome": "nome do lead ou null",
  "telefone": "telefone mencionado ou null",
  "email": "email mencionado ou null",
  "interesse": "alto|medio|baixo",
  "pediu_financiamento": true|false,
  "pediu_test_drive": true|false,
  "resumo": "resumo breve em 2-3 frases"
}

Conversa:
${transcricao}`;

  const resp = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = resp.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? (b.text as string) : ""))
    .join("");

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      nome: null,
      telefone: null,
      email: null,
      interesse: "baixo",
      pediu_financiamento: false,
      pediu_test_drive: false,
      resumo: "Conversa encerrada.",
    };
  }

  try {
    const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const interesse =
      obj["interesse"] === "alto" ||
      obj["interesse"] === "medio" ||
      obj["interesse"] === "baixo"
        ? (obj["interesse"] as "alto" | "medio" | "baixo")
        : "baixo";
    return {
      nome: typeof obj["nome"] === "string" ? obj["nome"] : null,
      telefone: typeof obj["telefone"] === "string" ? obj["telefone"] : null,
      email: typeof obj["email"] === "string" ? obj["email"] : null,
      interesse,
      pediu_financiamento: Boolean(obj["pediu_financiamento"]),
      pediu_test_drive: Boolean(obj["pediu_test_drive"]),
      resumo:
        typeof obj["resumo"] === "string"
          ? obj["resumo"]
          : "Conversa encerrada.",
    };
  } catch {
    return {
      nome: null,
      telefone: null,
      email: null,
      interesse: "baixo",
      pediu_financiamento: false,
      pediu_test_drive: false,
      resumo: "Conversa encerrada.",
    };
  }
}

async function finalizarSessao(
  sessionKey: string,
  from: string,
): Promise<void> {
  const session = sessions.get(sessionKey);
  if (!session) return;
  clearTimeout(session.timer);
  sessions.delete(sessionKey);

  try {
    const [conversa] = await db
      .select()
      .from(conversas)
      .where(eq(conversas.id, session.conversaId))
      .limit(1);

    if (!conversa || conversa.encerradaEm) return;

    const historico = await db
      .select()
      .from(mensagens)
      .where(eq(mensagens.conversaId, conversa.id))
      .orderBy(asc(mensagens.criadoEm));

    const temMensagemDoUsuario = historico.some((m) => m.papel === "user");
    if (!temMensagemDoUsuario) {
      await db
        .update(conversas)
        .set({
          encerradaEm: new Date(),
          duracaoSegundos: 0,
          transcricao: "",
          resumoIa: "Sessão WhatsApp encerrada sem interação.",
        })
        .where(eq(conversas.id, conversa.id));
      return;
    }

    const transcricao = historico
      .map((m) => `${m.papel === "user" ? "Cliente" : "Agente"}: ${m.conteudo}`)
      .join("\n");

    const encerradaEm = new Date();
    const duracaoSegundos = Math.floor(
      (encerradaEm.getTime() - conversa.iniciadaEm.getTime()) / 1000,
    );

    const leadExtraido = await extrairLeadDaTranscricao(transcricao).catch(
      () => ({
        nome: null,
        telefone: from,
        email: null,
        interesse: "baixo" as const,
        pediu_financiamento: false,
        pediu_test_drive: false,
        resumo: "Conversa WhatsApp encerrada.",
      }),
    );

    const [lead] = await db
      .insert(leads)
      .values({
        lojaId: session.lojaId,
        veiculoId: session.veiculoIdDetectado ?? null,
        nome: leadExtraido.nome,
        telefone: leadExtraido.telefone ?? from,
        email: leadExtraido.email,
        interesse: leadExtraido.interesse,
        pediuFinanciamento: leadExtraido.pediu_financiamento,
        pediuTestDrive: leadExtraido.pediu_test_drive,
        statusCrm: "novo",
        origem: "whatsapp",
      })
      .returning();

    await db
      .update(conversas)
      .set({
        leadId: lead.id,
        encerradaEm,
        duracaoSegundos,
        transcricao,
        resumoIa: leadExtraido.resumo,
      })
      .where(eq(conversas.id, conversa.id));

    logger.info(
      { lojaId: session.lojaId, leadId: lead.id, from },
      "Lead WhatsApp salvo",
    );
  } catch (err) {
    logger.error({ err, sessionKey }, "Erro ao finalizar sessão WhatsApp");
  }
}

function resetarTimer(sessionKey: string, from: string): void {
  const session = sessions.get(sessionKey);
  if (!session) return;
  clearTimeout(session.timer);
  session.timer = setTimeout(
    () => finalizarSessao(sessionKey, from),
    SESSION_TTL_MS,
  );
}

async function enviarMensagemWhatsApp(
  numeroId: string,
  accessToken: string,
  to: string,
  texto: string,
): Promise<void> {
  const url = `https://graph.facebook.com/v22.0/${numeroId}/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: texto },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`WhatsApp API error ${resp.status}: ${body}`);
  }
}

const KEYWORDS_FINANCIAMENTO = [
  "financ",
  "parcel",
  "entrada",
  "prestação",
  "meses",
  "cdc",
  "consórcio",
  "leasing",
  "crédito",
  "banco",
  "simul",
  "taxa",
];

function detectarPedidoFinanciamento(texto: string): boolean {
  const lower = texto.toLowerCase();
  return KEYWORDS_FINANCIAMENTO.some((kw) => lower.includes(kw));
}

const KEYWORDS_DESPEDIDA = [
  "tchau",
  "até logo",
  "até mais",
  "até breve",
  "até a próxima",
  "até amanhã",
  "obrigado tchau",
  "obrigada tchau",
  "encerrar conversa",
  "quero encerrar",
  "não tenho mais perguntas",
  "era só isso",
  "por enquanto é só",
  "vou pensar",
  "falou",
  "valeu tchau",
  "vlw tchau",
  "flw",
  "bye",
  "não preciso mais",
];

function detectarDespedida(texto: string): boolean {
  const lower = texto.toLowerCase().trim();
  return KEYWORDS_DESPEDIDA.some((kw) => lower.includes(kw));
}

async function processWhatsAppMessage(payload: unknown): Promise<void> {
  const p = payload as Record<string, unknown>;
  const entry = (
    (p["entry"] as unknown[]) ?? []
  )[0] as Record<string, unknown> | undefined;
  if (!entry) return;

  const changes = (entry["changes"] as unknown[]) ?? [];
  const change = changes[0] as Record<string, unknown> | undefined;
  if (!change) return;

  const value = change["value"] as Record<string, unknown> | undefined;
  if (!value) return;

  const phoneNumberId =
    value["metadata"] && typeof value["metadata"] === "object"
      ? (
          (value["metadata"] as Record<string, unknown>)[
            "phone_number_id"
          ] as string | undefined
        )
      : undefined;
  if (!phoneNumberId) return;

  const messages = (value["messages"] as unknown[]) ?? [];
  const message = messages[0] as Record<string, unknown> | undefined;
  if (!message) return;

  const from = message["from"] as string | undefined;
  if (!from) return;

  const msgType = message["type"] as string | undefined;
  if (msgType !== "text") return;

  const text = (
    (message["text"] as Record<string, unknown> | undefined)?.["body"] as
      | string
      | undefined
  );
  if (!text?.trim()) return;

  const [loja] = await db
    .select()
    .from(lojas)
    .where(eq(lojas.whatsappNumeroId, phoneNumberId))
    .limit(1);

  if (!loja || !loja.ativo) {
    logger.warn({ phoneNumberId }, "Loja não encontrada para este número WhatsApp");
    return;
  }

  if (!loja.whatsappAccessToken) {
    logger.warn({ lojaId: loja.id }, "Loja sem access token WhatsApp configurado");
    return;
  }

  const sessionKey = `${from}:${loja.id}`;
  let session = sessions.get(sessionKey);

  if (!session) {
    const inventario = await buscarInventario(loja.id).catch(() => []);

    const [conversa] = await db
      .insert(conversas)
      .values({
        veiculoId: null,
        qrcodeId: null,
        canal: "whatsapp",
        consentimentoLgpd: true,
      })
      .returning();

    const nomeAgente = loja.nomeAgente || "Agente PátioAI";
    const saudacao = `Olá! Sou ${nomeAgente}, da ${loja.nomeFantasia}. Que bom ter você aqui! 😊 Como posso te ajudar hoje? Está procurando algum veículo específico?`;

    await db.insert(mensagens).values({
      conversaId: conversa.id,
      papel: "agente",
      conteudo: saudacao,
    });

    const timer = setTimeout(
      () => finalizarSessao(sessionKey, from),
      SESSION_TTL_MS,
    );
    session = {
      conversaId: conversa.id,
      lojaId: loja.id,
      from,
      timer,
      inventario,
    };
    sessions.set(sessionKey, session);

    await enviarMensagemWhatsApp(
      phoneNumberId,
      loja.whatsappAccessToken,
      from,
      saudacao,
    );
  }

  resetarTimer(sessionKey, from);

  await db.insert(mensagens).values({
    conversaId: session.conversaId,
    papel: "user",
    conteudo: text,
  });

  const veiculoDetectado = detectarVeiculoDeInteresse(
    text,
    session.inventario,
  );
  if (veiculoDetectado && !session.veiculoIdDetectado) {
    session.veiculoIdDetectado = veiculoDetectado;
  }

  const esDespedida = detectarDespedida(text);

  const historico = await db
    .select()
    .from(mensagens)
    .where(eq(mensagens.conversaId, session.conversaId))
    .orderBy(asc(mensagens.criadoEm));

  const inventarioBloco = formatarInventarioParaPrompt(session.inventario);
  let systemPrompt = buildSystemPromptWhatsApp(loja, inventarioBloco);

  const planoConfig = getPlanoConfig(loja.plano);

  if (detectarPedidoFinanciamento(text) && planoConfig.assistenteFinanciamento) {
    const lowerText = text.toLowerCase();
    const pctMatch = lowerText.match(/(\d+)\s*%\s*de\s*entrada/);
    const parcelasMatch = lowerText.match(/(\d+)\s*(?:parcelas|meses|vezes)/);
    const entradaPct = pctMatch ? parseInt(pctMatch[1], 10) : 20;
    const nParcelas = parcelasMatch ? parseInt(parcelasMatch[1], 10) : 48;

    const precoMatch = lowerText.match(/r?\$\s*([\d.,]+)/);
    if (precoMatch) {
      const precoRaw = precoMatch[1].replace(/\./g, "").replace(",", ".");
      const preco = parseFloat(precoRaw);
      if (!isNaN(preco) && preco > 0) {
        const sim = await simular({
          lojaId: loja.id,
          precoVenda: preco,
          entradaPct,
          nParcelas,
        }).catch(() => null);
        if (sim) {
          systemPrompt += `\n\n${formatarSimulacaoParaAgente(sim)}\nUse estes valores calculados ao responder sobre financiamento.`;
        }
      }
    }
  }

  const claudeMsgs = historico.map((m) => ({
    role: m.papel === "user" ? ("user" as const) : ("assistant" as const),
    content: m.conteudo,
  }));

  const claudeResp = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: systemPrompt,
    messages: claudeMsgs,
  });

  const textoAgente = claudeResp.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? (b.text as string) : ""))
    .join("")
    .trim();

  await db.insert(mensagens).values({
    conversaId: session.conversaId,
    papel: "agente",
    conteudo: textoAgente,
  });

  await enviarMensagemWhatsApp(
    phoneNumberId,
    loja.whatsappAccessToken,
    from,
    textoAgente,
  );

  if (esDespedida) {
    logger.info({ sessionKey, from }, "Despedida detectada — encerrando sessão WhatsApp imediatamente");
    clearTimeout(session.timer);
    void finalizarSessao(sessionKey, from);
  }
}

router.get("/whatsapp/webhook", (req, res): void => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && verifyToken) {
    logger.info("WhatsApp webhook verificado com sucesso");
    res.status(200).send(challenge as string);
  } else {
    logger.warn({ mode, token }, "Falha na verificação do webhook WhatsApp");
    res.sendStatus(403);
  }
});

router.post("/whatsapp/webhook", (req, res): void => {
  res.sendStatus(200);
  processWhatsAppMessage(req.body).catch((err) => {
    logger.error({ err }, "Erro ao processar mensagem WhatsApp");
  });
});

router.post(
  "/whatsapp/testar-conexao",
  requireAuth,
  async (req, res): Promise<void> => {
    const { whatsapp_numero_id, whatsapp_access_token } = req.body as {
      whatsapp_numero_id?: string;
      whatsapp_access_token?: string;
    };

    if (!whatsapp_numero_id || !whatsapp_access_token) {
      res.status(400).json({
        conectado: false,
        erro: "Phone Number ID e Access Token são obrigatórios.",
      });
      return;
    }

    try {
      const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(whatsapp_numero_id)}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${whatsapp_access_token}` },
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        const displayPhone =
          typeof data["display_phone_number"] === "string"
            ? data["display_phone_number"]
            : undefined;
        res.json({ conectado: true, display_phone_number: displayPhone });
      } else {
        const err = (await resp.json()) as Record<string, unknown>;
        const erro =
          (err["error"] as Record<string, unknown>)?.["message"] ??
          "Token inválido ou Phone Number ID incorreto.";
        res.json({ conectado: false, erro: String(erro) });
      }
    } catch {
      res.json({ conectado: false, erro: "Erro de rede ao conectar com Meta API." });
    }
  },
);

export default router;
