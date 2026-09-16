-- Rename penal_code_chunks to legal_code_chunks and add multi-corpus identity.

ALTER TABLE "penal_code_chunks" RENAME TO "legal_code_chunks";

ALTER TABLE "legal_code_chunks"
  ADD COLUMN "corpus_id" TEXT NOT NULL DEFAULT 'code-penal';

ALTER TABLE "legal_code_chunks"
  ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE "legal_code_chunks" DROP CONSTRAINT "penal_code_chunks_pkey";

ALTER TABLE "legal_code_chunks"
  ADD CONSTRAINT "legal_code_chunks_pkey" PRIMARY KEY ("id");

ALTER TABLE "legal_code_chunks"
  ADD CONSTRAINT "legal_code_chunks_corpus_id_chunk_id_key" UNIQUE ("corpus_id", "chunk_id");

DROP INDEX IF EXISTS "penal_code_chunks_article_number_idx";

CREATE INDEX "legal_code_chunks_corpus_id_idx"
  ON "legal_code_chunks"("corpus_id");

CREATE INDEX "legal_code_chunks_corpus_id_article_number_idx"
  ON "legal_code_chunks"("corpus_id", "article_number");

ALTER TABLE "legal_code_chunks" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "legal_code_chunks" ALTER COLUMN "corpus_id" DROP DEFAULT;
