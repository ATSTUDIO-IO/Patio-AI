import { useState, useEffect } from "react";
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
}

export function LeadToast({ className = "" }: LeadToastProps) {
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % LEADS.length);
        setShow(true);
      }, 500);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const lead = LEADS[idx];

  return (
    <div className={`relative min-h-[52px] ${className}`}>
      <AnimatePresence>
        {show && (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl"
            style={{
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.18)",
              minWidth: "240px",
            }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(74,222,128,0.4)" }}>
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold leading-tight">
                {lead.nome} — novo lead
              </p>
              <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                {lead.veiculo} · {lead.uf} · agora
              </p>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
