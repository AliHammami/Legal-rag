-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "penal_code_chunks" (
    "chunk_id" TEXT NOT NULL,
    "article_number" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "char_count" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" vector(3072) NOT NULL,
    "embedding_model" TEXT NOT NULL,
    "embedded_at" TIMESTAMP(3) NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penal_code_chunks_pkey" PRIMARY KEY ("chunk_id")
);

-- CreateIndex
CREATE INDEX "penal_code_chunks_article_number_idx" ON "penal_code_chunks"("article_number");

-- HNSW index deferred to retrieval step (corpus ~1368 rows)
