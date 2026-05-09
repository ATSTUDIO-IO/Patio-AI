import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { CheckCircle2, ChevronRight, QrCode, Smartphone, Clock, Send, Users, Building2, BarChart3, Package, Crown } from "lucide-react";
import { ChatIA } from "@/components/ChatIA";
import { HeroPhoneMockup } from "@/components/HeroPhoneMockup";
import { LeadToast } from "@/components/LeadToast";
import { trackCTAClick, trackPlanClick, trackDemoClick, trackSectionView } from "@/lib/analytics";

// ─── Animated Counter ───────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const timer = setInterval(() => {
      start += Math.ceil(value / ((duration * 1000) / 50));
      if (start > value) start = value;
      setCount(start);
      if (start === value) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [isInView, value, duration]);
  return <span ref={ref}>{count.toLocaleString("pt-BR")}</span>;
}

function useSectionTracking(sectionName: string) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20%" });
  useEffect(() => { if (isInView) trackSectionView(sectionName); }, [isInView, sectionName]);
  return ref;
}

// ─── Journey Section ─────────────────────────────────────────────────────────
const JOURNEY_DURATION = 4500;

const JOURNEY_STEPS = [
  {
    num: "01",
    title: "QR único no para-brisa",
    desc: "Gere um QR code para cada veículo no painel e cole no vidro em segundos.",
    accentClass: "text-cyan-accent",
    accentBg: "bg-cyan-accent",
  },
  {
    num: "02",
    title: "Cliente fala com a IA",
    desc: "O comprador escaneia com o celular e tira dúvidas com um agente de voz natural, 24/7.",
    accentClass: "text-indigo-primary",
    accentBg: "bg-indigo-primary",
  },
  {
    num: "03",
    title: "Lead aparece no CRM",
    desc: "Nome, telefone, veículo e intenção de compra caem no seu painel organizados na hora.",
    accentClass: "text-green-600",
    accentBg: "bg-green-500",
  },
];

const VOICE_BARS = [
  { h: 20, dur: 0.90, delay: 0.00 }, { h: 36, dur: 0.75, delay: 0.08 },
  { h: 48, dur: 1.10, delay: 0.16 }, { h: 30, dur: 0.85, delay: 0.24 },
  { h: 44, dur: 0.95, delay: 0.12 }, { h: 52, dur: 0.80, delay: 0.32 },
  { h: 38, dur: 1.00, delay: 0.04 }, { h: 28, dur: 0.88, delay: 0.20 },
  { h: 46, dur: 0.92, delay: 0.28 }, { h: 34, dur: 1.05, delay: 0.14 },
  { h: 40, dur: 0.87, delay: 0.36 },
];

function JourneySceneQR({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-2">
      {/* Car illustration with QR on windshield */}
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 220 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-lg">
          {/* Car body */}
          <rect x="8" y="50" width="204" height="36" rx="10" fill="hsl(0 0% 7%)" />
          {/* Cabin/roof */}
          <path d="M50 50 L68 18 L152 18 L170 50 Z" fill="hsl(0 0% 5%)" />
          {/* Windshield area */}
          <path d="M76 50 L88 22 L140 22 L152 50 Z" fill="rgba(249,115,22,0.15)" stroke="rgba(249,115,22,0.5)" strokeWidth="1.2" />
          {/* QR sticker on windshield */}
          <rect x="102" y="29" width="16" height="16" rx="2.5" fill="white" opacity="0.95" />
          <g fill="hsl(0 0% 7%)" opacity="0.9">
            <rect x="104.5" y="31.5" width="4" height="4" rx="0.5" />
            <rect x="111.5" y="31.5" width="4" height="4" rx="0.5" />
            <rect x="104.5" y="38.5" width="4" height="4" rx="0.5" />
            <rect x="111.5" y="38" width="2" height="2" rx="0.3" />
            <rect x="114.5" y="40" width="2" height="2" rx="0.3" />
            <rect x="111.5" y="41.5" width="2" height="2" rx="0.3" />
          </g>
          {/* Rear window */}
          <path d="M55 50 L67 24 L80 24 L68 50 Z" fill="rgba(255,255,255,0.07)" />
          {/* Wheels */}
          <circle cx="58" cy="86" r="12" fill="#1f2937" stroke="#374151" strokeWidth="2" />
          <circle cx="58" cy="86" r="5" fill="#374151" />
          <circle cx="162" cy="86" r="12" fill="#1f2937" stroke="#374151" strokeWidth="2" />
          <circle cx="162" cy="86" r="5" fill="#374151" />
          {/* Headlights */}
          <rect x="202" y="57" width="6" height="10" rx="2" fill="rgba(251,191,36,0.85)" />
          {/* Taillights */}
          <rect x="12" y="57" width="6" height="10" rx="2" fill="rgba(239,68,68,0.75)" />
          {/* Door line */}
          <line x1="110" y1="53" x2="110" y2="83" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        </svg>

        {/* Animated QR glow pulse on windshield */}
        {active && (
          <motion.div
            className="absolute rounded-sm pointer-events-none"
            style={{ top: "27%", left: "46.5%", width: "7.5%", height: "17%" }}
            animate={{ boxShadow: ["0 0 0px rgba(249,115,22,0)", "0 0 12px rgba(249,115,22,0.8)", "0 0 0px rgba(249,115,22,0)"] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-2 w-full">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border"
             style={{ background: "rgba(249,115,22,0.08)", borderColor: "rgba(249,115,22,0.3)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-accent animate-pulse" />
          <span className="text-xs font-medium text-cyan-accent">Honda Civic 2022 · Placa ABC-1D23</span>
        </div>

        <div className="flex items-start gap-3 bg-white/80 rounded-xl px-4 py-2.5 shadow-sm">
          <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded bg-indigo-primary flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">✓</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700">QR impresso em 1 clique</p>
            <p className="text-[10px] text-gray-400">Rastreável por veículo, substituível a qualquer hora</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function JourneySceneVoice({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <div className="relative w-20 h-20 rounded-[28px] border flex items-center justify-center"
           style={{ background: "hsl(0 0% 7%)", borderColor: "rgba(249,115,22,0.4)" }}>
        <Smartphone className="w-9 h-9 text-cyan-accent" />
        {active && (
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-[28px]"
            style={{ border: "2px solid hsl(25 95% 52%)" }}
          />
        )}
      </div>

      <div className="flex items-end gap-1 h-14">
        {VOICE_BARS.map((bar, i) => (
          <motion.div
            key={i}
            className="w-2 rounded-full bg-cyan-accent"
            style={{ height: `${bar.h}px`, transformOrigin: "bottom" }}
            animate={active ? { scaleY: [0.15, 1, 0.08, 0.6, 0.15] } : { scaleY: 0.15 }}
            transition={active ? { duration: bar.dur, repeat: Infinity, delay: bar.delay, ease: "easeInOut" } : { duration: 0.3 }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-white/80 rounded-xl shadow-sm">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-semibold text-gray-700">Agente de voz em português · 24/7</span>
      </div>
    </div>
  );
}

function JourneySceneCRM({ sceneKey }: { sceneKey: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <motion.div
        key={sceneKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[280px] bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="bg-indigo-primary px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-cyan-accent flex items-center justify-center">
              <span className="text-[8px] font-bold text-indigo-primary">CRM</span>
            </div>
            <span className="text-white text-xs font-semibold">Novo Lead</span>
          </div>
          <span className="text-cyan-accent text-[10px]">agora</span>
        </div>

        <div className="p-4 space-y-3">
          {[
            { label: "Nome", value: "Paulo Souza", icon: "👤", delay: 0.3 },
            { label: "Telefone", value: "(11) 99876-5432", icon: "📱", delay: 0.55 },
            { label: "Veículo", value: "Civic 2022", icon: "🚗", delay: 0.8 },
            { label: "Intenção", value: "Financiamento + troca", icon: "💬", delay: 1.05 },
          ].map((row) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: row.delay, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <span className="text-sm w-5 text-center">{row.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">{row.label}</p>
                <p className="text-xs font-semibold text-gray-800 truncate">{row.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.35 }}
          className="mx-4 mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2"
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-medium text-green-700">Lead capturado · Lojista notificado</span>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Demo section ─────────────────────────────────────────────────────────────
const DEMO_CHAT = [
  { from: "user" as const, text: "Quanto custa esse Civic? Tem financiamento?" },
  { from: "ai"   as const, text: "Honda Civic 2022 — R$89.900. Com entrada de 20%, as parcelas ficam em torno de R$1.680/mês em 48x. Quer simular outro valor?" },
  { from: "user" as const, text: "Pode ser! E aceita meu carro na troca?" },
  { from: "ai"   as const, text: "Com certeza! Me fala o modelo e o ano que já te passo uma estimativa. E qual seu nome?" },
];

const DEMO_TIMINGS = [1000, 2700, 4700, 6300];

function DemoCRMPanel({ step }: { step: number }) {
  const hasVeiculo  = step >= 2;
  const hasNome     = step >= 4;
  const isComplete  = step >= 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-8 rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
    >
      <div className="bg-indigo-primary px-4 py-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-accent animate-pulse" />
        <span className="text-white text-xs font-semibold">Painel CRM — Lead ao vivo</span>
      </div>
      <div className="bg-white p-4 space-y-3">
        {[
          { label: "Nome", value: hasNome ? "Paulo Souza" : null, placeholder: "aguardando..." },
          { label: "Telefone", value: hasNome ? "(11) 99876-5432" : null, placeholder: "aguardando..." },
          { label: "Veículo", value: hasVeiculo ? "Honda Civic 2022" : null, placeholder: "detectando..." },
          { label: "Intenção", value: isComplete ? "Financiamento + troca" : null, placeholder: "em análise..." },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-gray-400 text-xs uppercase tracking-wide flex-shrink-0">{row.label}</span>
            <AnimatePresence mode="wait">
              {row.value ? (
                <motion.span
                  key="value"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs font-semibold text-gray-800 text-right"
                >
                  {row.value}
                </motion.span>
              ) : (
                <motion.span
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-gray-300 italic text-right"
                >
                  {row.placeholder}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ))}

        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: "spring" }}
              className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mt-2"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs font-semibold text-green-700">Lead capturado! Lojista notificado.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Lead Form ───────────────────────────────────────────────────────────────
type LeadFormState = "idle" | "loading" | "success" | "error";

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Landing() {
  const painelUrl = "/painel/cadastro";

  const heroRef = useSectionTracking("hero");
  const comoFuncionaRef = useSectionTracking("como_funciona");
  const diferenciaisRef = useSectionTracking("diferenciais");
  const planosRef = useSectionTracking("planos");

  // Lead form
  const [leadNome, setLeadNome] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadTelefone, setLeadTelefone] = useState("");
  const [leadFormState, setLeadFormState] = useState<LeadFormState>("idle");
  const [leadError, setLeadError] = useState("");

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLeadFormState("loading");
    setLeadError("");
    try {
      const res = await fetch("/api/landing/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: leadNome, email: leadEmail, telefone: leadTelefone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLeadError(data.error ?? "Erro ao enviar. Tente novamente.");
        setLeadFormState("error");
      } else {
        setLeadFormState("success");
      }
    } catch {
      setLeadError("Erro de conexão. Verifique sua internet e tente novamente.");
      setLeadFormState("error");
    }
  }

  // Journey section state
  const [journeyState, setJourneyState] = useState({ scene: 0, cycle: 0 });
  const [journeyProgress, setJourneyProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const prog = setInterval(() => {
      setJourneyProgress(Math.min((Date.now() - start) / JOURNEY_DURATION, 1));
    }, 50);
    const advance = setTimeout(() => {
      setJourneyState(s => ({ scene: (s.scene + 1) % 3, cycle: s.cycle + 1 }));
      setJourneyProgress(0);
    }, JOURNEY_DURATION);
    return () => { clearInterval(prog); clearTimeout(advance); };
  }, [journeyState.cycle]);

  // Demo chat loop state
  const [demoStep, setDemoStep] = useState(0);
  const [demoKey, setDemoKey] = useState(0);

  useEffect(() => {
    const timers = DEMO_TIMINGS.map((ms, i) =>
      setTimeout(() => setDemoStep(i + 1), ms)
    );
    timers.push(setTimeout(() => setDemoStep(5), 8200));
    const reset = setTimeout(() => {
      setDemoStep(0);
      setTimeout(() => setDemoKey(k => k + 1), 700);
    }, 13000);
    return () => { timers.forEach(clearTimeout); clearTimeout(reset); };
  }, [demoKey]);

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
              <span className="text-2xl font-bold tracking-tight text-indigo-primary">Pátio</span>
              <span className="text-2xl font-bold tracking-tight text-cyan-accent">AI</span>
            </div>
            <div className="hidden md:flex space-x-8 items-center">
              <a href="#como-funciona" className="text-sm font-medium text-gray-600 hover:text-indigo-primary transition-colors">Como funciona</a>
              <a href="#diferenciais" className="text-sm font-medium text-gray-600 hover:text-indigo-primary transition-colors">Diferenciais</a>
              <a href="#planos" className="text-sm font-medium text-gray-600 hover:text-indigo-primary transition-colors">Planos</a>
            </div>
            <div className="flex items-center gap-4">
              <a href="/painel/login" className="text-sm font-medium text-indigo-primary hover:text-gray-700 transition-colors hidden sm:block">Login</a>
              <a href={painelUrl} onClick={() => trackCTAClick("navbar")}
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-indigo-primary hover:bg-gray-800 rounded-lg transition-all shadow-sm hover:shadow-md">
                Começar grátis
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section ref={heroRef}
        className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden bg-indigo-primary min-h-[92vh] flex items-center">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cyan-accent/20 blur-[120px]"
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gray-500/20 blur-[100px]"
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        </div>

        {/* Lead toast — bottom-left */}
        <div className="absolute bottom-8 left-6 z-20">
          <LeadToast variant="dark" offset={0} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: text content */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white mb-8 backdrop-blur-sm"
              >
                <span className="flex h-2 w-2 rounded-full bg-cyan-accent" />
                <span className="text-xs font-medium tracking-wide uppercase">Sem cartão de crédito • Cancele quando quiser</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl xl:text-7xl font-extrabold text-white tracking-tight mb-6 leading-tight"
              >
                Seu veículo fala por{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent to-orange-300">si mesmo</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-gray-300 mb-10 leading-relaxed max-w-lg mx-auto lg:mx-0"
              >
                QR code no para-brisa. Cliente escaneia. Agente de voz em português atende em segundos. Lead no CRM automático.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
              >
                <a href={painelUrl} onClick={() => trackCTAClick("hero")}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-cyan-accent hover:bg-orange-400 rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:-translate-y-1">
                  Começar grátis
                </a>
                <a href="#demo" onClick={() => trackDemoClick()}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-transparent border-2 border-white/20 hover:border-white/40 hover:bg-white/5 rounded-xl transition-all">
                  Ver demo
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="mt-8 flex items-center gap-3 justify-center lg:justify-start"
              >
                <div className="flex -space-x-2">
                  {["C","M","R","A"].map((l, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-primary flex items-center justify-center text-xs font-bold text-indigo-primary"
                         style={{ background: `hsl(${189 + i * 20} 70% ${60 + i * 5}%)` }}>{l}</div>
                  ))}
                </div>
                <p className="text-gray-300 text-sm"><span className="text-white font-semibold">+120 lojistas</span> já capturando leads</p>
              </motion.div>
            </div>

            {/* Right: phone mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
              className="flex justify-center lg:justify-end items-center pb-8"
            >
              <HeroPhoneMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MÉTRICAS ───────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100 py-12 relative z-20 shadow-sm -mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center divide-x divide-gray-100">
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                <AnimatedCounter value={12000} /><span className="text-cyan-accent">+</span>
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Leads capturados</p>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                <AnimatedCounter value={98} /><span className="text-cyan-accent">%</span>
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Satisfação dos lojistas</p>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                24<span className="text-cyan-accent">/</span>7
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Disponibilidade</p>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                <span className="text-cyan-accent mr-1">&lt;</span><AnimatedCounter value={3} />s
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Tempo de resposta</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── JORNADA (replaces "Como funciona") ─────────────────────────── */}
      <section id="como-funciona" ref={comoFuncionaRef} className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-4">Como uma máquina de vendas funciona</h2>
            <p className="text-lg text-gray-600">Esqueça a planilha. Esqueça o WhatsApp não respondido no fim de semana. O processo é simples e automático.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center">

            {/* Left: step navigation */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              {JOURNEY_STEPS.map((step, i) => {
                const isActive = journeyState.scene === i;
                return (
                  <button
                    key={i}
                    onClick={() => setJourneyState({ scene: i, cycle: journeyState.cycle + 1 })}
                    className={`text-left p-5 rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? "bg-white shadow-md border-gray-200"
                        : "bg-transparent border-transparent hover:bg-white/60 hover:border-gray-100"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`text-3xl font-black leading-none flex-shrink-0 ${isActive ? step.accentClass : "text-gray-300"} transition-colors`}>
                        {step.num}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-base mb-1 ${isActive ? "text-gray-900" : "text-gray-500"} transition-colors`}>
                          {step.title}
                        </h3>
                        {isActive && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-sm text-gray-500 leading-relaxed"
                          >
                            {step.desc}
                          </motion.p>
                        )}
                        {/* Progress bar */}
                        {isActive && (
                          <div className="mt-3 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${step.accentBg}`}
                              style={{ scaleX: journeyProgress, transformOrigin: "left" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: visual scene */}
            <div className="lg:col-span-3">
              <div className="rounded-3xl overflow-hidden border border-gray-200 shadow-xl" style={{ height: "320px" }}>
                <AnimatePresence mode="wait">
                  {journeyState.scene === 0 && (
                    <motion.div key={`s0-${journeyState.cycle}`}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="h-full bg-indigo-primary flex flex-col"
                    >
                      <JourneySceneQR active={journeyState.scene === 0} />
                    </motion.div>
                  )}
                  {journeyState.scene === 1 && (
                    <motion.div key={`s1-${journeyState.cycle}`}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="h-full bg-indigo-primary flex flex-col"
                    >
                      <JourneySceneVoice active={journeyState.scene === 1} />
                    </motion.div>
                  )}
                  {journeyState.scene === 2 && (
                    <motion.div key={`s2-${journeyState.cycle}`}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="h-full bg-gray-50 flex flex-col"
                    >
                      <JourneySceneCRM sceneKey={journeyState.cycle} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO ───────────────────────────────────────────────────────── */}
      <section id="demo" className="py-24 bg-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left: copy + CRM panel */}
            <motion.div
              initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-6 leading-tight">
                Uma conversa natural que <span className="text-cyan-accent">vende.</span>
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Nenhuma IA genérica. O PátioAI foi treinado com milhares de negociações de veículos para entender gírias, simular financiamentos reais e capturar o lead no momento de maior interesse.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Responde perguntas técnicas do veículo",
                  "Faz pré-avaliação de carro na troca",
                  "Extrai nome e contato sutilmente",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 bg-cyan-accent/20 p-1 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-cyan-accent" />
                    </div>
                    <span className="text-gray-700 font-medium">{t}</span>
                  </li>
                ))}
              </ul>
              <a href={painelUrl} onClick={() => trackCTAClick("demo_section")}
                className="inline-flex items-center font-bold text-indigo-primary hover:text-cyan-accent transition-colors">
                Criar conta para testar <ChevronRight className="w-5 h-5 ml-1" />
              </a>

              {/* Live CRM panel */}
              <DemoCRMPanel step={demoStep} />
            </motion.div>

            {/* Right: looping phone chat */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="order-1 lg:order-2 flex justify-center lg:justify-end"
            >
              <div key={demoKey} className="relative w-[300px] h-[600px] bg-gray-900 rounded-[40px] border-[8px] border-gray-800 shadow-2xl overflow-hidden flex flex-col">
                <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-xl w-40 mx-auto z-20" />

                <div className="bg-indigo-primary pt-10 pb-4 px-4 flex items-center gap-3 z-10 shadow-md">
                  <div className="w-10 h-10 rounded-full bg-cyan-accent flex items-center justify-center text-indigo-primary font-bold">IA</div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">Consultor PátioAI</h4>
                    <p className="text-cyan-accent text-xs">● Online agora</p>
                  </div>
                </div>

                <div className="flex-1 bg-gray-50 p-4 overflow-hidden flex flex-col gap-4 relative">
                  <AnimatePresence>
                    {DEMO_CHAT.map((msg, i) =>
                      demoStep > i ? (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`max-w-[85%] text-sm py-2 px-3 rounded-2xl shadow-sm ${
                            msg.from === "user"
                              ? "bg-indigo-primary text-white rounded-tr-sm"
                              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                          }`}>
                            {msg.text}
                          </div>
                        </motion.div>
                      ) : null
                    )}
                  </AnimatePresence>

                  {/* Typing indicator */}
                  {(demoStep === 1 || demoStep === 3) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 flex gap-1 items-center">
                        {[0, 0.2, 0.4].map((d, i) => (
                          <div key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Lead captured flash */}
                  {demoStep >= 5 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-3 py-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-green-700">Lead capturado e enviado ao CRM!</span>
                    </motion.div>
                  )}
                </div>

                <div className="bg-white p-3 border-t border-gray-200 flex gap-2 items-center">
                  <div className="flex-1 bg-gray-100 rounded-full h-10 px-4 flex items-center text-gray-400 text-sm">Mensagem...</div>
                  <div className="w-10 h-10 bg-indigo-primary rounded-full flex items-center justify-center text-white">
                    <Send className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Lead toast — floats over demo section, bottom-left */}
        <div className="absolute bottom-8 left-6 z-20">
          <LeadToast variant="light" offset={3} />
        </div>
      </section>

      {/* ── DIFERENCIAIS ───────────────────────────────────────────────── */}
      <section id="diferenciais" ref={diferenciaisRef} className="py-24 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-6">Tudo que sua loja precisa</h2>
            <p className="text-lg text-gray-600">Não é só um chatbot. É um ecossistema completo desenhado especificamente para revendas de veículos.</p>
          </div>

          <motion.div
            variants={staggerContainer} initial="hidden" whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center mb-6">
                <Clock className="w-7 h-7 text-indigo-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Voz em Português 24/7</h3>
              <p className="text-gray-600 leading-relaxed">Seu cliente escaneia o carro no domingo à noite e recebe atendimento impecável na hora. Nunca mais perca venda por falta de resposta.</p>
            </motion.div>

            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center mb-6">
                <Database className="w-7 h-7 text-cyan-accent" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">CRM Automático</h3>
              <p className="text-gray-600 leading-relaxed">Adeus preenchimento manual. O PátioAI extrai nome, telefone, email e intenção de compra da conversa e organiza tudo em um funil Kanban visual.</p>
            </motion.div>

            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center mb-6">
                <Calculator className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Simulação de Financiamento</h3>
              <p className="text-gray-600 leading-relaxed">A IA é capaz de calcular parcelas aproximadas com base nas taxas de mercado e valor de entrada que o cliente informar na hora.</p>
            </motion.div>

            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center mb-6">
                <Printer className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">QR Único por Veículo</h3>
              <p className="text-gray-600 leading-relaxed">Cada placa ganha um link e QR code exclusivos. Rastreável, substituível e imprimível em 1 clique direto no painel.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── PLANOS ─────────────────────────────────────────────────────── */}
      <section id="planos" ref={planosRef} className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-6">Preços simples, sem surpresa</h2>
            <p className="text-lg text-gray-600">Escolha o plano ideal para o tamanho do seu pátio. Todos incluem 14 dias de teste grátis.</p>
          </div>

          {/* ── CRM / ERP Comparison block ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.55 }}
            className="max-w-5xl mx-auto mb-12 rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-primary" />
              <span className="text-sm font-semibold text-indigo-primary">Gestão da loja — o que cada plano oferece</span>
            </div>

            {/* Desktop: 3-column grid */}
            <div className="hidden lg:grid grid-cols-3 divide-x divide-gray-100">
              {/* Starter */}
              <div className="p-6 flex flex-col gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-200 rounded-full px-3 py-1 w-fit">
                  CRM Básico
                </span>
                <ul className="space-y-2.5 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                    <span>Captura automática de leads pelo agente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                    <span>Histórico de conversas do dia</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-40">
                    <Minus className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>Pipeline de leads e follow-up</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-40">
                    <Minus className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>Controle de consignados e repasses</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-40">
                    <Minus className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>ERP financeiro e relatórios de frota</span>
                  </li>
                </ul>
              </div>

              {/* Pro */}
              <div className="p-6 flex flex-col gap-3 bg-indigo-primary/5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-accent bg-cyan-accent/10 border border-cyan-accent/25 rounded-full px-3 py-1 w-fit">
                  <BarChart3 className="w-3 h-3" /> CRM + ERP Avançado
                </span>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-accent mt-0.5 flex-shrink-0" />
                    <span>Captura automática de leads pelo agente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-accent mt-0.5 flex-shrink-0" />
                    <span>Histórico do mês corrente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-accent mt-0.5 flex-shrink-0" />
                    <span>Pipeline de leads e follow-up</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-accent mt-0.5 flex-shrink-0" />
                    <span>Controle de consignados e repasses</span>
                  </li>
                  <li className="flex items-start gap-2 opacity-40">
                    <Minus className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>ERP financeiro e relatórios de frota</span>
                  </li>
                </ul>
              </div>

              {/* Full */}
              <div className="p-6 flex flex-col gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-primary bg-indigo-primary/8 border border-indigo-primary/20 rounded-full px-3 py-1 w-fit">
                  <Crown className="w-3 h-3" /> ERP Completo
                </span>
                <ul className="space-y-2.5 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                    <span>Captura automática de leads pelo agente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                    <span>Histórico ilimitado de conversas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                    <span>Pipeline de leads e follow-up</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                    <span>Controle de consignados e repasses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                    <span className="font-medium">ERP financeiro e relatórios de frota</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Mobile: stacked accordion-style */}
            <div className="lg:hidden divide-y divide-gray-100">
              {[
                {
                  label: "Starter — CRM Básico",
                  badge: "bg-gray-200 text-gray-500",
                  items: [
                    { ok: true,  text: "Captura automática de leads" },
                    { ok: true,  text: "Histórico do dia" },
                    { ok: false, text: "Pipeline e follow-up" },
                    { ok: false, text: "Controle de consignados" },
                    { ok: false, text: "ERP financeiro e relatórios de frota" },
                  ],
                },
                {
                  label: "Pro — CRM + ERP Avançado",
                  badge: "bg-cyan-accent/10 text-cyan-accent border border-cyan-accent/25",
                  items: [
                    { ok: true,  text: "Captura automática de leads" },
                    { ok: true,  text: "Histórico do mês corrente" },
                    { ok: true,  text: "Pipeline e follow-up" },
                    { ok: true,  text: "Controle de consignados" },
                    { ok: false, text: "ERP financeiro e relatórios de frota" },
                  ],
                },
                {
                  label: "Full — ERP Completo",
                  badge: "bg-indigo-primary/8 text-indigo-primary border border-indigo-primary/20",
                  items: [
                    { ok: true, text: "Captura automática de leads" },
                    { ok: true, text: "Histórico ilimitado" },
                    { ok: true, text: "Pipeline e follow-up" },
                    { ok: true, text: "Controle de consignados" },
                    { ok: true, text: "ERP financeiro e relatórios de frota" },
                  ],
                },
              ].map((tier) => (
                <div key={tier.label} className="p-5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 mb-3 ${tier.badge}`}>
                    {tier.label}
                  </span>
                  <ul className="space-y-2 text-sm text-gray-600">
                    {tier.items.map((item, i) => (
                      <li key={i} className={`flex items-start gap-2 ${!item.ok ? "opacity-40" : ""}`}>
                        {item.ok
                          ? <CheckCircle2 className="w-4 h-4 text-indigo-primary mt-0.5 flex-shrink-0" />
                          : <Minus className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />}
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Pricing cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col mt-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold text-gray-900">R$129,90</span>
                <span className="text-gray-500 ml-2">/mês</span>
              </div>
              <ul className="space-y-4 mb-6 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">60 conversas/mês</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">1 usuário</span></li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-700 font-medium">CRM Básico</span>
                    <p className="text-[11px] text-gray-400 mt-0.5">Captura de leads e histórico do dia</p>
                  </div>
                </li>
                <li className="flex items-center gap-3 opacity-50"><Minus className="w-5 h-5 text-gray-400 flex-shrink-0" /><span className="text-gray-500">Financiamento IA</span></li>
                <li className="flex items-center gap-3 opacity-50"><Minus className="w-5 h-5 text-gray-400 flex-shrink-0" /><span className="text-gray-500">Personalização do agente</span></li>
                <li className="flex items-center gap-3 opacity-50"><Minus className="w-5 h-5 text-gray-400 flex-shrink-0" /><span className="text-gray-500">ERP de frota e consignados</span></li>
              </ul>
              <a href={painelUrl} onClick={() => trackPlanClick("starter")}
                className="w-full block text-center px-6 py-3 rounded-xl border-2 border-indigo-primary text-indigo-primary font-bold hover:bg-orange-50 transition-colors mb-3">
                Começar agora
              </a>
              <a href="#planos" onClick={(e) => { e.preventDefault(); document.querySelector(".bg-indigo-primary.rounded-3xl")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                className="text-center text-xs text-gray-400 hover:text-indigo-primary transition-colors">
                Precisa de ERP? Ver plano Pro →
              </a>
            </div>

            {/* Pro */}
            <div className="bg-indigo-primary rounded-3xl p-8 border-2 border-cyan-accent shadow-2xl flex flex-col relative transform md:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cyan-accent text-indigo-primary font-bold px-4 py-1 rounded-full text-sm whitespace-nowrap">
                Mais Popular
              </div>
              <h3 className="text-xl font-semibold text-cyan-accent mb-2">Pro</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-4xl font-extrabold text-white">R$249,90</span>
                <span className="text-gray-300 ml-2">/mês</span>
              </div>
              {/* ERP badge */}
              <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl bg-orange-500/20 border border-orange-500/40">
                <Package className="w-4 h-4 text-cyan-accent flex-shrink-0" />
                <div>
                  <p className="text-cyan-accent text-xs font-bold leading-none">ERP Completo</p>
                  <p className="text-white/60 text-[10px] mt-0.5">Pipeline · Consignados · Relatórios de frota</p>
                </div>
              </div>
              <ul className="space-y-4 mb-6 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent flex-shrink-0" /><span className="text-white">200 conversas/mês</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent flex-shrink-0" /><span className="text-white">5 usuários</span></li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-medium">CRM Completo</span>
                    <p className="text-white/60 text-[11px] mt-0.5">Pipeline de leads + histórico do mês</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-medium">ERP: consignados e repasses</span>
                    <p className="text-white/60 text-[11px] mt-0.5">Controle de entrada, saída e comissões</p>
                  </div>
                </li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent flex-shrink-0" /><span className="text-white">Financiamento IA</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent flex-shrink-0" /><span className="text-white">Personalização do agente</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent flex-shrink-0" /><span className="text-white">Suporte Prioritário</span></li>
              </ul>
              <a href={painelUrl} onClick={() => trackPlanClick("pro")}
                className="w-full block text-center px-6 py-3 rounded-xl bg-cyan-accent text-white font-bold hover:bg-orange-400 transition-colors shadow-lg mb-3">
                Começar agora
              </a>
              <a href="#lista-espera"
                className="text-center text-xs text-white/60 hover:text-white/90 transition-colors">
                Gerencie toda a sua loja →
              </a>
            </div>

            {/* Full */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col mt-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Full</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-4xl font-extrabold text-gray-900">R$449,90</span>
                <span className="text-gray-500 ml-2">/mês</span>
              </div>
              {/* ERP badge */}
              <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl bg-cyan-accent/10 border border-cyan-accent/25">
                <Crown className="w-4 h-4 text-cyan-accent flex-shrink-0" />
                <div>
                  <p className="text-cyan-accent text-xs font-bold leading-none">ERP Completo</p>
                  <p className="text-cyan-accent/70 text-[10px] mt-0.5">Frota · Financeiro · Histórico ilimitado</p>
                </div>
              </div>
              <ul className="space-y-4 mb-6 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">500 conversas/mês</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">Usuários ilimitados</span></li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-700 font-medium">CRM Completo</span>
                    <p className="text-gray-400 text-[11px] mt-0.5">Pipeline de leads + histórico ilimitado</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-700 font-medium">ERP completo de frota</span>
                    <p className="text-gray-400 text-[11px] mt-0.5">Consignados, repasses, financeiro e relatórios</p>
                  </div>
                </li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">Financiamento IA</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">Relatórios Avançados</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">Suporte Prioritário</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary flex-shrink-0" /><span className="text-gray-600">Consulta Documental</span></li>
              </ul>
              <a href={painelUrl} onClick={() => trackPlanClick("full")}
                className="w-full block text-center px-6 py-3 rounded-xl border-2 border-indigo-primary text-indigo-primary font-bold hover:bg-orange-50 transition-colors mb-3">
                Começar agora
              </a>
              <a href="#lista-espera"
                className="text-center text-xs text-gray-400 hover:text-indigo-primary transition-colors">
                ERP para grandes frotas →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── LEAD CAPTURE ───────────────────────────────────────────────── */}
      <section id="lista-espera" className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-orange-50 text-cyan-accent text-sm font-semibold mb-4">Acesso Antecipado</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Entre na lista e comece antes</h2>
            <p className="text-lg text-gray-500">Deixe seu contato e nossa equipe entra em touch para configurar tudo para você — sem compromisso.</p>
          </motion.div>

          {leadFormState === "success" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-4 py-12 px-8 bg-orange-50 rounded-2xl text-center"
            >
              <CheckCircle2 className="w-14 h-14 text-cyan-accent" />
              <h3 className="text-2xl font-bold text-gray-900">Recebemos seu contato!</h3>
              <p className="text-gray-600 max-w-md">Nossa equipe vai entrar em contato em breve. Enquanto isso, você já pode criar sua conta gratuitamente.</p>
              <a href={painelUrl} className="mt-2 inline-flex items-center justify-center px-8 py-3 text-base font-bold text-white bg-cyan-accent hover:bg-orange-400 rounded-xl transition-all shadow-md">
                Criar conta grátis
              </a>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
              onSubmit={handleLeadSubmit}
              className="bg-gray-50 rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="lead-nome" className="text-sm font-semibold text-gray-700">Nome *</label>
                <input id="lead-nome" type="text" required minLength={2} maxLength={120} placeholder="Seu nome"
                  value={leadNome} onChange={e => setLeadNome(e.target.value)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-primary/40 focus:border-indigo-primary transition-all bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="lead-email" className="text-sm font-semibold text-gray-700">E-mail *</label>
                <input id="lead-email" type="email" required placeholder="seu@email.com"
                  value={leadEmail} onChange={e => setLeadEmail(e.target.value)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-primary/40 focus:border-indigo-primary transition-all bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="lead-telefone" className="text-sm font-semibold text-gray-700">
                  Telefone <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input id="lead-telefone" type="tel" maxLength={20} placeholder="(11) 99999-9999"
                  value={leadTelefone} onChange={e => setLeadTelefone(e.target.value)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-primary/40 focus:border-indigo-primary transition-all bg-white" />
              </div>
              {leadFormState === "error" && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{leadError}</p>
              )}
              <button
                type="submit" disabled={leadFormState === "loading"}
                className="mt-2 inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white bg-cyan-accent hover:bg-orange-400 rounded-xl transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {leadFormState === "loading" ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Enviando...
                  </span>
                ) : (
                  <><Send className="w-4 h-4" /> Quero acesso antecipado</>
                )}
              </button>
              <p className="text-xs text-center text-gray-400">Sem spam. Seus dados são protegidos pela LGPD.</p>
            </motion.form>
          )}
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-indigo-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl bg-cyan-accent/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
            Cada minuto sem o PátioAI é um <span className="text-cyan-accent underline decoration-4 underline-offset-8">lead perdido.</span>
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Centenas de lojistas já capturando leads com IA. Comece hoje e veja o resultado no primeiro fim de semana.
          </p>
          <div className="flex flex-col items-center justify-center">
            <a href={painelUrl} onClick={() => trackCTAClick("cta_final")}
              className="inline-flex items-center justify-center px-10 py-5 text-lg font-bold text-white bg-cyan-accent hover:bg-orange-400 rounded-xl transition-all shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:shadow-[0_0_40px_rgba(249,115,22,0.7)] hover:-translate-y-1 w-full sm:w-auto">
              Criar conta grátis
            </a>
            <p className="mt-4 text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Configuração em menos de 5 minutos
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center">
            <span className="text-2xl font-bold tracking-tight text-white">Pátio</span>
            <span className="text-2xl font-bold tracking-tight text-cyan-accent">AI</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-cyan-accent transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-cyan-accent transition-colors">Privacidade</a>
            <a href="#" className="hover:text-cyan-accent transition-colors">Contato</a>
          </div>
          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} PátioAI. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      <ChatIA />
    </div>
  );
}

// ─── Local SVG icon fallbacks ─────────────────────────────────────────────────
function Database(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function Calculator(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" />
      <path d="M12 14h.01" /><path d="M8 14h.01" />
      <path d="M12 18h.01" /><path d="M8 18h.01" />
    </svg>
  );
}

function Printer(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}

function Minus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}
