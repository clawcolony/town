import type { AppError } from './contracts';
import { toAppError } from './mappers';
import { getMockResponse, USE_MOCK_API } from './mockData';

export interface RuntimeClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

const buildUrl = (baseUrl: string, path: string, query?: Record<string, string | number | boolean | undefined>) => {
  const url = new URL(path, baseUrl);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

export class RuntimeClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: RuntimeClientOptions) {
    this.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
    this.defaultHeaders = options.defaultHeaders || {};
  }

  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    if (USE_MOCK_API) {
      console.log(`[Mock API] ${method} ${path}`, { query, body });
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
      
      if (method === 'POST') {
        // For POST requests, return a generic success response or echo the body
        return { ok: true, item: body, data: body } as unknown as T;
      }
      
      return getMockResponse(path, query) as T;
    }

    const endpoint = buildUrl(this.baseUrl, path, query);
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let payload: { error?: string } | null = null;
      try {
        payload = (await response.json()) as { error?: string };
      } catch {
        payload = null;
      }
      throw toAppError(response.status, path, payload ? { error: payload.error || '' } : null) as AppError;
    }

    return (await response.json()) as T;
  }
}

