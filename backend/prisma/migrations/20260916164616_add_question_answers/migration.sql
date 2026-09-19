-- CreateTable
CREATE TABLE "question_answers" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "textValue" TEXT,
    "jsonValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_answers_orderId_idx" ON "question_answers"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "question_answers_orderId_questionKey_key" ON "question_answers"("orderId", "questionKey");

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
