require('dotenv/config');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const { createStaffAccount } = require('./lib/staff-account');

const prisma = new PrismaClient();
const ROLLBACK = 'EXPECTED_STAFF_TEST_ROLLBACK';

async function rollbackTest(callback) {
  let completed = false;

  try {
    await prisma.$transaction(
      async (tx) => {
        await callback(tx);
        completed = true;
        throw new Error(ROLLBACK);
      },
      { maxWait: 10000, timeout: 20000 },
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== ROLLBACK
    ) {
      throw error;
    }
  }

  assert.equal(completed, true);
}

function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    raw: false,
  });
}

test('shared function creates Rider with Argon2id and role', async () => {
  const email = `staff-${randomUUID()}@example.invalid`;
  const password = 'TemporaryStrongPassword123!';

  await rollbackTest(async (tx) => {
    const role = await tx.role.findUnique({
      where: { code: 'RIDER' },
    });

    assert.ok(role, 'RIDER role must exist');

    const created = await createStaffAccount(tx, {
      email,
      fullName: 'Temporary Test Rider',
      passwordHash: await hashPassword(password),
      roleId: role.id,
    });

    assert.equal(created.email, email);
    assert.equal(created.fullName, 'Temporary Test Rider');
    assert.equal(created.roles.length, 1);
    assert.equal(created.roles[0].role.code, 'RIDER');

    assert.equal(
      Object.hasOwn(created, 'passwordHash'),
      false,
    );

    const stored = await tx.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { passwordHash: true },
    });

    assert.notEqual(stored.passwordHash, password);
    assert.match(stored.passwordHash, /^\$argon2id\$/);

    assert.equal(
      await argon2.verify(stored.passwordHash, password),
      true,
    );
  });

  const persisted = await prisma.user.findUnique({
    where: { email },
  });

  assert.equal(persisted, null);
});

test('shared function rejects duplicate email', async () => {
  const email = `duplicate-${randomUUID()}@example.invalid`;

  await rollbackTest(async (tx) => {
    const role = await tx.role.findUnique({
      where: { code: 'CHECKER' },
    });

    assert.ok(role, 'CHECKER role must exist');

    const input = {
      email,
      fullName: 'Temporary Test Checker',
      passwordHash: await hashPassword(
        'TemporaryStrongPassword123!',
      ),
      roleId: role.id,
    };

    await createStaffAccount(tx, input);

    await assert.rejects(
      createStaffAccount(tx, input),
      (error) => error && error.code === 'P2002',
    );
  });

  const persisted = await prisma.user.findUnique({
    where: { email },
  });

  assert.equal(persisted, null);
});

test.after(async () => {
  await prisma.$disconnect();
});
