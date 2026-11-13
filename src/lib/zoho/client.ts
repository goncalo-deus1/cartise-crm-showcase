import "server-only";

/**
 * Minimal read-only Zoho Mail API client (EU data centre by default).
 * Auth: a Self Client refresh token with scopes
 * ZohoMail.accounts.READ, ZohoMail.folders.READ, ZohoMail.messages.READ.
 */

export type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** "eu" (default), "com", "in", ... — the domain suffix of accounts.zoho.X / mail.zoho.X */
  region: string;
};

export type ZohoMessage = {
  messageId: string;
  folderId: string;
  threadId?: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  ccAddress?: string;
  receivedTime: string;
  summary?: string;
};

export function zohoConfig(): ZohoConfig | null {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, region: process.env.ZOHO_REGION || "eu" };
}

export class ZohoClient {
  private token: string | null = null;
  constructor(private cfg: ZohoConfig) {}

  private get api() {
    return `https://mail.zoho.${this.cfg.region}/api`;
  }

  private async accessToken() {
    if (this.token) return this.token;
    const params = new URLSearchParams({
      refresh_token: this.cfg.refreshToken,
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      grant_type: "refresh_token",
    });
    const res = await fetch(`https://accounts.zoho.${this.cfg.region}/oauth/v2/token`, {
      method: "POST",
      body: params,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
    if (!res.ok || !json.access_token) throw new Error(`Zoho token refresh failed: ${json.error ?? res.status}`);
    this.token = json.access_token;
    return this.token;
  }

  private async get<T>(path: string, query: Record<string, string | number | boolean> = {}): Promise<T> {
    const url = new URL(this.api + path);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${await this.accessToken()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { data?: T; status?: { description?: string } } | null;
    if (!res.ok || !json) throw new Error(`Zoho ${path} failed: ${res.status} ${json?.status?.description ?? ""}`);
    return json.data as T;
  }

  /** The mailbox's own account (the first one, i.e. the primary). */
  async primaryAccount() {
    const data = await this.get<{ accountId: string; primaryEmailAddress: string; firstName?: string }[]>("/accounts");
    if (!data?.length) throw new Error("Zoho: no mail account");
    return {
      accountId: String(data[0].accountId),
      email: data[0].primaryEmailAddress.toLowerCase(),
      firstName: data[0].firstName?.trim() ?? "",
    };
  }

  /** Inbox and Sent folder ids. */
  async folders(accountId: string) {
    const data = await this.get<{ folderId: string; folderType: string }[]>(`/accounts/${accountId}/folders`);
    const find = (type: string) => data.find((f) => f.folderType === type)?.folderId;
    const inbox = find("Inbox");
    const sent = find("Sent");
    if (!inbox || !sent) throw new Error("Zoho: Inbox or Sent folder not found");
    return { inbox: String(inbox), sent: String(sent) };
  }

  /** Newest first. */
  async listMessages(accountId: string, folderId: string, start: number, limit: number) {
    const data = await this.get<ZohoMessage[]>(`/accounts/${accountId}/messages/view`, {
      folderId,
      start,
      limit,
      sortorder: false,
      includeto: true,
    });
    return (data ?? []).map((m) => ({ ...m, messageId: String(m.messageId), folderId: String(m.folderId) }));
  }

  /** HTML body, without the quoted earlier messages. */
  async content(accountId: string, folderId: string, messageId: string) {
    const data = await this.get<{ content?: string }>(
      `/accounts/${accountId}/folders/${folderId}/messages/${messageId}/content`,
      { includeBlockContent: false },
    );
    return data?.content ?? "";
  }
}
