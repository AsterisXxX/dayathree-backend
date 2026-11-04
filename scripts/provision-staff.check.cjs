require('dotenv/config');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const script = path.join(__dirname, 'provision-staff.js');

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    timeout: 15000,
  });
}

const input = (email, role = 'RIDER', name = 'Test Rider') => [
  '--dry-run',
  '--email', email,
  '--name', name,
  '--role', role,
];

test('accepts Rider and normalizes email', () => {
  const result = run(input('  RIDER.TEST@example.invalid  '));

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rider\.test@example\.invalid/);
  assert.match(result.stdout, /DRY_RUN_COMPLETE/);
});

test('accepts Checker', () => {
  const result = run(input(
    'checker.test@example.invalid',
    'CHECKER',
    'Test Checker',
  ));

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CHECKER/);
});

test('rejects unauthorized role', () => {
  const result = run(input(
    'admin@example.invalid',
    'ADMIN',
  ));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid staff role/);
});

test('rejects invalid email', () => {
  const result = run(input('invalid-email'));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid email/);
});

test('rejects empty name', () => {
  const result = run(input(
    'rider@example.invalid',
    'RIDER',
    '  ',
  ));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid full name/);
});

test('rejects apply without an interactive terminal', () => {
  const result = run([
    '--apply',
    '--email', 'rider@example.invalid',
    '--name', 'Test Rider',
    '--role', 'RIDER',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /interactive terminal/);
});

test('blocks apply in production', () => {
  const result = spawnSync(
    process.execPath,
    [
      script,
      '--apply',
      '--email', 'rider@example.invalid',
      '--name', 'Test Rider',
      '--role', 'RIDER',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
      timeout: 15000,
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Production provisioning requires/,
  );
});

test('dry-run does not modify users or assignments', async () => {
  const prisma = new PrismaClient();

  try {
    const beforeUsers = await prisma.user.count();
    const beforeAssignments = await prisma.userRole.count();

    const result = run(input(
      'safe-test@example.invalid',
    ));

    assert.equal(result.status, 0, result.stderr);

    const afterUsers = await prisma.user.count();
    const afterAssignments = await prisma.userRole.count();

    assert.equal(afterUsers, beforeUsers);
    assert.equal(afterAssignments, beforeAssignments);
  } finally {
    await prisma.$disconnect();
  }
});
