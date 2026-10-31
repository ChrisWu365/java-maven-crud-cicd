import test from 'node:test';
import assert from 'node:assert/strict';
import { initialiseStore, saveInspection, listInspections, getInspection, deleteInspection } from '../src/store.js';
import { issueToken } from '../src/auth.js';

test('API Integration Tests - Setup', async () => {
  await initialiseStore();
  assert.ok(true, 'Store initialized');
});

test('Health Check - can list inspections', async () => {
  const inspections = await listInspections();
  assert.ok(Array.isArray(inspections));
});

test('Inspection CRUD - create a new inspection', async () => {
  const newInspection = {
    building: 'Test Building',
    location: 'Room 101',
    notes: 'Test inspection notes',
    status: 'DRAFT' as const,
    observations: [],
    photos: []
  };

  const inspection = await saveInspection({
    ...newInspection,
    id: undefined,
    inspectorId: 'inspector-1',
    inspectorName: 'Inspector User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  assert.equal(typeof inspection.id, 'string');
  assert.equal(inspection.building, 'Test Building');
  assert.equal(inspection.location, 'Room 101');
});

test('Inspection CRUD - list all inspections', async () => {
  const inspections = await listInspections();
  assert.ok(Array.isArray(inspections));
});

test('Inspection CRUD - get inspection by ID', async () => {
  const inspection = await saveInspection({
    id: undefined,
    building: 'Test Building',
    location: 'Room 102',
    notes: 'Test get',
    status: 'DRAFT',
    inspectorId: 'inspector-1',
    inspectorName: 'Inspector User',
    observations: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const retrieved = await getInspection(inspection.id);
  assert.notEqual(retrieved, null);
  assert.equal(retrieved?.id, inspection.id);
  assert.equal(retrieved?.building, 'Test Building');
});

test('Inspection CRUD - update inspection', async () => {
  const inspection = await saveInspection({
    id: undefined,
    building: 'Test Building',
    location: 'Room 103',
    notes: 'Test update',
    status: 'DRAFT',
    inspectorId: 'inspector-1',
    inspectorName: 'Inspector User',
    observations: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const updated = await saveInspection({
    ...inspection,
    notes: 'Updated notes',
    status: 'IN_PROGRESS'
  });

  assert.equal(updated.id, inspection.id);
  assert.equal(updated.notes, 'Updated notes');
  assert.equal(updated.status, 'IN_PROGRESS');
});

test('Inspection CRUD - delete inspection', async () => {
  const inspection = await saveInspection({
    id: undefined,
    building: 'Test Building',
    location: 'Room 104',
    notes: 'Test delete',
    status: 'DRAFT',
    inspectorId: 'inspector-1',
    inspectorName: 'Inspector User',
    observations: [],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const deleted = await deleteInspection(inspection.id);
  assert.equal(deleted, true);

  const retrieved = await getInspection(inspection.id);
  assert.ok(!retrieved);
});

test('Observation Management - add observations to inspection', async () => {
  const inspection = await saveInspection({
    id: undefined,
    building: 'Test Building',
    location: 'Room 105',
    notes: 'Test with observations',
    status: 'DRAFT',
    inspectorId: 'inspector-1',
    inspectorName: 'Inspector User',
    observations: [
      {
        id: 'obs-1',
        description: 'Fire door damaged',
        severity: 'HIGH',
        remedialAction: 'Replace door'
      }
    ],
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  assert.equal(inspection.observations.length, 1);
  assert.equal(inspection.observations[0].description, 'Fire door damaged');
  assert.equal(inspection.observations[0].severity, 'HIGH');
});

test('JWT Token - issues role-bearing token', () => {
  const token = issueToken({
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    role: 'INSPECTOR',
    passwordHash: 'not-used'
  });
  assert.equal(typeof token, 'string');
  assert.equal(token.split('.').length, 3);
});
