import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import {
  getVeiculoPublico,
  iniciarSessao,
  enviarMensagemStream,
  encerrarSessao,
  base64ToAudioUrl,
  type VeiculoPublico,
  type LojaPublica,
} from "@/lib/api";

type Mensagem = {
  papel: "user" | "agente";
  texto: string;
};

type EstadoSessao =
  | "carregando"
  | "landing"
  | "lgpd"
  | "iniciando"
  | "pronto"
  | "gravando"
  | "processando"
  | "sem_microfone"
  | "encerrado"
  | "erro";

type AudioItem = { index: number; url: string };

function formatarPreco(preco: string): string {
  return Number(preco).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarKm(km: number): string {
  return km.toLocaleString("pt-BR") + " km";
}

function VeiculoCard({ veiculo, loja }: { veiculo: VeiculoPublico; loja: LojaPublica }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wider font-medium">{loja.nome_fantasia}</p>
          <h2 className="text-white font-bold text-xl mt-0.5">
            {veiculo.marca} {veiculo.modelo}
          </h2>
          <p className="text-white/70 text-sm">
            {veiculo.ano_fabricacao}/{veiculo.ano_modelo} · {formatarKm(veiculo.quilometragem)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-xs">Preço</p>
          <p className="text-emerald-300 font-bold text-lg">{formatarPreco(veiculo.preco_venda)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {veiculo.cor && (
          <span className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-full">{veiculo.cor}</span>
        )}
        {veiculo.cambio && (
          <span className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-full capitalize">{veiculo.cambio}</span>
        )}
        {veiculo.combustivel && (
          <span className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-full capitalize">{veiculo.combustivel}</span>
        )}
      </div>
    </div>
  );
}

function WaveformAnimation({ ativo }: { ativo: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-all duration-150 ${ativo ? "bg-emerald-400" : "bg-white/30"}`}
          style={{
            height: ativo ? `${Math.random() * 24 + 8}px` : "8px",
            animation: ativo ? `wave ${0.5 + i * 0.1}s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

export default function AgenteVoz() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [estado, setEstado] = useState<EstadoSessao>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [veiculo, setVeiculo] = useState<VeiculoPublico | null>(null);
  const [loja, setLoja] = useState<LojaPublica | null>(null);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [consentimento, setConsentimento] = useState(false);
  const [textoAgenteAtual, setTextoAgenteAtual] = useState<string | null>(null);

  const [nomeLead, setNomeLead] = useState("");
  const [telefoneLead, setTelefoneLead] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mensagensEndRef = useRef<HTMLDivElement>(null);

  const audioQueueRef = useRef<AudioItem[]>([]);
  const nextToPlayRef = useRef(0);
  const isPlayingAudioRef = useRef(false);

  useEffect(() => {
    mensagensEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, textoAgenteAtual]);

  useEffect(() => {
    if (!slug) return;
    getVeiculoPublico(slug)
      .then((data) => {
        if (!data.disponivel || !data.veiculo || !data.loja) {
          setErro(data.mensagem ?? "Veículo não disponível");
          setEstado("erro");
          return;
        }
        setVeiculo(data.veiculo);
        setLoja(data.loja);
        setEstado("landing");
      })
      .catch((err) => {
        setErro(err.message ?? "Erro ao carregar veículo");
        setEstado("erro");
      });
  }, [slug]);

  const playNextInQueue = useCallback(() => {
    const next = audioQueueRef.current.find((a) => a.index === nextToPlayRef.current);
    if (!next) {
      isPlayingAudioRef.current = false;
      return;
    }
    audioQueueRef.current = audioQueueRef.current.filter((a) => a.index !== next.index);
    nextToPlayRef.current++;

    if (!next.url) {
      playNextInQueue();
      return;
    }

    isPlayingAudioRef.current = true;

    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(next.url);
    audioRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(next.url);
      playNextInQueue();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(next.url);
      playNextInQueue();
    };
    audio.play().catch(() => playNextInQueue());
  }, []);

  const onAudioChunk = useCallback(
    (index: number, base64: string) => {
      const url = base64 ? base64ToAudioUrl(base64, "audio/mpeg") : "";
      audioQueueRef.current.push({ index, url });
      if (!isPlayingAudioRef.current) {
        playNextInQueue();
      }
    },
    [playNextInQueue],
  );

  const resetAudioQueue = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioQueueRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    audioQueueRef.current = [];
    nextToPlayRef.current = 0;
    isPlayingAudioRef.current = false;
  }, []);

  const playAudio = useCallback(
    (base64: string) => {
      resetAudioQueue();
      const url = base64ToAudioUrl(base64, "audio/mpeg");
      const audio = new Audio(url);
      audioRef.current = audio;
      isPlayingAudioRef.current = true;
      audio.play().catch(() => {});
      audio.onended = () => {
        URL.revokeObjectURL(url);
        isPlayingAudioRef.current = false;
      };
    },
    [resetAudioQueue],
  );

  const handleIniciarSessao = useCallback(async () => {
    if (!slug || !consentimento) return;
    setEstado("iniciando");
    try {
      const sessao = await iniciarSessao(slug, true);
      setConversaId(sessao.conversa_id);
      setVeiculo(sessao.veiculo);
      setLoja(sessao.loja);
      setMensagens([{ papel: "agente", texto: sessao.saudacao_texto }]);
      if (sessao.saudacao_audio) {
        playAudio(sessao.saudacao_audio);
      }
      setEstado("pronto");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao iniciar sessão");
      setEstado("erro");
    }
  }, [slug, consentimento, playAudio]);

  const handleGravarInicio = useCallback(async () => {
    if (estado !== "pronto") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado("sem_microfone");
      return;
    }
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000,
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;

      if (typeof AudioContext !== "undefined" && typeof AudioWorkletNode !== "undefined") {
        try {
          const ctx = new AudioContext({ sampleRate: 16000 });
          audioContextRef.current = ctx;
          await ctx.audioWorklet.addModule("/audio-processor.js");
          const source = ctx.createMediaStreamSource(stream);
          const workletNode = new AudioWorkletNode(ctx, "audio-capture-processor");
          workletNodeRef.current = workletNode;
          source.connect(workletNode);
          workletNode.connect(ctx.destination);
          setEstado("gravando");
          return;
        } catch {
        }
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setEstado("gravando");
    } catch {
      setEstado("sem_microfone");
    }
  }, [estado]);

  const float32ToWavBase64 = useCallback((samples: Float32Array, sampleRate: number): string => {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, numSamples * 2, true);
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }, []);

  const handleGravarFim = useCallback(async () => {
    if (estado !== "gravando") return;
    setEstado("processando");

    let base64: string;
    let formato: "wav" | "webm" | "mp4" = "webm";

    if (workletNodeRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const sampleRate = ctx.sampleRate;
      const pcmData = await new Promise<Float32Array>((resolve) => {
        workletNodeRef.current!.port.onmessage = (e: MessageEvent<{ type: string; buffer: Float32Array }>) => {
          if (e.data.type === "done") resolve(e.data.buffer);
        };
        workletNodeRef.current!.port.postMessage("stop");
      });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
      await ctx.close();
      audioContextRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      base64 = float32ToWavBase64(pcmData, sampleRate);
      formato = "wav";
    } else if (mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      mr.stream.getTracks().forEach((t) => t.stop());
      await new Promise<void>((resolve) => {
        mr.onstop = () => resolve();
        mr.stop();
      });
      const actualMime = mr.mimeType || "audio/webm";
      formato = actualMime.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: actualMime });
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      base64 = btoa(bin);
      mediaRecorderRef.current = null;
    } else {
      setEstado("pronto");
      return;
    }

    resetAudioQueue();
    setTextoAgenteAtual("");

    let textoUsuario = "";
    let textoAgente = "";

    try {
      await enviarMensagemStream(slug!, conversaId!, base64, formato, {
        onTranscricao: (txt) => {
          textoUsuario = txt;
          setMensagens((prev) => [...prev, { papel: "user", texto: txt }]);
        },
        onTextChunk: (chunk) => {
          textoAgente += chunk;
          setTextoAgenteAtual((prev) => (prev ?? "") + chunk);
        },
        onAudioChunk: (index, audioBase64) => {
          onAudioChunk(index, audioBase64);
        },
        onDone: (encerrar, textoCompleto) => {
          setTextoAgenteAtual(null);
          setMensagens((prev) => [
            ...prev,
            { papel: "agente", texto: textoCompleto || textoAgente },
          ]);
          if (encerrar) {
            setMostrarFormulario(true);
            setEstado("encerrado");
          } else {
            setEstado("pronto");
          }
        },
        onError: (mensagem) => {
          setTextoAgenteAtual(null);
          setErro(mensagem);
          setEstado("pronto");
        },
      });
    } catch (err: unknown) {
      setTextoAgenteAtual(null);
      const msg = err instanceof Error ? err.message : "Falha ao processar mensagem";
      setErro(msg);
      setEstado("pronto");
    }
  }, [estado, slug, conversaId, onAudioChunk, resetAudioQueue, float32ToWavBase64]);

  const sessaoEncerradaRef = useRef(false);

  const encerrarSessaoServidor = useCallback(
    async (dados?: { nome?: string; telefone?: string }) => {
      if (sessaoEncerradaRef.current || !conversaId || !slug) return;
      sessaoEncerradaRef.current = true;
      try {
        await encerrarSessao(slug, conversaId, dados);
      } catch {
      }
    },
    [slug, conversaId],
  );

  const handleEncerrar = useCallback(() => {
    if (!conversaId) return;
    resetAudioQueue();
    setMostrarFormulario(true);
    setEstado("encerrado");
  }, [conversaId, resetAudioQueue]);

  const handleEnviarLead = useCallback(async () => {
    setMostrarFormulario(false);
    await encerrarSessaoServidor({
      nome: nomeLead || undefined,
      telefone: telefoneLead || undefined,
    });
  }, [encerrarSessaoServidor, nomeLead, telefoneLead]);

  const handlePularFormulario = useCallback(() => {
    setMostrarFormulario(false);
    encerrarSessaoServidor();
  }, [encerrarSessaoServidor]);

  if (estado === "carregando") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-white/60 mt-4 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Veículo indisponível</h2>
          <p className="text-white/60 text-sm">{erro ?? "Este veículo não está disponível para o agente de voz."}</p>
        </div>
      </div>
    );
  }

  if (estado === "landing" && veiculo && loja) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🤖</span>
            </div>
            <h1 className="text-white text-2xl font-bold">Pátio AI</h1>
            <p className="text-white/60 text-sm mt-1">Agente de Voz Inteligente</p>
          </div>
          <VeiculoCard veiculo={veiculo} loja={loja} />
          <button
            onClick={() => setEstado("lgpd")}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all
              bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400
              active:scale-95"
          >
            🎙️ Falar com assistente
          </button>
        </div>
      </div>
    );
  }

  if (estado === "lgpd" && veiculo && loja) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <VeiculoCard veiculo={veiculo} loja={loja} />
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
            <h3 className="text-white font-semibold text-base mb-2">Antes de começar</h3>
            <p className="text-white/60 text-xs leading-relaxed">
              Esta conversa será gravada e processada por inteligência artificial. Seus dados serão usados
              exclusivamente para atendimento desta loja, conforme a{" "}
              <span className="text-blue-400">LGPD</span>.
            </p>
            <label className="flex items-center gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-white/80 text-xs">Aceito os termos e autorizo a gravação</span>
            </label>
          </div>
          <button
            onClick={handleIniciarSessao}
            disabled={!consentimento}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all
              bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400
              disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            Iniciar conversa
          </button>
          <button
            onClick={() => setEstado("landing")}
            className="w-full py-2 text-white/40 text-sm"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (estado === "iniciando") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">🤖</span>
          </div>
          <p className="text-white font-medium">Preparando o agente...</p>
          <p className="text-white/40 text-sm mt-1">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      <div className="p-4 border-b border-white/10">
        {veiculo && loja && <VeiculoCard veiculo={veiculo} loja={loja} />}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensagens.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.papel === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.papel === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white/10 text-white/90 rounded-bl-sm border border-white/10"
              }`}
            >
              {msg.papel === "agente" && (
                <p className="text-emerald-400 text-xs font-medium mb-1">🤖 Pátio AI</p>
              )}
              {msg.texto}
            </div>
          </div>
        ))}

        {textoAgenteAtual !== null && (
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-white/10 rounded-2xl rounded-bl-sm px-4 py-2.5 border border-white/10">
              <p className="text-emerald-400 text-xs font-medium mb-1">🤖 Pátio AI</p>
              {textoAgenteAtual ? (
                <p className="text-white/90 text-sm leading-relaxed">{textoAgenteAtual}</p>
              ) : (
                <div className="flex gap-1 py-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {estado === "processando" && textoAgenteAtual === null && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3 border border-white/10">
              <p className="text-emerald-400 text-xs font-medium mb-1">🤖 Pátio AI</p>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={mensagensEndRef} />
      </div>

      {mostrarFormulario ? (
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-white font-medium text-sm mb-3">
              Quer receber mais informações? (opcional)
            </h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Seu nome"
                value={nomeLead}
                onChange={(e) => setNomeLead(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400"
              />
              <input
                type="tel"
                placeholder="Seu telefone (WhatsApp)"
                value={telefoneLead}
                onChange={(e) => setTelefoneLead(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={handleEnviarLead}
              className="w-full mt-3 py-3 rounded-xl font-semibold text-white text-sm
                bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400
                active:scale-95 transition-all"
            >
              Enviar e finalizar
            </button>
            <button
              onClick={handlePularFormulario}
              className="w-full mt-2 py-2 text-white/40 text-xs"
            >
              Pular
            </button>
          </div>
        </div>
      ) : estado === "encerrado" ? (
        <div className="p-4 border-t border-white/10 text-center">
          <p className="text-white/60 text-sm">Conversa encerrada. Obrigado!</p>
        </div>
      ) : estado === "sem_microfone" ? (
        <div className="p-4 border-t border-white/10">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-3">
            <p className="text-yellow-300 font-medium text-sm mb-1">🎙️ Microfone indisponível</p>
            <p className="text-yellow-200/70 text-xs leading-relaxed">
              Não foi possível acessar o microfone. Verifique as permissões do navegador ou deixe seu contato para o vendedor entrar em contato.
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Seu nome"
              value={nomeLead}
              onChange={(e) => setNomeLead(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400"
            />
            <input
              type="tel"
              placeholder="Seu telefone (WhatsApp)"
              value={telefoneLead}
              onChange={(e) => setTelefoneLead(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <button
            onClick={handleEnviarLead}
            className="w-full mt-3 py-3 rounded-xl font-semibold text-white text-sm
              bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400
              active:scale-95 transition-all"
          >
            Enviar contato
          </button>
          <button
            onClick={() => setEstado("pronto")}
            className="w-full mt-2 py-2 text-white/40 text-xs"
          >
            Tentar microfone novamente
          </button>
        </div>
      ) : (
        <div className="p-4 border-t border-white/10">
          {erro && (
            <p className="text-red-400 text-xs text-center mb-3 bg-red-500/10 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <WaveformAnimation ativo={estado === "gravando"} />

          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onPointerDown={handleGravarInicio}
              onPointerUp={handleGravarFim}
              disabled={estado === "processando"}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all
                ${estado === "gravando"
                  ? "bg-red-500 scale-110 shadow-lg shadow-red-500/40"
                  : "bg-gradient-to-br from-blue-500 to-emerald-500 hover:scale-105 shadow-lg shadow-blue-500/30"
                }
                disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
            >
              {estado === "gravando" ? "⏹️" : estado === "processando" ? "⏳" : "🎙️"}
            </button>

            <button
              onClick={handleEncerrar}
              className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xl
                hover:bg-white/20 active:scale-95 transition-all"
              title="Encerrar conversa"
            >
              📴
            </button>
          </div>

          <p className="text-white/40 text-xs text-center mt-3">
            {estado === "gravando"
              ? "Solte para enviar"
              : estado === "processando"
              ? "Processando..."
              : "Segure para falar"}
          </p>
        </div>
      )}

      <style>{`
        @keyframes wave {
          0% { height: 8px; }
          100% { height: 32px; }
        }
      `}</style>
    </div>
  );
}
