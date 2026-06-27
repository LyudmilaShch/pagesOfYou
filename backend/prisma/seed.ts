/**
 * Prisma Seed — creates the default admin account.
 *
 * Run:
 *   npx ts-node prisma/seed.ts
 *   — or —
 *   npx prisma db seed  (if "prisma.seed" is set in package.json)
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';
const BCRYPT_ROUNDS = 10;

async function normalizeCoverImages(): Promise<void> {
  const types = await prisma.magazineType.findMany({
    where: { coverImage: { not: null } },
    select: { id: true, coverImage: true },
  });

  for (const type of types) {
    const match = type.coverImage?.match(/\/uploads\/[^\s?#]+/i);
    if (match && type.coverImage !== match[0]) {
      await prisma.magazineType.update({
        where: { id: type.id },
        data: { coverImage: match[0] },
      });
      console.log(`✅ Normalized coverImage for magazine type ${type.id}`);
    }
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  await normalizeCoverImages();

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log(`✅ Admin already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      name: 'Administrator',
    },
  });

  console.log(`✅ Admin created: ${admin.email} (id: ${admin.id})`);
  console.log(`   Login:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log('⚠️  Change the password after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
