import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes passwords using Argon2id', async () => {
    const hash = await service.hash('TestPassword123!');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('TestPassword123!');
  });

  it('verifies a correct password', async () => {
    const password = 'TestPassword123!';
    const hash = await service.hash(password);

    await expect(service.verify(hash, password)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('CorrectPassword123!');

    await expect(
      service.verify(hash, 'WrongPassword123!'),
    ).resolves.toBe(false);
  });

  it('rejects malformed hashes', async () => {
    await expect(
      service.verify('invalid-hash', 'TestPassword123!'),
    ).resolves.toBe(false);
  });

  it('rejects empty passwords', async () => {
    await expect(service.hash('')).rejects.toThrow(
      'Password must not be empty',
    );
  });

  it('rejects empty verification inputs', async () => {
    await expect(service.verify('', 'password')).resolves.toBe(false);
    await expect(service.verify('hash', '')).resolves.toBe(false);
  });
});
