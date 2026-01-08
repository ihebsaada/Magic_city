-- DropForeignKey
ALTER TABLE "ProductCollection" DROP CONSTRAINT "ProductCollection_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "ProductCollection" DROP CONSTRAINT "ProductCollection_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_productId_fkey";

-- DropForeignKey
ALTER TABLE "Variant" DROP CONSTRAINT "Variant_productId_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "option1Name" TEXT,
ADD COLUMN     "option2Name" TEXT,
ADD COLUMN     "option3Name" TEXT;

-- AlterTable
ALTER TABLE "Variant" ALTER COLUMN "inventoryQuantity" SET DEFAULT 999;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
