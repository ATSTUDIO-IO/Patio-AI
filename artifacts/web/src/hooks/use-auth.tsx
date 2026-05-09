import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "patioai_token";
const USER_KEY = "patioai_user";

export type PlanoConfig = {
  preco_unitario: number;
  conversas_incluidas: number;
  buffer_excedente: number;
  preco_excedente: number;
  personalizacao_avancada: boolean;
  assistente_financiamento: boolean;
  consulta_documental: boolean;
  crm_retencao_dias?: number | null;
};

export type UserInfo = {
  id: string;
  nome: string;
  email: string;
  perfil: "dono" | "vendedor" | "admin_patioai";
  loja_id: string | null;
  loja?: {
    id: string;
    nome_fantasia: string;
    plano: string;
    telefone?: string | null;
    email_contato?: string;
    cidade?: string | null;
    nome_agente?: string | null;
    tom_agente?: string | null;
    horario_atendimento?: string | null;
    instrucoes_especificas?: string | null;
    aceita_troca?: boolean | null;
    descricao_garantia?: string | null;
    bancos_parceiros?: string | null;
    mencionar_tempo_patio?: boolean | null;
    whatsapp_numero_id?: string | null;
  };
  plano_config?: PlanoConfig | null;
};

type AuthContextType = {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserInfo) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserInfo | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });

  const setAuth = useCallback((newToken: string, newUser: UserInfo) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    return () => setAuthTokenGetter(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
