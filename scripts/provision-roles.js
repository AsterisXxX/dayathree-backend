require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const REQUIRED_ROLES = [
  { code: 'RIDER', name: 'Rider' },
  { code: 'CHECKER', name: 'Checker' },
];

async function main() {
  const args = process.argv.slice(2);

  if (
    args.length !== 1 ||
    !['--dry-run', '--apply'].includes(args[0])
  ) {
    throw new Error(
      'Usage: node scripts/provision-roles.js --dry-run|--apply',
    );
  }

  const apply = args[0] === '--apply';

  if (apply && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Production provisioning requires a separate deployment procedure',
    );
  }

  console.log(
    `=== ROLE PROVISIONING: ${apply ? 'APPLY' : 'DRY RUN'} ===`,
  );

  const existing = await prisma.role.findMany({
    where: {
      code: {
        in: REQUIRED_ROLES.map((role) => role.code),
      },
    },
    select: {
      code: true,
      name: true,
    },
  });

  const existingByCode = new Map(
    existing.map((role) => [role.code, role]),
  );

  for (const role of REQUIRED_ROLES) {
    const current = existingByCode.get(role.code);

    console.log(
      `${role.code}: ${
        current
          ? `EXISTS (${current.name})`
          : 'MISSING — will create'
      }`,
    );
  }

  if (!apply) {
    console.log('DRY_RUN_COMPLETE — database unchanged');
    return;
  }

  await prisma.$transaction(
    REQUIRED_ROLES.map((role) =>
      prisma.role.upsert({
        where: { code: role.code },
        create: role,
        update: {},
      }),
    ),
  );

  const verified = await prisma.role.findMany({
    where: {
      code: {
        in: REQUIRED_ROLES.map((role) => role.code),
      },
    },
    select: {
      code: true,
      name: true,
    },
    orderBy: { code: 'asc' },
  });

  if (
    verified.length !== REQUIRED_ROLES.length ||
    REQUIRED_ROLES.some(
      (role) =>
        !verified.some((item) => item.code === role.code),
    )
  ) {
    throw new Error('ROLE_PROVISIONING_VERIFICATION_FAILED');
  }

  console.log(JSON.stringify(verified, null, 2));
  console.log('ROLE_PROVISIONING_COMPLETE');
}

main()
  .catch((error) => {
    console.error('ROLE_PROVISIONING_FAILED:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
