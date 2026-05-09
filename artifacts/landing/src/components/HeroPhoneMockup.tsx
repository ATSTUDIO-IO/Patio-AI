import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode } from "lucide-react";

type Phase = 0 | 1 | 2;

const PHASE_MS: [number, number, number] = [3500, 7500, 3500];

interface ChatMsg { from: "user" | "ai"; text: string; ms: number; }
const DEMO_MSGS: ChatMsg[] = [
  { from: "user", text: "Quanto custa esse Civic?", ms: 600 },
  { from: "ai",   text: "Civic 2022 — R$89.900. Com 20% entrada: R$1.680/mês em 48x! 🚗", ms: 1900 },
  { from: "user", text: "Aceita meu carro na troca?", ms: 4100 },
  { from: "ai",   text: "Claro! Me fala o modelo e o ano. Qual seu nome?", ms: 5600 },
];

const INDIGO = "hsl(244 47% 20%)";
const CYAN   = "hsl(189 94% 43%)";

function PhaseQR() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 pt-5"
      style={{ backgroundColor: "#030712" }}
    >
      <p className="text-gray-500 text-[9px] uppercase tracking-[0.18em]">Escaneie para atendimento</p>

      <div className="relative w-36 h-36 flex items-center justify-center">
        {[["top-0 left-0","border-t-2 border-l-2 rounded-tl"],
          ["top-0 right-0","border-t-2 border-r-2 rounded-tr"],
          ["bottom-0 left-0","border-b-2 border-l-2 rounded-bl"],
          ["bottom-0 right-0","border-b-2 border-r-2 rounded-br"]
        ].map(([pos, bord], i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.12 }}
            className={`absolute w-5 h-5 border-cyan-accent ${pos} ${bord}`}
          />
        ))}

        <motion.div
          animate={{ boxShadow: [`0 0 0px rgba(6,182,212,0)`, `0 0 22px rgba(6,182,212,0.55)`, `0 0 0px rgba(6,182,212,0)`] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="bg-white p-2.5 rounded-lg"
        >
          <QrCode className="w-14 h-14 text-gray-900" strokeWidth={1.5} />
        </motion.div>

        <motion.div
          animate={{ y: [-54, 54, -54] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          className="absolute left-2 right-2 h-px"
          style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}` }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
        style={{ background: "rgba(6,182,212,0.08)", borderColor: "rgba(6,182,212,0.3)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: CYAN }} />
        <span className="text-[9px] font-semibold" style={{ color: CYAN }}>Honda Civic 2022 · R$89.900</span>
      </motion.div>
    </motion.div>
  );
}

function PhaseChat({ visible }: { visible: number[] }) {
  const showTyping = visible.includes(0) && !visible.includes(1);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col"
    >
      <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-7 pb-2.5" style={{ background: INDIGO }}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
             style={{ background: CYAN, color: INDIGO }}>IA</div>
        <div>
          <p className="text-white text-[10px] font-semibold">Consultor PátioAI</p>
          <p className="text-[8px]" style={{ color: CYAN }}>● Online agora</p>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 p-3 flex flex-col gap-2 overflow-hidden">
        <AnimatePresence>
          {DEMO_MSGS.map((msg, i) =>
            visible.includes(i) ? (
              <motion.div key={i}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] text-[10px] leading-snug py-1.5 px-2.5 rounded-xl shadow-sm ${
                    msg.from === "user" ? "text-white rounded-tr-sm" : "bg-white border border-gray-200 text-gray-700 rounded-tl-sm"
                  }`}
                  style={msg.from === "user" ? { background: INDIGO } : undefined}
                >
                  {msg.text}
                </div>
              </motion.div>
            ) : null
          )}
        </AnimatePresence>

        {showTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl rounded-tl-sm px-2 py-1.5 flex gap-0.5">
              {[0, 0.15, 0.3].map((d, i) => (
                <motion.div key={i} className="w-1 h-1 rounded-full bg-gray-400"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: d }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
        <div className="flex-1 bg-gray-100 rounded-full h-7 px-3 flex items-center">
          <span className="text-gray-400 text-[9px]">Mensagem...</span>
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: INDIGO }}>
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

const CONFETTI_DOTS = [
  { angle: 0,   color: "#06b6d4", r: 3,   dist: 44 },
  { angle: 40,  color: "#34d399", r: 2.5, dist: 38 },
  { angle: 80,  color: "#a78bfa", r: 3,   dist: 46 },
  { angle: 120, color: "#f472b6", r: 2,   dist: 36 },
  { angle: 160, color: "#fbbf24", r: 3,   dist: 42 },
  { angle: 200, color: "#06b6d4", r: 2,   dist: 40 },
  { angle: 240, color: "#34d399", r: 3,   dist: 44 },
  { angle: 280, color: "#f472b6", r: 2.5, dist: 38 },
  { angle: 320, color: "#fbbf24", r: 2,   dist: 42 },
];

function PhaseLeadCaptured() {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center gap-3 pt-6 px-4"
    >
      <div className="relative flex items-center justify-center">
        {/* Confetti burst */}
        {CONFETTI_DOTS.map((dot, i) => {
          const rad = (dot.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * dot.dist;
          const ty = Math.sin(rad) * dot.dist;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], x: tx, y: ty, scale: [0, 1.4, 0.8] }}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.03, ease: "easeOut" as const }}
              className="absolute rounded-full pointer-events-none"
              style={{ width: dot.r * 2, height: dot.r * 2, background: dot.color }}
            />
          );
        })}

        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 22, delay: 0.2 }}
          className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center relative z-10"
          style={{ boxShadow: "0 8px 24px rgba(34,197,94,0.4)" }}
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="text-center"
      >
        <p className="text-gray-900 font-bold text-sm">Lead Capturado!</p>
        <p className="text-gray-400 text-[9px] mt-0.5">Enviado ao CRM automaticamente</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
        className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2"
      >
        {[["Nome","Paulo Souza"],["Telefone","(11) 99876-5432"],["Veículo","Civic 2022 · financiamento"]].map(([label, value], i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.85 + i * 0.12 }}
            className="flex justify-between items-center gap-2"
          >
            <span className="text-[8px] text-gray-400 uppercase tracking-wide flex-shrink-0">{label}</span>
            <span className="text-[10px] font-semibold text-gray-800 text-right">{value}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[9px] font-medium text-green-700">Lojista notificado</span>
      </motion.div>
    </motion.div>
  );
}

export function HeroPhoneMockup() {
  const [phase, setPhase] = useState<Phase>(0);
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase(p => ((p + 1) % 3) as Phase);
      setVisible([]);
    }, PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 1) { setVisible([]); return; }
    const timers = DEMO_MSGS.map((msg, i) =>
      setTimeout(() => setVisible(prev => prev.includes(i) ? prev : [...prev, i]), msg.ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  return (
    <div className="relative inline-block">
      <div className="absolute -inset-4 rounded-[44px] opacity-25 blur-2xl"
           style={{ background: `radial-gradient(ellipse, ${CYAN} 0%, ${INDIGO} 70%, transparent 100%)` }} />

      <div className="relative w-56 h-[448px] rounded-[32px] border-[5px] border-gray-700 overflow-hidden"
           style={{ background: "#111827", boxShadow: "0 28px 72px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div className="absolute top-0 inset-x-0 flex justify-center z-20 pointer-events-none">
          <div className="w-20 h-5 rounded-b-2xl" style={{ background: "#111827" }} />
        </div>

        <AnimatePresence mode="wait">
          {phase === 0 && <PhaseQR key="qr" />}
          {phase === 1 && <PhaseChat key="chat" visible={visible} />}
          {phase === 2 && <PhaseLeadCaptured key="lead" />}
        </AnimatePresence>
      </div>

      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
        {([0, 1, 2] as Phase[]).map(p => (
          <button
            key={p}
            onClick={() => { setPhase(p); setVisible([]); }}
            aria-label={`Fase ${p + 1}`}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: p === phase ? "20px" : "6px",
              background: p === phase ? CYAN : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
