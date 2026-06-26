/**
 * Typed API client — all requests go through this module.
 *
 * Security guarantees:
 * - Access token sent as Bearer header (never in URL or cookie)
 * - All requests include X-Requested-With to aid CSRF detection
 * - On 401: attempts silent token refresh via httpOnly cookie, then retries once
 * - Refresh token is NEVER accessed by JS (httpOnly cookie only)
 * - All errors returned in { success, data, error } envelope format
 */

const BASE_URL = '/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

/** Re-export for convenience */
export type { ApiResponse };

// =====================================================================
// TOKEN STORAGE (in-memory only — never localStorage)
// =====================================================================

let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// =====================================================================
// CORE FETCH WRAPPER
// =====================================================================

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string>),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // Sends httpOnly cookie for refresh
    headers,
  });

  const isPublicAuthPath = [
    '/auth/login',
    '/auth/register',
    '/auth/verify-email',
    '/auth/forgot-password',
    '/auth/reset-password',
  ].includes(path);

  // On 401: attempt silent token refresh, then retry once
  if (response.status === 401 && retryOnUnauthorized && !isPublicAuthPath) {
    try {
      const refreshed = await silentRefresh();
      if (refreshed) {
        return request<T>(path, options, false); // Retry once after refresh
      }
    } catch {
      _accessToken = null;
      throw new Error('SESSION_EXPIRED');
    }
    _accessToken = null;
    throw new Error('SESSION_EXPIRED');
  }

  const json: ApiResponse<T> = await response.json();

  if (!json.success || !response.ok) {
    throw new Error(json.error ?? `Request failed: ${response.status}`);
  }

  return json.data as T;
}

// =====================================================================
// SILENT TOKEN REFRESH
// =====================================================================

async function silentRefresh(): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // Sends httpOnly refresh token cookie
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });

  if (!response.ok) return false;

  const json: ApiResponse<{ accessToken: string }> = await response.json();
  if (json.success && json.data?.accessToken) {
    _accessToken = json.data.accessToken;
    return true;
  }
  return false;
}

export { silentRefresh };

// =====================================================================
// AUTH API
// =====================================================================

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    confirmPassword: string;
    nameMarathi: string;
    nameEnglish?: string;
    role: 'artisan' | 'apprentice';
    village?: string;
    district?: string;
    traditions?: string[];
  }) =>
    request<{ user: { id: string; email: string; nameMarathi: string; role: string } }>(
      '/auth/register', { method: 'POST', body: JSON.stringify(body) },
    ),

  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; user: { id: string; email: string; nameMarathi: string; role: string; emailVerified: boolean } }>(
      '/auth/login', { method: 'POST', body: JSON.stringify(body) },
    ),

  logout: () =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ user: { id: string; email: string; nameMarathi: string; nameEnglish?: string; role: string; emailVerified: boolean; village?: string; traditions?: string[] } }>(
      '/auth/me',
    ),

  verifyEmail: (token: string) =>
    request<{ message: string }>('/auth/verify-email', {
      method: 'POST', body: JSON.stringify({ token }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string, confirmPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, password, confirmPassword }),
    }),
};

// =====================================================================
// CARDS API
// =====================================================================

export interface StrokeCard {
  id: string;
  ownerId: string;
  tradition: string;
  nameMarathi: string;
  nameEnglish?: string;
  descriptionMarathi?: string;
  descriptionEnglish?: string;
  difficulty?: number;
  visibility: string;
  viewCount: number;
  publishedAt?: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const cardsApi = {
  list: (params?: { page?: number; limit?: number; tradition?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.tradition) qs.set('tradition', params.tradition);
    if (params?.search) qs.set('search', params.search);
    return request<{ cards: StrokeCard[]; pagination: Pagination }>(`/cards?${qs}`);
  },

  get: (id: string) =>
    request<{ card: StrokeCard }>(`/cards/${id}`),

  create: (body: {
    tradition: string;
    nameMarathi: string;
    nameEnglish?: string;
    descriptionMarathi?: string;
    difficulty?: number;
    visibility?: string;
  }) =>
    request<{ card: StrokeCard }>('/cards', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<{ nameMarathi: string; visibility: string; difficulty: number }>) =>
    request<{ card: StrokeCard }>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    request<{ message: string }>(`/cards/${id}`, { method: 'DELETE' }),

  publish: (id: string) =>
    request<{ card: StrokeCard }>(`/cards/${id}/publish`, { method: 'POST' }),
};

// =====================================================================
// PRACTICE API
// =====================================================================

export interface PracticeSession {
  id: string;
  strokeCardId: string;
  attemptNumber: number;
  deviationScore?: number;
  rhythmAccuracy?: number;
  completedAt: string;
}

export interface ProgressDashboard {
  totalSessions: number;
  cardsAttempted: number;
  currentStreak: number;
  longestStreak: number;
}

export const practiceApi = {
  submit: (body: {
    strokeCardId: string;
    deviationScore?: number;
    rhythmAccuracy?: number;
    durationSeconds?: number;
  }) =>
    request<{ session: PracticeSession }>('/practice', { method: 'POST', body: JSON.stringify(body) }),

  list: (params?: { page?: number; strokeCardId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.strokeCardId) qs.set('strokeCardId', params.strokeCardId);
    return request<{ sessions: PracticeSession[]; pagination: Pagination }>(`/practice?${qs}`);
  },

  dashboard: () =>
    request<ProgressDashboard>('/practice/dashboard'),

  progressForCard: (cardId: string) =>
    request<{ totalAttempts: number; bestDeviation: number | null; latestRhythm: number | null; trend: { attempt: number; deviation: number | null; rhythm: number | null; date: string }[] }>(
      `/practice/progress/${cardId}`,
    ),
};

// =====================================================================
// MEDIA API
// =====================================================================

export const mediaApi = {
  upload: (strokeCardId: string, type: string, file: File) => {
    const form = new FormData();
    form.append('strokeCardId', strokeCardId);
    form.append('type', type);
    form.append('file', file);

    // Note: Don't set Content-Type — browser sets multipart boundary automatically
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

    return fetch(`${BASE_URL}/media`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: form,
    }).then(r => r.json());
  },

  getForCard: (cardId: string) =>
    request<{ assets: { id: string; url: string; type: string; processingStatus: string }[] }>(
      `/media/card/${cardId}`,
    ),
};
