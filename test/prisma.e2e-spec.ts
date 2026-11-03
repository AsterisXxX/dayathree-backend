import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PrismaService Integration', () => {
  it('resolves PrismaService and queries PostgreSQL', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    try {
      await moduleRef.init();

      const prisma = moduleRef.get(PrismaService);

      expect(prisma).toBeDefined();

      const result = await prisma.$queryRaw<
        Array<{ database: string; db_user: string }>
      >`
        SELECT
          current_database() AS database,
          current_user AS db_user
      `;

      expect(result).toHaveLength(1);
      expect(result[0].database).toBe('dayathree');
      expect(result[0].db_user).toBe('dayathree_app');
    } finally {
      await moduleRef.close();
    }
  });
});
