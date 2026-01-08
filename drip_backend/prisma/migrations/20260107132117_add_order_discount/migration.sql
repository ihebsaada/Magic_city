-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountCode" TEXT,
ADD COLUMN     "originalTotal" DECIMAL(10,2);
