function validateStaffPassword(password, confirmation) {
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 128 ||
    !password.trim()
  ) {
    throw new Error(
      'Password must contain 12–128 characters',
    );
  }

  if (password !== confirmation) {
    throw new Error('Password confirmation does not match');
  }

  return true;
}

module.exports = { validateStaffPassword };
