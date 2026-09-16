# Persistance multi-corpus (PostgreSQL + pgvector)

## Table `legal_code_chunks`

Les chunks et embeddings de tous les corpus juridiques sont stock\u00E9s dans une table unique :

```text
legal_code_chunks
```

Mod\u00E8le Prisma : `LegalCodeChunk`

## Identit\u00E9

Cl\u00E9 logique unique :

```text
(corpusId, chunkId)
```

- `corpusId` : identifiant du corpus (`code-penal`, `code-civil`, ...)
- `chunkId` : identifiant stable du chunk dans le corpus (`122-5#0`, ...)
- `id` : cl\u00E9 primaire technique Prisma (`cuid()`)

`articleNumber` reste la r\u00E9f\u00E9rence juridique ; il n'est pas pr\u00E9fix\u00E9 par le corpus.

## Vecteurs

```sql
embedding vector(3072)
```

Mod\u00E8le cible : `text-embedding-3-large`

Extension PostgreSQL :

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Pas d'index HNSW \u00E0 ce stade (~33k chunks).

## Index

- `corpus_id`
- `(corpus_id, article_number)`
- `UNIQUE (corpus_id, chunk_id)`

## Import

Pipeline s\u00E9par\u00E9 :

```text
chunks -> g\u00E9n\u00E9ration embeddings -> import persistance
```

Commandes :

```bash
pnpm import:corpus code-penal
pnpm import:corpus all   # ignore les corpus sans fichier .embeddings.json
pnpm import:code-penal   # alias code-penal
```

Fichiers embeddings attendus :

```text
data/processed/{corpusId}.embeddings.json
```

L'import est idempotent : upsert sur `(corpus_id, chunk_id)`.

## Retrieval (temporaire)

Le retrieval existant filtre encore sur :

```text
corpus_id = 'code-penal'
```

La g\u00E9n\u00E9ralisation multi-corpus du retrieval est pr\u00E9vue dans une \u00E9tape ult\u00E9rieure.
