-- Kilka logo na jednym asortymencie: rodzaj (haft/DTF) i miejsce przenoszą się
-- ze zlecenia/szablonu do osobnych tabel. Istniejące dane przepisujemy:
-- każde zaznaczone miejsce staje się osobnym logo z rodzajem zlecenia, a opis
-- umiejscowienia trafia do pierwszego logo (albo do logo „inne miejsce").

-- CreateTable
CREATE TABLE "OrderLogo" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "OrderKind" NOT NULL,
    "placement" "OrderPlacement",
    "description" TEXT,

    CONSTRAINT "OrderLogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTemplateLogo" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "OrderKind" NOT NULL,
    "placement" "OrderPlacement",
    "description" TEXT,

    CONSTRAINT "OrderTemplateLogo_pkey" PRIMARY KEY ("id")
);

-- Przepisanie istniejących zleceń
INSERT INTO "OrderLogo" ("id", "orderId", "position", "kind", "placement", "description")
SELECT gen_random_uuid()::text, o."id", (p.ord - 1)::int, o."kind", p.pl,
       CASE WHEN p.ord = 1 THEN o."placementNotes" END
FROM "EmbroideryOrder" o, unnest(o."placements") WITH ORDINALITY AS p(pl, ord);

INSERT INTO "OrderLogo" ("id", "orderId", "position", "kind", "placement", "description")
SELECT gen_random_uuid()::text, o."id", 0, o."kind", NULL, o."placementNotes"
FROM "EmbroideryOrder" o
WHERE cardinality(o."placements") = 0;

-- Przepisanie istniejących szablonów
INSERT INTO "OrderTemplateLogo" ("id", "templateId", "position", "kind", "placement", "description")
SELECT gen_random_uuid()::text, t."id", (p.ord - 1)::int, t."kind", p.pl,
       CASE WHEN p.ord = 1 THEN t."placementNotes" END
FROM "OrderTemplate" t, unnest(t."placements") WITH ORDINALITY AS p(pl, ord);

INSERT INTO "OrderTemplateLogo" ("id", "templateId", "position", "kind", "placement", "description")
SELECT gen_random_uuid()::text, t."id", 0, t."kind", NULL, t."placementNotes"
FROM "OrderTemplate" t
WHERE cardinality(t."placements") = 0;

-- AlterTable
ALTER TABLE "EmbroideryOrder" DROP COLUMN "kind",
DROP COLUMN "placementNotes",
DROP COLUMN "placements";

-- AlterTable
ALTER TABLE "OrderTemplate" DROP COLUMN "kind",
DROP COLUMN "placementNotes",
DROP COLUMN "placements";

-- CreateIndex
CREATE INDEX "OrderLogo_orderId_position_idx" ON "OrderLogo"("orderId", "position");

-- CreateIndex
CREATE INDEX "OrderTemplateLogo_templateId_position_idx" ON "OrderTemplateLogo"("templateId", "position");

-- AddForeignKey
ALTER TABLE "OrderLogo" ADD CONSTRAINT "OrderLogo_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EmbroideryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTemplateLogo" ADD CONSTRAINT "OrderTemplateLogo_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OrderTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
