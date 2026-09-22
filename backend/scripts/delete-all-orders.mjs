// One-off cleanup: permanently deletes EVERY order (and everything that hangs off it —
// JournalPage/PlaceholderValue/OrderSpread/QuestionAnswer/UploadedFile via cascade, plus
// Payment/OrderEvent which don't cascade and are deleted explicitly below) from whatever
// database DATABASE_URL points to. Built for wiping out orders that predate the R2→Yandex
// Object Storage photo-storage fix — their photos are already unrecoverable (Render's ephemeral
// disk wiped them), so keeping the empty order records around is more confusing than useful.
//
// Run it with the PRODUCTION database (Render's own shell already has DATABASE_URL set to
// production — that's the simplest way; otherwise set DATABASE_URL to the production connection
// string yourself before running this locally). It does NOT run automatically — you must pass
// --yes, and it prints exactly what it's about to delete first.
//
// Usage:
//   node scripts/delete-all-orders.mjs           (dry run — just prints counts)
//   node scripts/delete-all-orders.mjs --yes      (actually deletes)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const confirmed = process.argv.includes('--yes');

const [orderCount, paymentCount, eventCount] = await Promise.all([
  prisma.order.count(),
  prisma.payment.count(),
  prisma.orderEvent.count(),
]);

console.log(`Заказов: ${orderCount}`);
console.log(`Платежей (payments): ${paymentCount}`);
console.log(`Событий заказа (orderEvent): ${eventCount}`);
console.log('(JournalPage/PlaceholderValue/OrderSpread/QuestionAnswer/UploadedFile удалятся каскадом вместе с заказами)');

if (!confirmed) {
  console.log('\nЭто был тестовый прогон — ничего не удалено. Запустите с флагом --yes, чтобы удалить по-настоящему.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('\nУдаляю...');

await prisma.payment.deleteMany({});
await prisma.orderEvent.deleteMany({});
const result = await prisma.order.deleteMany({});

console.log(`Готово. Удалено заказов: ${result.count}.`);

await prisma.$disconnect();
