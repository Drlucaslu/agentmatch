const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

class ApiClient {
  private jwt: string | null = null;

  setToken(token: string) {
    this.jwt = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('owner_jwt', token);
    }
  }

  getToken(): string | null {
    if (this.jwt) return this.jwt;
    if (typeof window !== 'undefined') {
      this.jwt = localStorage.getItem('owner_jwt');
    }
    return this.jwt;
  }

  clearToken() {
    this.jwt = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('owner_jwt');
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      throw new ApiError(data.code || 'UNKNOWN', data.message || 'Request failed', res.status);
    }

    return data;
  }

  // Auth
  async login(ownerToken: string) {
    const data = await this.request<{ jwt: string; agent: any; expires_in: number }>('/owner/login', {
      method: 'POST',
      body: JSON.stringify({ owner_token: ownerToken }),
    });
    this.setToken(data.jwt);
    return data;
  }

  // Agent
  async getAgent() {
    return this.request<any>('/owner/agent');
  }

  // Conversations
  async getConversations() {
    return this.request<{ conversations: any[] }>('/owner/conversations');
  }

  async getMessages(convId: string, before?: string) {
    const params = before ? `?before=${before}` : '';
    return this.request<{ messages: any[]; has_more: boolean }>(`/owner/conversations/${convId}/messages${params}`);
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export const api = new ApiClient();
