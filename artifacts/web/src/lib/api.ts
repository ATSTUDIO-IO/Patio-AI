const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getApiBase(): string {
  if (import.meta.env.DEV) {
    return "/api";
  }
  return "/api";
}

const API = getApiBase();

export type VeiculoPublico = {
  id: string;
  marca: string;
  modelo: string;
  ano_fabricacao: number;
  ano_modelo: number;
  quilometragem: number;
  preco_venda: string;
  cor: string | null;
  cambio: string | null;
  combustivel: string | null;
  opcionais: string[] | null;
  slug: string;
};

export type LojaPublica = {
  nome_fantasia: string;
  cidade: string | null;
  telefone: string | null;
};

export type IniciarSessaoResponse = {
  conversa_id: string;
  veiculo: VeiculoPublico;
  loja: LojaPublica;
  saudacao_audio: string;
  saudacao_texto: string;
};

export type MensagemAgenteResponse = {
  texto_usuario: string;
  texto_agente: string;
  audio_agente: string;
  encerrar: boolean;
};

export type EncerrarSessaoResponse = {
  lead_id: string | null;
  duracao_segundos: number;
  resumo: string;
};

export type StreamMensagemCallbacks = {
  onTranscricao?: (texto: string) => void;
  onTextChunk?: (texto: string) => void;
  onAudioChunk?: (index: number, audioBase64: string, texto: string) => void;
  onDone?: (encerrar: boolean, textoCompleto: string) => void;
  onError?: (mensagem: string) => void;
};

export async function getVeiculoPublico(slug: string): Promise<{
  disponivel: boolean;
  veiculo: VeiculoPublico | null;
  loja: LojaPublica | null;
  mensagem: string | null;
}> {
  const res = await fetch(`${API}/v/${slug}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error ?? "Falha ao carregar veículo");
  }
  return res.json();
}

export async function iniciarSessao(
  slug: string,
  consentimentoLgpd: boolean,
): Promise<IniciarSessaoResponse> {
  const res = await fetch(`${API}/agente/sessao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, consentimento_lgpd: consentimentoLgpd }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error ?? "Falha ao iniciar sessão");
  }
  return res.json();
}

export async function enviarMensagem(
  slug: string,
  conversaId: string,
  audioBase64: string,
  formato: string = "webm",
): Promise<MensagemAgenteResponse> {
  const res = await fetch(`${API}/agente/mensagem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      conversa_id: conversaId,
      audio_base64: audioBase64,
      formato,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error ?? "Falha ao enviar mensagem");
  }
  return res.json();
}

export async function enviarMensagemStream(
  slug: string,
  conversaId: string,
  audioBase64: string,
  formato: string = "webm",
  callbacks: StreamMensagemCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API}/agente/mensagem/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      conversa_id: conversaId,
      audio_base64: audioBase64,
      formato,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error ?? "Falha ao enviar mensagem");
  }

  if (!res.body) {
    throw new Error("Stream não disponível");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }

        const type = event.type as string;

        if (type === "transcricao") {
          callbacks.onTranscricao?.(event.texto as string);
        } else if (type === "text_chunk") {
          callbacks.onTextChunk?.(event.texto as string);
        } else if (type === "audio_chunk") {
          callbacks.onAudioChunk?.(
            event.index as number,
            event.audio_base64 as string,
            event.texto as string,
          );
        } else if (type === "done") {
          callbacks.onDone?.(event.encerrar as boolean, event.texto_completo as string);
        } else if (type === "error") {
          callbacks.onError?.(event.mensagem as string);
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function encerrarSessao(
  slug: string,
  conversaId: string,
  dados?: { nome?: string; telefone?: string; email?: string },
): Promise<EncerrarSessaoResponse> {
  const res = await fetch(`${API}/agente/encerrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, conversa_id: conversaId, ...dados }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error ?? "Falha ao encerrar sessão");
  }
  return res.json();
}

export function base64ToAudioUrl(base64: string, mimeType = "audio/mpeg"): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}
