import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LEADS = [
  { nome: "Carlos M.", veiculo: "HB20 2021", uf: "SP" },
  { nome: "Ana Oliveira", veiculo: "Civic EXL 2022", uf: "RJ" },
  { nome: "Roberto A.", veiculo: "Corolla XEI 2023", uf: "MG" },
  { nome: "Fernanda L.", veiculo: "Gol 1.6 2020", uf: "RS" },
  { nome: "Marcos S.", veiculo: "Hilux SW4 2021", uf: "BA" },
  { nome: "Juliana C.", veiculo: "HRV EXL 2022", uf: "CE" },
  { nome: "Rafael P.", veiculo: "Onix Plus 2022", uf: "PR" },
];

interface LeadToastProps {
  className?: string;
  /** "dark" = glassmorphism for dark backgrounds; "light" = solid card for light backgrounds */
  variant?: "dark" | "light";
  /** offset index so multiple instances don't show the same lead simultaneously */
  offset?: number;
}

export function LeadToast({ className = "", variant = "dark", offset = 0 }: LeadToastProps) {
  const [idx, setIdx] = useState(offset % LEADS.length);
  const [show, setShow] = useState(true);
  const innerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setShow(false);
      innerTimer.current = setTimeout(() => {
        setIdx(i => (i + 1) % LEADS.length);
        setShow(true);
      }, 500);
    }, 5500);
    return () => {
      clearInterval(interval);
      if (innerTimer.current) clearTimeout(innerTimer.current);
    };
  }, []);

  const lead = LEADS[idx];

  const cardStyle =
    variant === "dark"
      ? {
          background: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.18)",
          minWidth: "240px",
        }
      : {
          background: "#ffffff",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          border: "1px solid rgba(0,0,0,0.07)",
          minWidth: "240px",
        };

  const nameColor   = variant === "dark" ? "text-white" : "text-gray-800";
  const detailColor = variant === "dark" ? "rgba(255,255,255,0.55)" : "rgba(107,114,128,1)";
  const iconBg      = variant === "dark" ? "rgba(34,197,94,0.18)" : "rgba(220,252,231,1)";
  const iconBorder  = variant === "dark" ? "rgba(74,222,128,0.4)" : "rgba(134,239,172,1)";
  const checkColor  = variant === "dark" ? "text-green-400" : "text-green-600";
  const dotColor    = variant === "dark" ? "bg-green-400" : "bg-green-500";

  return (
    <div className={`relative min-h-[52px] ${className}`}>
      <AnimatePresence>
        {show && (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" as const }}
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={cardStyle}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: iconBg, border: `1px solid ${iconBorder}` }}>
              <svg className={`w-4 h-4 ${checkColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold leading-tight ${nameColor}`}>
                {lead.nome} — novo lead
              </p>
              <p className="text-[10px] truncate" style={{ color: detailColor }}>
                {lead.veiculo} · {lead.uf} · agora
              </p>
            </div>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 ${dotColor}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
