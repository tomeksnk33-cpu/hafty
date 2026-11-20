-- Asortyment rozliczany w kg albo w sztukach; wpisuje się zawsze sztuki i kilogramy.
ALTER TABLE "LaundryCatalogEntry" ADD COLUMN "billKg" BOOLEAN NOT NULL DEFAULT false;

UPDATE "LaundryCatalogEntry" SET "billKg" = true WHERE "kind" = 'ITEM' AND "unit" = 'KG';
UPDATE "LaundryCatalogEntry" SET "unit" = 'SZT_KG' WHERE "kind" = 'ITEM';
