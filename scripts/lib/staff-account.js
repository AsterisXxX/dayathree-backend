async function createStaffAccount(db, input) {
  const { email, fullName, passwordHash, roleId } = input;

  return db.user.create({
    data: {
      email,
      fullName,
      passwordHash,
      roles: {
        create: {
          role: {
            connect: { id: roleId },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      roles: {
        select: {
          role: {
            select: { code: true },
          },
        },
      },
    },
  });
}

module.exports = { createStaffAccount };
