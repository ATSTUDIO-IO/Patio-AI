import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, qrcodes, veiculos, lojas, conversas, mensagens, leads } from "@workspace/db";
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

const router: IRouter = Router();

const SYSTEM_PROMPT = (veiculo: {
  marca: string;
  modelo: string;
  anoFabricacao: number;
  anoModelo: number;
  quilometragem: number;
  precoVenda: string;
  cor: string | null;
  cambio: string | null;
  combustivel: string | null;
  opcionais: string[] | null;
  descricaoAgente: string | null;
}, loja: { nomeFantasia: string; cidade: string | null }) => `Você é o Pátio AI, um agente de voz especialista em vendas de veículos seminovos para a loja "${loja.nomeFantasia}"${loja.cidade ? ` em ${loja.cidade}` : ""}.

Veículo em destaque:
- Modelo: ${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao}/${veiculo.anoModelo}
- Quilometragem: ${veiculo.quilometragem.toLocaleString("pt-BR")} km
- Preço: R$ ${Number(veiculo.precoVenda).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
${veiculo.cor ? `- Cor: ${veiculo.cor}` : ""}
${veiculo.cambio ? `- Câmbio: ${veiculo.cambio}` : ""}
${veiculo.combustivel ? `- Combustível: ${veiculo.combustivel}` : ""}
${veiculo.opcionais && veiculo.opcionais.length > 0 ? `- Opcionais: ${veiculo.opcionais.join(", ")}` : ""}
${veiculo.descricaoAgente ? `\nInformações adicionais: ${veiculo.descricaoAgente}` : ""}

Seu objetivo:
1. Apresentar o veículo de forma entusiasmada e profissional
2. Responder perguntas sobre o veículo, financiamento e test drive
3. Coletar nome, telefone e e-mail do lead de forma natural
4. Para financiamento: pergunte valor de entrada desejado e simule parcelas estimadas
5. Sempre em Português Brasileiro, tom amigável e direto

Regras importantes:
- Respostas curtas e conversacionais (máx 3 frases por turno)
- Se o lead quiser test drive, confirme entusiasmo e peça contato
- Se quiser encerrar, agradeça e despede-se profissionalmente
- NUNCA invente especificações que não foram fornecidas
- Se não souber responder, diga que vai verificar com a equipe`;

function gerarSaudacao(veiculo: { marca: string; modelo: string; anoFabricacao: number }, loja: { nomeFantasia: string }): string {
  return `Olá! Bem-vindo ao Pátio AI, o assistente virtual da ${loja.nomeFantasia}! Vi que você se interessou pelo ${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao}. Fico feliz em apresentar esse veículo incrível pra você! Pode fazer suas perguntas, estou aqui pra ajudar.`;
}

router.post("/agente/sessao", async (req, res): Promise<void> => {
  const body = IniciarSessaoAgenteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const { slug, consentimento_lgpd } = body.data;

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

  const saudacaoTexto = gerarSaudacao(
    { marca: veiculo.marca, modelo: veiculo.modelo, anoFabricacao: veiculo.anoFabricacao },
    { nomeFantasia: loja.nomeFantasia },
  );

  await db.insert(mensagens).values({
    conversaId: conversa.id,
    papel: "agente",
    conteudo: saudacaoTexto,
  });

  let saudacaoAudio = "";
  try {
    const audioBuffer = await textToSpeech(saudacaoTexto, "nova", "mp3");
    saudacaoAudio = audioBuffer.toString("base64");
  } catch (err) {
    logger.warn({ err }, "Falha ao gerar áudio da saudação, retornando vazio");
  }

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

router.post("/agente/mensagem", async (req, res): Promise<void> => {
  const body = EnviarMensagemAgenteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const { conversa_id, audio_base64, formato } = body.data;

  const [conversa] = await db
    .select()
    .from(conversas)
    .where(eq(conversas.id, conversa_id))
    .limit(1);

  if (!conversa || conversa.encerradaEm) {
    res.status(404).json({ error: "Sessão não encontrada ou encerrada" });
    return;
  }

  const [veiculo] = await db
    .select()
    .from(veiculos)
    .where(eq(veiculos.id, conversa.veiculoId))
    .limit(1);

  const [loja] = await db
    .select()
    .from(lojas)
    .where(eq(lojas.id, veiculo!.lojaId))
    .limit(1);

  const audioBuffer = Buffer.from(audio_base64, "base64");
  const { buffer: compatBuffer, format: compatFormat } = await ensureCompatibleFormat(audioBuffer);

  const textoUsuario = await speechToText(compatBuffer, compatFormat);

  await db.insert(mensagens).values({
    conversaId: conversa.id,
    papel: "user",
    conteudo: textoUsuario,
  });

  const historicoMsgs = await db
    .select()
    .from(mensagens)
    .where(eq(mensagens.conversaId, conversa.id))
    .orderBy(asc(mensagens.criadoEm));

  const systemPrompt = SYSTEM_PROMPT(
    {
      marca: veiculo!.marca,
      modelo: veiculo!.modelo,
      anoFabricacao: veiculo!.anoFabricacao,
      anoModelo: veiculo!.anoModelo,
      quilometragem: veiculo!.quilometragem,
      precoVenda: veiculo!.precoVenda,
      cor: veiculo!.cor,
      cambio: veiculo!.cambio,
      combustivel: veiculo!.combustivel,
      opcionais: veiculo!.opcionais,
      descricaoAgente: veiculo!.descricaoAgente,
    },
    { nomeFantasia: loja!.nomeFantasia, cidade: loja!.cidade },
  );

  const claudeMsgs = historicoMsgs.map((m) => ({
    role: m.papel === "user" ? ("user" as const) : ("assistant" as const),
    content: m.conteudo,
  }));

  const claudeResp = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    system: systemPrompt,
    messages: claudeMsgs,
  });

  const textoAgente = claudeResp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  await db.insert(mensagens).values({
    conversaId: conversa.id,
    papel: "agente",
    conteudo: textoAgente,
  });

  let audioAgente = "";
  try {
    const audioBuffer2 = await textToSpeech(textoAgente, "nova", "mp3");
    audioAgente = audioBuffer2.toString("base64");
  } catch (err) {
    logger.warn({ err }, "Falha ao gerar TTS da resposta");
  }

  const encerrar =
    textoAgente.toLowerCase().includes("até logo") ||
    textoAgente.toLowerCase().includes("tchau") ||
    textoAgente.toLowerCase().includes("obrigado pela visita") ||
    textoAgente.toLowerCase().includes("boa sorte") ||
    textoAgente.toLowerCase().includes("até breve");

  res.json({
    texto_usuario: textoUsuario,
    texto_agente: textoAgente,
    audio_agente: audioAgente,
    encerrar,
  });
});

router.post("/agente/encerrar", async (req, res): Promise<void> => {
  const body = EncerrarSessaoAgenteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const { conversa_id, nome, telefone, email } = body.data;

  const [conversa] = await db
    .select()
    .from(conversas)
    .where(eq(conversas.id, conversa_id))
    .limit(1);

  if (!conversa) {
    res.status(404).json({ error: "Sessão não encontrada" });
    return;
  }

  const iniciadaEm = conversa.iniciadaEm;
  const encerradaEm = new Date();
  const duracaoSegundos = Math.floor(
    (encerradaEm.getTime() - iniciadaEm.getTime()) / 1000,
  );

  const historicoMsgs = await db
    .select()
    .from(mensagens)
    .where(eq(mensagens.conversaId, conversa.id))
    .orderBy(asc(mensagens.criadoEm));

  const transcricao = historicoMsgs
    .map((m) => `${m.papel === "user" ? "Usuário" : "Agente"}: ${m.conteudo}`)
    .join("\n");

  let resumo = "";
  let pediuFinanciamento = false;
  let pediuTestDrive = false;
  let interesse: "alto" | "medio" | "baixo" = "baixo";

  try {
    const resumoResp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analise esta conversa de venda de veículo e responda em JSON:
{
  "resumo": "resumo breve da conversa em 2-3 frases",
  "interesse": "alto|medio|baixo",
  "pediu_financiamento": true|false,
  "pediu_test_drive": true|false
}

Conversa:
${transcricao}`,
        },
      ],
    });

    const jsonText = resumoResp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      resumo = parsed.resumo ?? "";
      pediuFinanciamento = parsed.pediu_financiamento ?? false;
      pediuTestDrive = parsed.pediu_test_drive ?? false;
      interesse = parsed.interesse ?? "baixo";
    }
  } catch (err) {
    logger.warn({ err }, "Falha ao gerar resumo da conversa");
    resumo = "Conversa encerrada.";
  }

  const [veiculo] = await db
    .select()
    .from(veiculos)
    .where(eq(veiculos.id, conversa.veiculoId))
    .limit(1);

  let leadId: string | null = null;
  if (nome || telefone || email) {
    const [lead] = await db
      .insert(leads)
      .values({
        veiculoId: conversa.veiculoId,
        lojaId: veiculo!.lojaId,
        nome: nome ?? null,
        telefone: telefone ?? null,
        email: email ?? null,
        interesse,
        pediuFinanciamento,
        pediuTestDrive,
        statusCrm: "novo",
        origem: "qr_patio",
      })
      .returning();
    leadId = lead.id;

    await db
      .update(conversas)
      .set({ leadId: lead.id })
      .where(eq(conversas.id, conversa.id));
  }

  await db
    .update(conversas)
    .set({
      encerradaEm,
      duracaoSegundos,
      transcricao,
      resumoIa: resumo,
      simulacaoRealizada: pediuFinanciamento,
    })
    .where(eq(conversas.id, conversa.id));

  res.json({
    lead_id: leadId,
    duracao_segundos: duracaoSegundos,
    resumo,
  });
});

export default router;
