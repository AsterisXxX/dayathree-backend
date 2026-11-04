require('dotenv/config');

const { PrismaClient, Prisma } = require('@prisma/client');
const argon2 = require('argon2');
const readline = require('node:readline');
const { createStaffAccount } = require('./lib/staff-account');
const { validateStaffPassword } = require('./lib/staff-password');

const prisma = new PrismaClient();
const ALLOWED_ROLES = new Set(['RIDER', 'CHECKER']);

function parseArguments(args) {
  const result = {};

  if (!['--dry-run', '--apply'].includes(args[0])) {
    throw new Error('Mode must be --dry-run or --apply');
  }

  result.mode = args[0];

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    if (
      !['--email', '--name', '--role'].includes(key) ||
      !value ||
      result[key] !== undefined
    ) {
      throw new Error('Invalid or duplicate argument');
    }

    result[key] = value;
  }

  if (Object.keys(result).length !== 4) {
    throw new Error('Missing required arguments');
  }

  return result;
}

function validateInput(args) {
  const email = args['--email'].trim().toLowerCase();
  const fullName = args['--name'].trim();
  const roleCode = args['--role'];

  if (
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('Invalid email');
  }

  if (
    !fullName ||
    fullName.length > 150 ||
    /[\u0000-\u001f\u007f]/.test(fullName)
  ) {
    throw new Error('Invalid full name');
  }

  if (!ALLOWED_ROLES.has(roleCode)) {
    throw new Error('Invalid staff role');
  }

  return { email, fullName, roleCode };
}

// Password is read directly from a TTY without terminal echo.
// It is never accepted through CLI arguments.
function readSecret(prompt) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error('Apply requires an interactive terminal');
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = Boolean(input.isRaw);
    let secret = '';

    readline.emitKeypressEvents(input);
    process.stderr.write(prompt);

    function cleanup() {
      input.removeListener('keypress', onKey);
      input.setRawMode(wasRaw);
      input.pause();
      process.stderr.write('\n');
    }

    function onKey(value, key = {}) {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Provisioning cancelled'));
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(secret);
        return;
      }

      if (key.name === 'backspace') {
        secret = secret.slice(0, -1);
        return;
      }

      if (key.ctrl || key.meta || key.name === 'escape') {
        return;
      }

      if (
        typeof value === 'string' &&
        /^[^\u0000-\u001f\u007f]+$/u.test(value) &&
        secret.length + value.length <= 1024
      ) {
        secret += value;
      }
    }

    input.on('keypress', onKey);
    input.setRawMode(true);
    input.resume();
  });
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const input = validateInput(args);
  const apply = args.mode === '--apply';

  if (apply && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Production provisioning requires a separate deployment procedure',
    );
  }

  if (
    apply &&
    (!process.stdin.isTTY || !process.stderr.isTTY)
  ) {
    throw new Error('Apply requires an interactive terminal');
  }

  const [existingUser, role] = await Promise.all([
    prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    }),
    prisma.role.findUnique({
      where: { code: input.roleCode },
      select: { id: true },
    }),
  ]);

  if (existingUser) {
    throw new Error('Account already exists');
  }

  if (!role) {
    throw new Error('Required role is not provisioned');
  }

  if (!apply) {
    console.log('=== STAFF PROVISIONING DRY RUN ===');
    console.log({
      email: input.email,
      fullName: input.fullName,
      role: input.roleCode,
      action: 'CREATE_NEW_STAFF_ACCOUNT',
    });
    console.log('DRY_RUN_COMPLETE — database unchanged');
    return;
  }

  console.log('=== STAFF PROVISIONING APPLY ===');
  console.log({
    email: input.email,
    fullName: input.fullName,
    role: input.roleCode,
  });

  const password = await readSecret('New password: ');
  const confirmation = await readSecret('Confirm password: ');

  validateStaffPassword(password, confirmation);

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    raw: false,
  });

  try {
    const created = await createStaffAccount(prisma, {
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      roleId: role.id,
    });

    console.log({
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      roles: created.roles.map((item) => item.role.code),
    });

    console.log('STAFF_PROVISIONING_COMPLETE');
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new Error('Account already exists');
    }

    throw error;
  }
}

main()
  .catch((error) => {
    console.error(
      'STAFF_PROVISIONING_FAILED:',
      error.message,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
