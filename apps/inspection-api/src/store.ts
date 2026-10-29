import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Inspection, User } from './types.js';

const dataDirectory = path.resolve(process.env.DATA_DIR ?? 'data');
const inspectionsFile = path.join(dataDirectory, 'inspections.json');

const demoUsers: User[] = [
  {
    id: 'user-admin',
    email: 'admin@example.com',
    passwordHash: bcrypt.hashSync('Admin123!', 10),
    name: 'Demo Admin',
    role: 'ADMIN'
  },
  {
    id: 'user-inspector',
    email: 'inspector@example.com',
    passwordHash: bcrypt.hashSync('Inspector123!', 10),
    name: 'Demo Inspector',
    role: 'INSPECTOR'
  },
  {
    id: 'user-viewer',
    email: 'viewer@example.com',
    passwordHash: bcrypt.hashSync('Viewer123!', 10),
    name: 'Demo Viewer',
    role: 'VIEWER'
  }
];

const seedInspections: Inspection[] = [
  {
    id: 'inspection-demo',
    building: 'Harbour View Apartments',
    location: 'Level 4, riser cupboard R4-12',
    notes: 'Annual passive fire inspection demonstration record.',
    status: 'ACTION_REQUIRED',
    inspectorId: 'user-inspector',
    inspectorName: 'Demo Inspector',
    observations: [{
      id: 'observation-demo',
      description: 'Fire collar identification label is missing from the service penetration.',
      severity: 'MEDIUM',
      remedialAction: 'Verify the tested system and reinstate a compliant label after remedial work.'
    }],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export async function initialiseStore(): Promise<void> {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(inspectionsFile);
  } catch {
    await writeInspections(seedInspections);
  }
}

async function writeInspections(inspections: Inspection[]): Promise<void> {
  await fs.writeFile(inspectionsFile, JSON.stringify(inspections, null, 2), 'utf8');
}

export async function listInspections(): Promise<Inspection[]> {
  const contents = await fs.readFile(inspectionsFile, 'utf8');
  return JSON.parse(contents) as Inspection[];
}

export async function getInspection(id: string): Promise<Inspection | undefined> {
  return (await listInspections()).find((inspection) => inspection.id === id);
}

export async function saveInspection(input: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Inspection> {
  const inspections = await listInspections();
  const now = new Date().toISOString();
  const existing = input.id ? inspections.find((inspection) => inspection.id === input.id) : undefined;
  const inspection: Inspection = {
    ...input,
    id: existing?.id ?? randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const next = existing
    ? inspections.map((item) => item.id === inspection.id ? inspection : item)
    : [inspection, ...inspections];
  await writeInspections(next);
  return inspection;
}

export async function deleteInspection(id: string): Promise<boolean> {
  const inspections = await listInspections();
  const next = inspections.filter((inspection) => inspection.id !== id);
  if (next.length === inspections.length) return false;
  await writeInspections(next);
  return true;
}

export function findUser(email: string): User | undefined {
  //if (process.env.NODE_ENV === 'production') return undefined;
  return demoUsers.find((user) => user.email === email.toLowerCase());
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}
