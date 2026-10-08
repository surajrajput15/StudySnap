import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from '../lib/config.ts';

test('isSuperAdminEmail correctly identifies surajdona2005@gmail.com', () => {
  assert.equal(isSuperAdminEmail('surajdona2005@gmail.com'), true);
  assert.equal(isSuperAdminEmail('SURAJDONA2005@GMAIL.COM'), true);
  assert.equal(isSuperAdminEmail('  surajdona2005@gmail.com  '), true);
});

test('isSuperAdminEmail rejects unauthorized student emails', () => {
  assert.equal(isSuperAdminEmail('student@example.com'), false);
  assert.equal(isSuperAdminEmail('random.user@gmail.com'), false);
  assert.equal(isSuperAdminEmail(''), false);
  assert.equal(isSuperAdminEmail(null), false);
  assert.equal(isSuperAdminEmail(undefined), false);
});

test('SUPER_ADMIN_EMAIL constant defaults to surajdona2005@gmail.com', () => {
  assert.equal(SUPER_ADMIN_EMAIL.toLowerCase(), 'surajdona2005@gmail.com');
});
