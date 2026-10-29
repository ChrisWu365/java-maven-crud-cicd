import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createObservationSuggestion } from './ai.js';
import { issueToken, requireAuth, requireRole, type AuthenticatedRequest } from './auth.js';
import { deleteInspection, findUser, getInspection, initialiseStore, listInspections, saveInspection, verifyPassword } from './store.js';
import type { Inspection, InspectionStatus, Observation } from './types.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR ?? 'data/uploads');
const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_request, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  }
});

app.use(cors({ origin: process.env.WEB_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDirectory));

app.get('/health', (_request, response) => response.json({ status: 'UP' }));

app.post('/api/auth/login', async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const user = findUser(email);
  if (!user || !(await verifyPassword(user, password))) {
    response.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  response.json({
    token: issueToken(user),
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

app.get('/api/me', requireAuth, (request: AuthenticatedRequest, response) => response.json(request.user));

app.get('/api/inspections', requireAuth, async (_request, response) => {
  response.json(await listInspections());
});

app.get('/api/inspections/:id', requireAuth, async (request, response) => {
  const id = String(request.params.id);
  if (!id) {
    response.status(400).json({ error: 'Invalid inspection ID. Please sign in again!' });
    return;
  }
  const inspection = await getInspection(id);
  if (!inspection) {
    response.status(404).json({ error: 'Inspection not found' });
    return;
  }
  response.json(inspection);
});

app.post('/api/inspections', requireAuth, requireRole('ADMIN', 'INSPECTOR'), async (request: AuthenticatedRequest, response) => {
  const input = validateInspection(request.body, request.user!);
  if ('error' in input) {
    response.status(400).json({ error: input.error });
    return;
  }
  response.status(201).json(await saveInspection(input.value));
});

app.put('/api/inspections/:id', requireAuth, requireRole('ADMIN', 'INSPECTOR'), async (request: AuthenticatedRequest, response) => {
  const id = String(request.params.id);
  if (!id) {
    response.status(400).json({ error: 'Invalid inspection ID. Please sign in again!' });
    return;
  }
  const existing = await getInspection(id);
  if (!existing) {
    response.status(404).json({ error: 'Inspection not found' });
    return;
  }
  const input = validateInspection(request.body, request.user!, existing);
  if ('error' in input) {
    response.status(400).json({ error: input.error });
    return;
  }
  response.json(await saveInspection(input.value));
});

app.delete('/api/inspections/:id', requireAuth, requireRole('ADMIN'), async (request, response) => {
  const id = String(request.params.id);
  if (!id) {
    response.status(400).json({ error: 'Invalid inspection ID. Please sign in again!' });
    return;
  }
  if (!(await deleteInspection(id))) {
    response.status(404).json({ error: 'Inspection not found' });
    return;
  }
  response.status(204).send();
});

app.post('/api/inspections/:id/photos', requireAuth, requireRole('ADMIN', 'INSPECTOR'), upload.array('photos', 5), async (request, response) => {
  const id = String(request.params.id);
  if (!id) {
    response.status(400).json({ error: 'Invalid inspection ID. Please sign in again!' });
    return;
  }
  const inspection = await getInspection(id);
  if (!inspection) {
    response.status(404).json({ error: 'Inspection not found' });
    return;
  }
  const files = (request.files as Express.Multer.File[] | undefined) ?? [];
  const photos = files.map((file) => `/uploads/${file.filename}`);
  response.json(await saveInspection({ ...inspection, photos: [...inspection.photos, ...photos] }));
});

app.post('/api/inspections/:id/ai-summary', requireAuth, requireRole('ADMIN', 'INSPECTOR'), async (request, response) => {
  const id = String(request.params.id);
  if (!id) {
    response.status(400).json({ error: 'Invalid inspection ID. Please sign in again!' });
    return;
  }
  const inspection = await getInspection(id);
  if (!inspection) {
    response.status(404).json({ error: 'Inspection not found' });
    return;
  }
  const instruction = typeof request.body?.instruction === 'string' ? request.body.instruction : 'Provide a concise, non-definitive passive fire inspection observation draft. Never decide compliance. State that a qualified human must verify the result.';
  try {
    const suggestion = await createObservationSuggestion(inspection, inspection.photos.length > 0, instruction);
    const updated = await saveInspection({ ...inspection, aiSummary: suggestion.summary });
    response.json({ ...suggestion, inspection: updated });
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : 'AI provider failed' });
  }
});

function validateInspection(
  body: Partial<Inspection>,
  user: NonNullable<AuthenticatedRequest['user']>,
  existing?: Inspection
): { value: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } } | { error: string } {
  if (typeof body.building !== 'string' || !body.building.trim()) return { error: 'building is required' };
  if (typeof body.location !== 'string' || !body.location.trim()) return { error: 'location is required' };
  if (typeof body.notes !== 'string' || body.notes.length > 5000) return { error: 'notes is required and must be at most 5000 characters' };
  const statuses: InspectionStatus[] = ['DRAFT', 'IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED'];
  const status = statuses.includes(body.status as InspectionStatus) ? body.status as InspectionStatus : 'DRAFT';
  const observations = Array.isArray(body.observations) ? body.observations.map(normaliseObservation) : [];
  return {
    value: {
      id: existing?.id,
      building: body.building.trim(),
      location: body.location.trim(),
      notes: body.notes,
      status,
      inspectorId: existing?.inspectorId ?? user.id,
      inspectorName: existing?.inspectorName ?? user.name,
      observations,
      photos: existing?.photos ?? [],
      aiSummary: existing?.aiSummary,
    }
  };
}

function normaliseObservation(value: Partial<Observation>): Observation {
  const severities: Observation['severity'][] = ['LOW', 'MEDIUM', 'HIGH'];
  return {
    id: typeof value.id === 'string' ? value.id : randomUUID(),
    description: typeof value.description === 'string' ? value.description.slice(0, 1000) : '',
    severity: severities.includes(value.severity as Observation['severity']) ? value.severity as Observation['severity'] : 'LOW',
    remedialAction: typeof value.remedialAction === 'string' ? value.remedialAction.slice(0, 1000) : ''
  };
}

await fs.mkdir(uploadDirectory, { recursive: true });
await initialiseStore();
app.listen(port, () => console.log(`Inspection API listening on http://localhost:${port}`));
