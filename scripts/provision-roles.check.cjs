require('dotenv/config');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync, spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const path = require('node:path');

const script = path.join(__dirname, 'provision-roles.js');

function run(args, env = {}) {
  return spawnSync(
    process.execPath,
    [script, ...args],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...env,
      },
      timeout: 15000,
    },
  );
}

test('dry-run does not change roles or assignments', async () => {
  const prisma = new PrismaClient();

  try {
    const beforeRoles = await prisma.role.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    const beforeAssignments = await prisma.userRole.count();

    const result = run(['--dry-run']);

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /DRY_RUN_COMPLETE/);

    const afterRoles = await prisma.role.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    const afterAssignments = await prisma.userRole.count();

    assert.deepEqual(afterRoles, beforeRoles);
    assert.equal(afterAssignments, beforeAssignments);
  } finally {
    await prisma.$disconnect();
  }
});

test('rejects unsupported CLI arguments', () => {
  const result = run(['--unknown']);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Usage: node scripts\/provision-roles\.js/,
  );
});

test('blocks apply when NODE_ENV is production', () => {
  const result = run(
    ['--apply'],
    { NODE_ENV: 'production' },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Production provisioning requires/,
  );
});
