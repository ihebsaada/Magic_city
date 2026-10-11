-- Measured on isolated PostgreSQL: exact-product relation queries changed from
-- sequential scans (~1 ms) to indexed scans (~0.02 ms); no data rewrite.
CREATE INDEX "Variant_productId_id_idx" ON "Variant"("productId","id");
CREATE INDEX "ProductImage_productId_position_id_idx" ON "ProductImage"("productId","position","id");
