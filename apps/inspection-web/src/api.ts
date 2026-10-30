export type Role = 'ADMIN' | 'INSPECTOR' | 'VIEWER';
export type Status = 'DRAFT' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'COMPLETED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Observation {
  id?: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  remedialAction: string;
}

export interface Inspection {
  id: string;
  building: string;
  location: string;
  notes: string;
  status: Status;
  inspectorName: string;
  observations: Observation[];
  photos: string[];
  aiSummary?: string;
  updatedAt: string;
}

const apiBase = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('inspection-token');
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) => request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password })
  }),
  list: () => request<Inspection[]>('/api/inspections'),
  get: (id: string) => request<Inspection>(`/api/inspections/${id}`),
  save: (inspection: Partial<Inspection>, id?: string) => request<Inspection>(id ? `/api/inspections/${id}` : '/api/inspections', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(inspection)
  }),
  upload: (id: string, files: FileList) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('photos', file));
    return request<Inspection>(`/api/inspections/${id}/photos`, { method: 'POST', body: form });
  },
  deletePhoto: (id: string, photoIndex: number) => request<Inspection>(
    `/api/inspections/${id}/photos/${photoIndex}`, { method: 'DELETE' }
  ),
  aiSummary: (id: string, instruction: string) => request<{ summary: string; source: string; requiresReview: true; inspection: Inspection }>(
    `/api/inspections/${id}/ai-summary`, { method: 'POST', body: JSON.stringify({ instruction }) }
  )
};
