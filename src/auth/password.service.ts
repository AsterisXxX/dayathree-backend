import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService implements OnModuleInit {
  private readonly dummyHashPromise = this.hash(
    randomBytes(32).toString('hex'),
  );

  async onModuleInit(): Promise<void> {
    await this.dummyHashPromise;
  }

  async getDummyHash(): Promise<string> {
    return this.dummyHashPromise;
  }

  async hash(password: string): Promise<string> {
    if (!password) {
      throw new Error('Password must not be empty');
    }

    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      raw: false,
    });
  }

  async verify(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    if (!passwordHash || !password) {
      return false;
    }

    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
