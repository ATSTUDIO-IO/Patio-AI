import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import {
  db,
  qrcodes,
  veiculos,
  lojas,
  conversas,
  mensagens,
  leads,
  type Veiculo,
  type Loja,
  type Conversa,
} from "@workspace/db";
import {
  IniciarSessaoAgenteBody,
  EnviarMensagemAgenteBody,
  EncerrarSessaoAgenteBody,
} from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  speechToText,
  textToSpeech,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import { formatZodError } from "../lib/errors";
import { logger } from "../lib/logger";
import { simular, formatarSimulacaoParaAgente } from "../lib/simulator";

const router: IRouter = Router();

const CLAUDE_MODEL = "claude-haiku-3-5";

function buildSystemPrompt(
  veiculo: Pick<
    Veiculo,
    | "marca"
    | "modelo"
    | "anoFabricacao"
    | "anoModelo"
    | "quilometragem"
    | "precoVenda"
    | "cor"
    | "cambio"
    | "combustivel"
    | "opcionais"
    | "descricaoAgente"
  >,
  loja: Pick<Loja, "nomeFantasia" | "cidade" | "telefone">,
): string {
  const km = veiculo.quilometragem.toLocaleString("pt-BR");
  const preco = Number(veiculo.precoVenda).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const linhasOpcional: string[] = [];
  if (veiculo.cor) linhasOpcional.push(`- Cor: ${veiculo.cor}`);
  if (veiculo.cambio) linhasOpcional.push(`- Câmbio: ${veiculo.cambio}`);
  if (veiculo.combustivel) linhasOpcional.push(`- Combustível: ${veiculo.combustivel}`);
  if (veiculo.opcionais && veiculo.opcionais.length > 0)
    linhasOpcional.push(`- Opcionais: ${veiculo.opcionais.join(", ")}`);
  if (veiculo.descricaoAgente)
    linhasOpcional.push(`\nInformações adicionais: ${veiculo.descricaoAgente}`);

  const telefoneLoja = loja.telefone ? `\n- Telefone da loja: ${loja.telefone}` : "";

  return `Você é o Pátio AI, agente de voz especialista em vendas de veículos seminovos para a loja "${loja.nomeFantasia}"${loja.cidade ? ` em ${loja.cidade}` : ""}.${telefoneLoja}

Veículo em destaque:
- Modelo: ${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao}/${veiculo.anoModelo}
- Quilometragem: ${km} km
- Preço: ${preco}
${linhasOpcional.join("\n")}

Objetivos:
1. Apresentar o veículo com entusiasmo e profissionalismo
2. Responder perguntas sobre o veículo, financiamento e test drive
3. Coletar nome, telefone e e-mail do lead de forma natural durante a conversa
4. Para financiamento: pergunte valor de entrada e simule parcelas estimadas
5. Sempre em Português Brasileiro, tom amigável e direto

Regras:
- Respostas curtas e conversacionais (máx 3 frases por turno)
- Se o lead quiser encerrar, agradeça e despede-se profissionalmente
- NUNCA invente especificações não fornecidas
- Se não souber responder, diga que vai verificar com a equipe${loja.telefone ? ` ou ligar para ${loja.telefone}` : ""}`;
}

function gerarSaudacaoTexto(
  veiculo: Pick<Veiculo, "marca" | "modelo" | "anoFabricacao">,
  loja: Pick<Loja, "nomeFantasia">,
): string {
  return `Olá! Bem-vindo ao Pátio AI, o assistente virtual da ${loja.nomeFantasia}! Vi que você se interessou pelo ${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao}. Fico feliz em apresentar esse veículo incrível pra você! Pode fazer suas perguntas, estou aqui pra ajudar.`;
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
  "pagar por mês",
  "pagaria",
  "taxa",
];

function detectarPedidoFinanciamento(texto: string): boolean {
  const lower = texto.toLowerCase();
  return KEYWORDS_FINANCIAMENTO.some((kw) => lower.includes(kw));
}

function extrairEntradaEParcelas(texto: string): {
  entrada_pct: number;
  n_parcelas: number;
} {
  const lower = texto.toLowerCase();

  let entrada_pct = 20;
  let n_parcelas = 48;

  const entradaPctMatch = lower.match(/(\d+)\s*%\s*de\s*entrada/);
  if (entradaPctMatch) {
    entrada_pct = parseInt(entradaPctMatch[1], 10);
  }

  const nParcelasMatch = lower.match(/(\d+)\s*(?:parcelas|meses|vezes|prestações)/);
  if (nParcelasMatch) {
    const n = parseInt(nParcelasMatch[1], 10);
    if (n >= 1 && n <= 360) n_parcelas = n;
  }

  return { entrada_pct, n_parcelas };
}

async function gerarAudioBase64(texto: string): Promise<string> {
  try {
    const buf = await textToSpeech(texto, "nova", "mp3");
    return buf.toString("base64");
  } catch (err) {
    logger.warn({ err }, "Falha ao gerar áudio TTS");
    return "";
  }
}

function detectarEncerramento(texto: string): boolean {
  const lower = texto.toLowerCase();
  return (
    lower.includes("até logo") ||
    lower.includes("tchau") ||
    lower.includes("obrigado pela visita") ||
    lower.includes("boa sorte") ||
    lower.includes("até breve")
  );
}

router.post("/agente/sessao", async (req, res): Promise<void> => {
  const body = IniciarSessaoAgenteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const { slug, consentimento_lgpd } = body.data;

  if (!consentimento_lgpd) {
    res.status(403).json({ error: "Consentimento LGPD obrigatório para iniciar a sessão" });
    return;
  }

  const [qr] = await db
    .select()
    .from(qrcodes)
    .where(eq(qrcodes.slug, slug))
    .limit(1);

  if (!qr || !qr.ativo) {
    res.status(404).json({ error: "QR code não encontrado ou inativo" });
    return;
  }

  const [veiculo] = await db
    .select()
    .from(veiculos)
    .where(eq(veiculos.id, qr.veiculoId))
    .limit(1);

  if (!veiculo || veiculo.status !== "ativo" || !veiculo.ativoAgente) {
    res.status(404).json({ error: "Veículo não disponível para o agente" });
    return;
  }

  const [loja] = await db
    .select()
    .from(lojas)
    .where(eq(lojas.id, veiculo.lojaId))
    .limit(1);

  if (!loja) {
    res.status(404).json({ error: "Loja não encontrada" });
    return;
  }

  const [conversa] = await db
    .insert(conversas)
    .values({
      veiculoId: veiculo.id,
      qrcodeId: qr.id,
      consentimentoLgpd: consentimento_lgpd,
    })
    .returning();

  const saudacaoTexto = gerarSaudacaoTexto(
    { marca: veiculo.marca, modelo: veiculo.modelo, anoFabricacao: veiculo.anoFabricacao },
    { nomeFantasia: loja.nomeFantasia },
  );

  const [, saudacaoAudio] = await Promise.all([
    db.insert(mensagens).values({
      conversaId: conversa.id,
      papel: "agente",
      conteudo: saudacaoTexto,
    }),
    gerarAudioBase64(saudacaoTexto),
  ]);

  res.status(201).json({
    conversa_id: conversa.id,
    veiculo: {
      id: veiculo.id,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      ano_fabricacao: veiculo.anoFabricacao,
      ano_modelo: veiculo.anoModelo,
      quilometragem: veiculo.quilometragem,
      preco_venda: veiculo.precoVenda,
      cor: veiculo.cor,
      cambio: veiculo.cambio,
      combustivel: veiculo.combustivel,
      opcionais: veiculo.opcionais,
      slug: qr.slug,
    },
    loja: {
      nome_fantasia: loja.nomeFantasia,
      cidade: loja.cidade,
      telefone: loja.telefone,
    },
    saudacao_audio: saudacaoAudio,
    saudacao_texto: saudacaoTexto,
  });
});

async function resolveConversaComSlug(
  conversaId: string,
  slug: string,
): Promise<
  | { conversa: Conversa; veiculo: Veiculo; loja: Loja; qr: typeof qrcodes.$inferSelect }
  | { error: string; status: number }
> {
  const [[qr], [conversa]] = await Promise.all([
    db.select().from(qrcodes).where(eq(qrcodes.slug, slug)).limit(1),
    db.select().from(conversas).where(eq(conversas.id, conversaId)).limit(1),
  ]);

  if (!qr) return { error: "QR code não encontrado", status: 404 };
  if (!conversa) return { error: "Sessão não encontrada", status: 404 };
  if (conversa.qrcodeId !== qr.id) return { error: "Sessão não pertence a este veículo", status: 403 };

  const [veiculo] = await db
    .select()
    .from(veiculos)
    .where(eq(veiculos.id, conversa.veiculoId))
    .limit(1);

  if (!veiculo) return { error: "Veículo não encontrado", status: 404 };

  const [loja] = await db
    .select()
    .from(lojas)
    .where(eq(lojas.id, veiculo.lojaId))
    .limit(1);

  if (!loja) return { error: "Loja não encontrada", status: 404 };

  return { conversa, veiculo, loja, qr };
}

function buildSttPromise(audio_base64: string, formato: string): Promise<string> {
  const inputBuf = Buffer.from(audio_base64, "base64");
  const audioFmt = (formato ?? "webm") as "webm" | "mp3" | "wav" | "mp4" | "ogg";
  if (audioFmt === "wav" || audioFmt === "mp3") {
    return speechToText(inputBuf, audioFmt);
  }
  return ensureCompatibleFormat(inputBuf).then(({ buffer, format }) =>
    speechToText(buffer, format),
  );
}

router.post("/agente/mensagem", async (req, res): Promise<void> => {
  const body = EnviarMensagemAgenteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const { slug, conversa_id, audio_base64, formato, texto } = body.data;

  if (!audio_base64 && !texto) {
    res.status(400).json({ error: "Informe audio_base64 ou texto" });
    return;
  }

  const sttPromise: Promise<string> = texto
    ? Promise.resolve(texto)
    : buildSttPromise(audio_base64!, formato ?? "webm");

  const [resolved, transcricao] = await Promise.all([
    resolveConversaComSlug(conversa_id, slug),
    sttPromise,
  ]);

  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }

  const { conversa, veiculo, loja } = resolved;

  if (conversa.encerradaEm) {
    res.status(400).json({ error: "Sessão já encerrada" });
    return;
  }

  await db.insert(mensagens).values({
    conversaId: conversa.id,
    papel: "user",
    conteudo: transcricao,
  });

  const historico = await db
    .select()
    .from(mensagens)
    .where(eq(mensagens.conversaId, conversa.id))
    .orderBy(asc(mensagens.criadoEm));

  let systemPrompt = buildSystemPrompt(veiculo, loja);
  let simulacaoInjetada = false;

  if (detectarPedidoFinanciamento(transcricao)) {
    const { entrada_pct, n_parcelas } = extrairEntradaEParcelas(transcricao);
    const resultadoSimulacao = await simular({
      lojaId: veiculo.lojaId,
      precoVenda: Number(veiculo.precoVenda),
      entradaPct: entrada_pct,
      nParcelas: n_parcelas,
    }).catch((err) => {
      logger.warn({ err }, "Falha ao simular financiamento");
      return null;
    });

    if (resultadoSimulacao) {
      const textoSimulacao = formatarSimulacaoParaAgente(resultadoSimulacao);
      systemPrompt += `\n\n${textoSimulacao}\nUse estes valores calculados ao responder sobre financiamento.`;
      simulacaoInjetada = true;
    }
  }

  const claudeMsgs = historico.map((m) => ({
    role: m.papel === "user" ? ("user" as const) : ("assistant" as const),
    content: m.conteudo,
  }));

  const claudeResp = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages: claudeMsgs,
  });

  const textoAgente = claudeResp.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? (b.text as string) : ""))
    .join("");

  const [, audioAgente] = await Promise.all([
    db.insert(mensagens).values({
      conversaId: conversa.id,
      papel: "agente",
      conteudo: textoAgente,
    }),
    gerarAudioBase64(textoAgente),
    simulacaoInjetada
      ? db.update(conversas).set({ simulacaoRealizada: true }).where(eq(conversas.id, conversa.id))
      : Promise.resolve(),
  ]);

  res.json({
    texto_usuario: transcricao,
    texto_agente: textoAgente,
    audio_agente: audioAgente,
    encerrar: detectarEncerramento(textoAgente),
  });
});

router.post("/agente/mensagem/stream", async (req, res): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const sendEvent = (data: object) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const body = EnviarMensagemAgenteBody.safeParse(req.body);
    if (!body.success) {
      sendEvent({ type: "error", mensagem: formatZodError(body.error) });
      res.end();
      return;
    }

    const { slug, conversa_id, audio_base64, formato, texto } = body.data;

    if (!audio_base64 && !texto) {
      sendEvent({ type: "error", mensagem: "Informe audio_base64 ou texto" });
      res.end();
      return;
    }

    const sttPromise: Promise<string> = texto
      ? Promise.resolve(texto)
      : buildSttPromise(audio_base64!, formato ?? "webm");

    const [resolved, transcricao] = await Promise.all([
      resolveConversaComSlug(conversa_id, slug),
      sttPromise,
    ]);

    if ("error" in resolved) {
      sendEvent({ type: "error", mensagem: resolved.error });
      res.end();
      return;
    }

    const { conversa, veiculo, loja } = resolved;

    if (conversa.encerradaEm) {
      sendEvent({ type: "error", mensagem: "Sessão já encerrada" });
      res.end();
      return;
    }

    sendEvent({ type: "transcricao", texto: transcricao });

    await db.insert(mensagens).values({ conversaId: conversa.id, papel: "user", conteudo: transcricao });
    const historico = await db
      .select()
      .from(mensagens)
      .where(eq(mensagens.conversaId, conversa.id))
      .orderBy(asc(mensagens.criadoEm));

    let systemPrompt = buildSystemPrompt(veiculo, loja);
    let simulacaoInjetada = false;

    if (detectarPedidoFinanciamento(transcricao)) {
      const { entrada_pct, n_parcelas } = extrairEntradaEParcelas(transcricao);
      const resultadoSimulacao = await simular({
        lojaId: veiculo.lojaId,
        precoVenda: Number(veiculo.precoVenda),
        entradaPct: entrada_pct,
        nParcelas: n_parcelas,
      }).catch((err) => {
        logger.warn({ err }, "Falha ao simular financiamento");
        return null;
      });

      if (resultadoSimulacao) {
        const textoSimulacao = formatarSimulacaoParaAgente(resultadoSimulacao);
        systemPrompt += `\n\n${textoSimulacao}\nUse estes valores calculados ao responder sobre financiamento.`;
        simulacaoInjetada = true;
      }
    }

    const claudeMsgs = historico.map((m) => ({
      role: m.papel === "user" ? ("user" as const) : ("assistant" as const),
      content: m.conteudo,
    }));

    let textoCompleto = "";
    let sentenceBuffer = "";
    let ttsIndex = 0;
    const ttsPromises: Promise<void>[] = [];

    const SENTENCE_END = /[.!?](?:\s|$)/;

    const fireTts = (sentence: string) => {
      const idx = ttsIndex++;
      const p = gerarAudioBase64(sentence)
        .then((audio) => {
          sendEvent({ type: "audio_chunk", index: idx, audio_base64: audio, texto: sentence });
        })
        .catch(() => {
          sendEvent({ type: "audio_chunk", index: idx, audio_base64: "", texto: sentence });
        });
      ttsPromises.push(p);
    };

    const flushSentenceBuffer = (flush = false) => {
      while (true) {
        const match = SENTENCE_END.exec(sentenceBuffer);
        if (!match) {
          if (flush && sentenceBuffer.trim()) {
            fireTts(sentenceBuffer.trim());
            sentenceBuffer = "";
          }
          break;
        }
        const sentence = sentenceBuffer.slice(0, match.index + 1).trim();
        sentenceBuffer = sentenceBuffer.slice(match.index + match[0].length);
        if (sentence) {
          fireTts(sentence);
        }
        if (flush && !sentenceBuffer.trim()) break;
      }
    };

    const stream = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: claudeMsgs,
      stream: true,
    });

    for await (const event of stream) {
      if (res.writableEnded) break;
      if (
        event.type === "content_block_delta" &&
        "delta" in event &&
        event.delta.type === "text_delta"
      ) {
        const chunk = event.delta.text as string;
        textoCompleto += chunk;
        sentenceBuffer += chunk;
        sendEvent({ type: "text_chunk", texto: chunk });
        flushSentenceBuffer(false);
      }
    }

    flushSentenceBuffer(true);

    await Promise.all(ttsPromises);

    await Promise.all([
      db.insert(mensagens).values({ conversaId: conversa.id, papel: "agente", conteudo: textoCompleto }),
      simulacaoInjetada
        ? db.update(conversas).set({ simulacaoRealizada: true }).where(eq(conversas.id, conversa.id))
        : Promise.resolve(),
    ]);

    sendEvent({
      type: "done",
      encerrar: detectarEncerramento(textoCompleto),
      texto_completo: textoCompleto,
    });
    res.end();
  } catch (err) {
    logger.error({ err }, "Erro no streaming do agente");
    if (!res.writableEnded) {
      sendEvent({ type: "error", mensagem: "Erro interno do servidor" });
      res.end();
    }
  }
});

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
  const prompt = `Analise esta conversa de venda de veículo e extraia as informações em JSON estrito, sem markdown:
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
      resumo: "Conversa encerrada sem extração de dados.",
    };
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
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

  const obj = parsed as Record<string, unknown>;

  const interesse =
    obj["interesse"] === "alto" || obj["interesse"] === "medio" || obj["interesse"] === "baixo"
      ? (obj["interesse"] as "alto" | "medio" | "baixo")
      : "baixo";

  return {
    nome: typeof obj["nome"] === "string" ? obj["nome"] : null,
    telefone: typeof obj["telefone"] === "string" ? obj["telefone"] : null,
    email: typeof obj["email"] === "string" ? obj["email"] : null,
    interesse,
    pediu_financiamento: Boolean(obj["pediu_financiamento"]),
    pediu_test_drive: Boolean(obj["pediu_test_drive"]),
    resumo: typeof obj["resumo"] === "string" ? obj["resumo"] : "Conversa encerrada.",
  };
}

router.post("/agente/encerrar", async (req, res): Promise<void> => {
  const body = EncerrarSessaoAgenteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const { slug, conversa_id, nome: nomeManual, telefone: telefoneManual, email: emailManual } = body.data;

  const resolved = await resolveConversaComSlug(conversa_id, slug);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }

  const { conversa, veiculo } = resolved;

  if (conversa.encerradaEm) {
    const leadExistente = conversa.leadId
      ? await db.select().from(leads).where(eq(leads.id, conversa.leadId)).limit(1).then((r) => r[0] ?? null)
      : null;
    res.json({
      lead_id: leadExistente?.id ?? null,
      duracao_segundos: conversa.duracaoSegundos ?? 0,
      resumo: conversa.resumoIa ?? "Conversa encerrada.",
    });
    return;
  }

  const encerradaEm = new Date();
  const duracaoSegundos = Math.floor(
    (encerradaEm.getTime() - conversa.iniciadaEm.getTime()) / 1000,
  );

  const historico = await db
    .select()
    .from(mensagens)
    .where(eq(mensagens.conversaId, conversa.id))
    .orderBy(asc(mensagens.criadoEm));

  const transcricao = historico
    .map((m) => `${m.papel === "user" ? "Usuário" : "Agente"}: ${m.conteudo}`)
    .join("\n");

  const leadExtraido = await extrairLeadDaTranscricao(transcricao).catch((err) => {
    logger.warn({ err }, "Falha ao extrair lead da transcrição");
    return {
      nome: null,
      telefone: null,
      email: null,
      interesse: "baixo" as const,
      pediu_financiamento: false,
      pediu_test_drive: false,
      resumo: "Conversa encerrada.",
    };
  });

  const nomeF = nomeManual ?? leadExtraido.nome;
  const telefoneF = telefoneManual ?? leadExtraido.telefone;
  const emailF = emailManual ?? leadExtraido.email;

  const [lead] = await db
    .insert(leads)
    .values({
      veiculoId: conversa.veiculoId,
      lojaId: veiculo.lojaId,
      nome: nomeF ?? null,
      telefone: telefoneF ?? null,
      email: emailF ?? null,
      interesse: leadExtraido.interesse,
      pediuFinanciamento: leadExtraido.pediu_financiamento,
      pediuTestDrive: leadExtraido.pediu_test_drive,
      statusCrm: "novo",
      origem: "qr_patio",
    })
    .returning();

  const leadId = lead.id;

  await Promise.all([
    db.update(conversas).set({ leadId: lead.id }).where(eq(conversas.id, conversa.id)),
    db.update(conversas).set({
      encerradaEm,
      duracaoSegundos,
      transcricao,
      resumoIa: leadExtraido.resumo,
      simulacaoRealizada: conversa.simulacaoRealizada || leadExtraido.pediu_financiamento,
    }).where(eq(conversas.id, conversa.id)),
  ]);

  res.json({
    lead_id: leadId,
    duracao_segundos: duracaoSegundos,
    resumo: leadExtraido.resumo,
  });
});

export default router;
