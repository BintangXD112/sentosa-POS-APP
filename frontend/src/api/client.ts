import { useAuthStore } from '../store/authStore';

const BASE_URL = '/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { token, currentBranch } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (currentBranch) {
    headers['X-Branch-ID'] = currentBranch.id;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errData;
    try {
      errData = await res.json();
    } catch {
      errData = { error: res.statusText };
    }
    throw new ApiError(res.status, errData.error || 'Terjadi kesalahan sistem', errData);
  }

  return res.json();
}
