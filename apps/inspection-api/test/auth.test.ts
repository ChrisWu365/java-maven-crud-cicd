import test from 'node:test';
import assert from 'node:assert/strict';
import { issueToken } from '../src/auth.js';

test('issues a role-bearing token for an authenticated user', () => {
  const token = issueToken({
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    role: 'INSPECTOR',
    passwordHash: 'not-used'
  });
  assert.equal(typeof token, 'string');
  assert.ok(token.split('.').length === 3);
});
