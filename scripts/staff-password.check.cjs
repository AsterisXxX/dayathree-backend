const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  validateStaffPassword,
} = require('./lib/staff-password');

test('accepts valid matching passwords', () => {
  assert.equal(
    validateStaffPassword(
      'ValidTestPassword123!',
      'ValidTestPassword123!',
    ),
    true,
  );
});

test('rejects different password confirmation', () => {
  assert.throws(
    () => validateStaffPassword(
      'ValidTestPassword123!',
      'DifferentPassword123!',
    ),
    /Password confirmation does not match/,
  );
});

test('rejects short passwords', () => {
  assert.throws(
    () => validateStaffPassword('short', 'short'),
    /12–128 characters/,
  );
});

test('rejects empty passwords', () => {
  assert.throws(
    () => validateStaffPassword('', ''),
    /12–128 characters/,
  );
});

test('rejects passwords exceeding 128 characters', () => {
  const password = 'A'.repeat(129);

  assert.throws(
    () => validateStaffPassword(password, password),
    /12–128 characters/,
  );
});

test('preserves password case sensitivity', () => {
  assert.throws(
    () => validateStaffPassword(
      'CaseSensitive123!',
      'casesensitive123!',
    ),
    /Password confirmation does not match/,
  );
});
