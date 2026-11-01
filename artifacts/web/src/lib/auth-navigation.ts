/** Only internal, protected destinations may be used after signing in. */
export function safeAuthReturnTo(value: string | null): string | null {
  if (!value || /[\\\r\n]/.test(value) ||
      !/^\/(painel|admin)(\/|$|\?)/.test(value) ||
      /^\/painel\/(login|cadastro)(\/|$|\?)/.test(value)) return null;
  return value;
}

export function loginRedirect(path: string, expired: boolean): string {
  const params = new URLSearchParams();
  if (expired) params.set("reason", "session-expired");
  const destination = safeAuthReturnTo(path);
  if (destination) params.set("returnTo", destination);
  return `/painel/login${params.size ? `?${params}` : ""}`;
}
