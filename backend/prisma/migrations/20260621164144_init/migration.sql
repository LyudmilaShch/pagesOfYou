-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('MAGAZINE', 'PHOTO_BOOK', 'ALBUM', 'CORPORATE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAID', 'IN_DESIGN', 'DESIGN_REVIEW', 'APPROVED', 'PRINTING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'TEXTAREA', 'RICH_TEXT', 'IMAGE', 'GALLERY', 'DATE', 'SELECT', 'NUMBER');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('YUKASSA', 'TBANK', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('DRAFT_CREATED', 'DRAFT_UPDATED', 'SUBMITTED', 'PAYMENT_INITIATED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED', 'ASSIGNED_TO_DESIGNER', 'DESIGN_COMPLETED', 'DESIGN_APPROVED', 'DESIGN_REVISION_REQUESTED', 'SENT_TO_PRINT', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'NOTE_ADDED', 'STATUS_CHANGED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magazine_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "productCategory" "ProductCategory" NOT NULL DEFAULT 'MAGAZINE',
    "tags" TEXT[],
    "coverImage" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "magazine_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magazine_styles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "previewImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "magazine_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magazine_type_styles" (
    "id" TEXT NOT NULL,
    "magazineTypeId" TEXT NOT NULL,
    "magazineStyleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "magazine_type_styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spread_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "spread_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magazine_type_spreads" (
    "id" TEXT NOT NULL,
    "magazineTypeId" TEXT NOT NULL,
    "spreadTemplateId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "magazine_type_spreads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spread_designs" (
    "id" TEXT NOT NULL,
    "spreadTemplateId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "previewImage" TEXT,
    "layoutJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "spread_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" TEXT NOT NULL,
    "spreadDesignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "placeholder" TEXT,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "validationRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_options" (
    "id" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "field_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "magazineTypeId" TEXT NOT NULL,
    "magazineStyleId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalPrice" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "magazineTypeSnapshot" JSONB,
    "magazineStyleSnapshot" JSONB,
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "pdfJobId" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_spreads" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "spreadTemplateId" TEXT NOT NULL,
    "spreadDesignId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "spreadDesignSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_spreads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_spread_field_values" (
    "id" TEXT NOT NULL,
    "orderSpreadId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "textValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_spread_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "previewKey" TEXT,
    "previewUrl" TEXT,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_value_files" (
    "id" TEXT NOT NULL,
    "orderSpreadFieldValueId" TEXT NOT NULL,
    "uploadedFileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "field_value_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "OrderEventType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_isBlocked_idx" ON "users"("role", "isBlocked");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "otp_codes_phone_usedAt_idx" ON "otp_codes"("phone", "usedAt");

-- CreateIndex
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_types_slug_key" ON "magazine_types"("slug");

-- CreateIndex
CREATE INDEX "magazine_types_isActive_sortOrder_idx" ON "magazine_types"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "magazine_types_productCategory_isActive_idx" ON "magazine_types"("productCategory", "isActive");

-- CreateIndex
CREATE INDEX "magazine_types_deletedAt_idx" ON "magazine_types"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_styles_slug_key" ON "magazine_styles"("slug");

-- CreateIndex
CREATE INDEX "magazine_styles_isActive_sortOrder_idx" ON "magazine_styles"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "magazine_styles_deletedAt_idx" ON "magazine_styles"("deletedAt");

-- CreateIndex
CREATE INDEX "magazine_type_styles_magazineTypeId_sortOrder_idx" ON "magazine_type_styles"("magazineTypeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_type_styles_magazineTypeId_magazineStyleId_key" ON "magazine_type_styles"("magazineTypeId", "magazineStyleId");

-- CreateIndex
CREATE UNIQUE INDEX "spread_templates_slug_key" ON "spread_templates"("slug");

-- CreateIndex
CREATE INDEX "spread_templates_isActive_sortOrder_idx" ON "spread_templates"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "spread_templates_deletedAt_idx" ON "spread_templates"("deletedAt");

-- CreateIndex
CREATE INDEX "magazine_type_spreads_magazineTypeId_sortOrder_idx" ON "magazine_type_spreads"("magazineTypeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "magazine_type_spreads_magazineTypeId_spreadTemplateId_key" ON "magazine_type_spreads"("magazineTypeId", "spreadTemplateId");

-- CreateIndex
CREATE INDEX "spread_designs_spreadTemplateId_styleId_isActive_idx" ON "spread_designs"("spreadTemplateId", "styleId", "isActive");

-- CreateIndex
CREATE INDEX "spread_designs_deletedAt_idx" ON "spread_designs"("deletedAt");

-- CreateIndex
CREATE INDEX "field_definitions_spreadDesignId_sortOrder_idx" ON "field_definitions"("spreadDesignId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_spreadDesignId_key_key" ON "field_definitions"("spreadDesignId", "key");

-- CreateIndex
CREATE INDEX "field_options_fieldDefinitionId_sortOrder_idx" ON "field_options"("fieldDefinitionId", "sortOrder");

-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_userId_deletedAt_idx" ON "orders"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");

-- CreateIndex
CREATE INDEX "order_spreads_orderId_sortOrder_idx" ON "order_spreads"("orderId", "sortOrder");

-- CreateIndex
CREATE INDEX "order_spread_field_values_orderSpreadId_idx" ON "order_spread_field_values"("orderSpreadId");

-- CreateIndex
CREATE UNIQUE INDEX "order_spread_field_values_orderSpreadId_fieldDefinitionId_key" ON "order_spread_field_values"("orderSpreadId", "fieldDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_files_storageKey_key" ON "uploaded_files"("storageKey");

-- CreateIndex
CREATE INDEX "uploaded_files_userId_idx" ON "uploaded_files"("userId");

-- CreateIndex
CREATE INDEX "uploaded_files_deletedAt_idx" ON "uploaded_files"("deletedAt");

-- CreateIndex
CREATE INDEX "field_value_files_orderSpreadFieldValueId_sortOrder_idx" ON "field_value_files"("orderSpreadFieldValueId", "sortOrder");

-- CreateIndex
CREATE INDEX "field_value_files_uploadedFileId_idx" ON "field_value_files"("uploadedFileId");

-- CreateIndex
CREATE UNIQUE INDEX "field_value_files_orderSpreadFieldValueId_uploadedFileId_key" ON "field_value_files"("orderSpreadFieldValueId", "uploadedFileId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_externalId_idx" ON "payments"("externalId");

-- CreateIndex
CREATE INDEX "payments_provider_status_idx" ON "payments"("provider", "status");

-- CreateIndex
CREATE INDEX "order_events_orderId_createdAt_idx" ON "order_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_events_type_idx" ON "order_events"("type");

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazine_type_styles" ADD CONSTRAINT "magazine_type_styles_magazineTypeId_fkey" FOREIGN KEY ("magazineTypeId") REFERENCES "magazine_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazine_type_styles" ADD CONSTRAINT "magazine_type_styles_magazineStyleId_fkey" FOREIGN KEY ("magazineStyleId") REFERENCES "magazine_styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazine_type_spreads" ADD CONSTRAINT "magazine_type_spreads_magazineTypeId_fkey" FOREIGN KEY ("magazineTypeId") REFERENCES "magazine_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magazine_type_spreads" ADD CONSTRAINT "magazine_type_spreads_spreadTemplateId_fkey" FOREIGN KEY ("spreadTemplateId") REFERENCES "spread_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spread_designs" ADD CONSTRAINT "spread_designs_spreadTemplateId_fkey" FOREIGN KEY ("spreadTemplateId") REFERENCES "spread_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spread_designs" ADD CONSTRAINT "spread_designs_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "magazine_styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_spreadDesignId_fkey" FOREIGN KEY ("spreadDesignId") REFERENCES "spread_designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_magazineTypeId_fkey" FOREIGN KEY ("magazineTypeId") REFERENCES "magazine_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_magazineStyleId_fkey" FOREIGN KEY ("magazineStyleId") REFERENCES "magazine_styles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_spreads" ADD CONSTRAINT "order_spreads_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_spreads" ADD CONSTRAINT "order_spreads_spreadTemplateId_fkey" FOREIGN KEY ("spreadTemplateId") REFERENCES "spread_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_spreads" ADD CONSTRAINT "order_spreads_spreadDesignId_fkey" FOREIGN KEY ("spreadDesignId") REFERENCES "spread_designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_spread_field_values" ADD CONSTRAINT "order_spread_field_values_orderSpreadId_fkey" FOREIGN KEY ("orderSpreadId") REFERENCES "order_spreads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_spread_field_values" ADD CONSTRAINT "order_spread_field_values_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_value_files" ADD CONSTRAINT "field_value_files_orderSpreadFieldValueId_fkey" FOREIGN KEY ("orderSpreadFieldValueId") REFERENCES "order_spread_field_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_value_files" ADD CONSTRAINT "field_value_files_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "uploaded_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
