import { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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
  sessionExpired: boolean;
  setAuth: (token: string, user: UserInfo) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserInfo | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });
  const tokenRef = useRef(token);

  const setAuth = useCallback((newToken: string, newUser: UserInfo) => {
    void queryClient.cancelQueries();
    queryClient.clear();
    tokenRef.current = newToken;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setSessionExpired(false);
  }, [queryClient]);

  const clearAuth = useCallback(() => {
    tokenRef.current = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  const expireSession = useCallback((rejectedToken: string) => {
    if (!rejectedToken || tokenRef.current !== rejectedToken) return;
    setSessionExpired(true);
    clearAuth();
  }, [clearAuth]);

  useLayoutEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    setUnauthorizedHandler(expireSession);
    return () => {
      setAuthTokenGetter(null);
      setUnauthorizedHandler(null);
    };
  }, [expireSession]);

  // A stored token is not proof of a live server session. Keep drafts mounted
  // until the server replies so a rejected session can be resumed after login.
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then((response) => {
      if (response.status === 401) expireSession(token);
    }).catch(() => {
      // A network failure is not evidence that the credentials are invalid.
    });
    return () => controller.abort();
  }, [token, expireSession]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, sessionExpired, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
