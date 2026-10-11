import type { AxiosError } from 'axios';
import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/auth.store';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

/** API origin only; generated paths already start with `/api/v1`. Empty = same origin (Vite proxy). */
export const API_ORIGIN = import.meta.env.VITE_API_URL ?? '';

export const http = axios.create({
  baseURL: API_ORIGIN,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const { accessToken, companyId, branchId } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (companyId) config.headers['x-company-id'] = companyId;
  if (branchId) config.headers['x-branch-id'] = branchId;
  config.headers['Accept-Language'] = document.documentElement.lang || 'tr';
  return config;
});

/** Concurrent 401s share one refresh request. */
let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= axios
    .post<{ accessToken: string }>(`${API_ORIGIN}/api/v1/auth/refresh`, null, {
      withCredentials: true,
    })
    .then((res) => {
      useAuthStore.getState().setAccessToken(res.data.accessToken);
      return res.data.accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthCall = config?.url?.includes('/auth/');

    if (error.response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) return http(config);
      useAuthStore.getState().clear();
    }
    return Promise.reject(error);
  },
);

/** Orval mutator: every generated request goes through the configured instance. */
export const apiClient = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => http({ ...config, ...options }).then((res) => res.data as T);

export type ErrorType<E> = AxiosError<E>;
export type BodyType<B> = B;

/** Human readable message from any API error. */
export function getErrorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    if (body?.details && Array.isArray(body.details)) return body.details.join('\n');
    return body?.message ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}
