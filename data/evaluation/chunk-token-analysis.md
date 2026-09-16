# Analyse tokens des chunks

Généré le : 2026-09-16T18:37:36.700Z

## Configuration

- Tokenizer : `tiktoken`
- Encoding : `cl100k_base`
- Modèle cible : `text-embedding-3-large`
- TARGET_SIZE : 1500 caractères
- MAX_SIZE : 2000 caractères

## Comparaison globale des corpus

| Corpus | Chunks | Avg chars | P50 chars | P95 chars | Max chars | Avg tokens | P50 tokens | P95 tokens | P99 tokens | Max tokens | Avg chars/token | Global chars/token | >=1000 tok | >=1500 tok | >=2000 tok | >=2500 tok |
|--------|-------:|----------:|----------:|----------:|----------:|-----------:|-----------:|-----------:|-----------:|-----------:|----------------:|-------------------:|-----------:|-----------:|-----------:|-----------:|
| Code pénal | 1367 | 624.6 | 474 | 1766 | 2000 | 179.62 | 138 | 492.7 | 551 | 611 | 3.46 | 3.4773 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Code civil | 2919 | 381.16 | 282 | 1035.2 | 1977 | 107.18 | 80 | 289 | 478 | 605 | 3.57 | 3.5564 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Code du travail | 12177 | 571.52 | 420 | 1712 | 2000 | 157.29 | 116 | 456 | 540 | 1071 | 3.65 | 3.6336 | 1 (0.01%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Code de commerce | 8334 | 737.81 | 544 | 1884.35 | 2000 | 203.84 | 153 | 502 | 562 | 869 | 3.6 | 3.6197 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Code monétaire et financier | 6645 | 922.04 | 763 | 1934 | 2000 | 266.33 | 219 | 561.8 | 758.56 | 1003 | 3.51 | 3.4621 | 3 (0.05%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Code de la consommation | 2242 | 644.37 | 463 | 1839.95 | 2000 | 180.05 | 128 | 489 | 573.18 | 969 | 3.6 | 3.5788 | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |

## Code pénal (`code-penal`)

- Fichier : `data/processed/code-penal.chunks.json`
- Chunks : 1367
- Total caractères : 853825
- Total tokens : 245543
- Ratio global caractères/token : 3.4773

### Caractères

| Metric | Value |
|--------|------:|
| min | 39 |
| mean | 624.6 |
| P50 | 474 |
| P75 | 814 |
| P90 | 1380 |
| P95 | 1766 |
| P99 | 1952.68 |
| max | 2000 |

### Tokens

| Metric | Value |
|--------|------:|
| min | 12 |
| mean | 179.62 |
| P50 | 138 |
| P75 | 234.5 |
| P90 | 395 |
| P95 | 492.7 |
| P99 | 551 |
| max | 611 |

### Ratio caractères/token

| Metric | Value |
|--------|------:|
| min | 2.0253 |
| mean | 3.46 |
| P50 | 3.4559 |
| P75 | 3.62 |
| P90 | 3.76 |
| P95 | 3.85 |
| P99 | 4.06 |
| max | 4.5532 |

### Distribution des tokens

| Bucket | Count | Percentage |
|--------|------:|-----------:|
| 0-249 | 1060 | 77.54% |
| 250-499 | 247 | 18.07% |
| 500-749 | 60 | 4.39% |
| 750-999 | 0 | 0% |
| 1000-1249 | 0 | 0% |
| 1250-1499 | 0 | 0% |
| 1500-1749 | 0 | 0% |
| 1750-1999 | 0 | 0% |
| 2000-2249 | 0 | 0% |
| 2250-2499 | 0 | 0% |
| 2500-2999 | 0 | 0% |
| 3000+ | 0 | 0% |

### Seuils tokeniques

| Threshold | Count | Percentage |
|-----------|------:|-----------:|
| >= 500 | 60 | 4.39% |
| >= 750 | 0 | 0% |
| >= 1000 | 0 | 0% |
| >= 1250 | 0 | 0% |
| >= 1500 | 0 | 0% |
| >= 2000 | 0 | 0% |
| >= 2500 | 0 | 0% |
| >= 3000 | 0 | 0% |

### Top 10 chunks (tokens)

| chunkId | articleNumber | chunkIndex | chunkCount | charCount | tokenCount | chars/token |
|---------|---------------|----------:|-----------:|----------:|-----------:|------------:|
| 421-1#0 | 421-1 | 0 | 1 | 1788 | 611 | 2.9264 |
| 322-15#0 | 322-15 | 0 | 2 | 1963 | 601 | 3.2662 |
| 222-44#0 | 222-44 | 0 | 2 | 1948 | 581 | 3.3528 |
| 132-77#0 | 132-77 | 0 | 1 | 1977 | 577 | 3.4263 |
| 222-14-5#0 | 222-14-5 | 0 | 2 | 2000 | 574 | 3.4843 |
| 321-9#0 | 321-9 | 0 | 2 | 1973 | 574 | 3.4373 |
| 322-5#0 | 322-5 | 0 | 1 | 1834 | 564 | 3.2518 |
| 311-4#0 | 311-4 | 0 | 2 | 1963 | 556 | 3.5306 |
| 322-3#0 | 322-3 | 0 | 2 | 1966 | 556 | 3.536 |
| 131-26-2#0 | 131-26-2 | 0 | 1 | 1471 | 553 | 2.66 |

### Anomalies

_Aucune anomalie non bloquante._

## Code civil (`code-civil`)

- Fichier : `data/processed/code-civil.chunks.json`
- Chunks : 2919
- Total caractères : 1112602
- Total tokens : 312844
- Ratio global caractères/token : 3.5564

### Caractères

| Metric | Value |
|--------|------:|
| min | 27 |
| mean | 381.16 |
| P50 | 282 |
| P75 | 470.5 |
| P90 | 768.2 |
| P95 | 1035.2 |
| P99 | 1712.98 |
| max | 1977 |

### Tokens

| Metric | Value |
|--------|------:|
| min | 9 |
| mean | 107.18 |
| P50 | 80 |
| P75 | 133 |
| P90 | 219 |
| P95 | 289 |
| P99 | 478 |
| max | 605 |

### Ratio caractères/token

| Metric | Value |
|--------|------:|
| min | 2.4545 |
| mean | 3.57 |
| P50 | 3.5596 |
| P75 | 3.72 |
| P90 | 3.9 |
| P95 | 4.03 |
| P99 | 4.34 |
| max | 5.2353 |

### Distribution des tokens

| Bucket | Count | Percentage |
|--------|------:|-----------:|
| 0-249 | 2713 | 92.94% |
| 250-499 | 186 | 6.37% |
| 500-749 | 20 | 0.69% |
| 750-999 | 0 | 0% |
| 1000-1249 | 0 | 0% |
| 1250-1499 | 0 | 0% |
| 1500-1749 | 0 | 0% |
| 1750-1999 | 0 | 0% |
| 2000-2249 | 0 | 0% |
| 2250-2499 | 0 | 0% |
| 2500-2999 | 0 | 0% |
| 3000+ | 0 | 0% |

### Seuils tokeniques

| Threshold | Count | Percentage |
|-----------|------:|-----------:|
| >= 500 | 20 | 0.69% |
| >= 750 | 0 | 0% |
| >= 1000 | 0 | 0% |
| >= 1250 | 0 | 0% |
| >= 1500 | 0 | 0% |
| >= 2000 | 0 | 0% |
| >= 2500 | 0 | 0% |
| >= 3000 | 0 | 0% |

### Top 10 chunks (tokens)

| chunkId | articleNumber | chunkIndex | chunkCount | charCount | tokenCount | chars/token |
|---------|---------------|----------:|-----------:|----------:|-----------:|------------:|
| 2331#0 | 2331 | 0 | 2 | 1898 | 605 | 3.1372 |
| 2377#0 | 2377 | 0 | 1 | 1872 | 601 | 3.1148 |
| 363#0 | 363 | 0 | 2 | 1887 | 561 | 3.3636 |
| 96-1#0 | 96-1 | 0 | 1 | 1977 | 558 | 3.543 |
| 1799-1#0 | 1799-1 | 0 | 1 | 1929 | 555 | 3.4757 |
| 75#0 | 75 | 0 | 1 | 1790 | 531 | 3.371 |
| 375-3#0 | 375-3 | 0 | 1 | 1913 | 529 | 3.6163 |
| 2529#0 | 2529 | 0 | 1 | 1821 | 528 | 3.4489 |
| 465#0 | 465 | 0 | 1 | 1809 | 524 | 3.4523 |
| 58#0 | 58 | 0 | 1 | 1794 | 520 | 3.45 |

### Anomalies

_Aucune anomalie non bloquante._

## Code du travail (`code-du-travail`)

- Fichier : `data/processed/code-du-travail.chunks.json`
- Chunks : 12177
- Total caractères : 6959421
- Total tokens : 1915291
- Ratio global caractères/token : 3.6336

### Caractères

| Metric | Value |
|--------|------:|
| min | 26 |
| mean | 571.52 |
| P50 | 420 |
| P75 | 713 |
| P90 | 1264 |
| P95 | 1712 |
| P99 | 1949 |
| max | 2000 |

### Tokens

| Metric | Value |
|--------|------:|
| min | 8 |
| mean | 157.29 |
| P50 | 116 |
| P75 | 197 |
| P90 | 348 |
| P95 | 456 |
| P99 | 540 |
| max | 1071 |

### Ratio caractères/token

| Metric | Value |
|--------|------:|
| min | 1.8238 |
| mean | 3.65 |
| P50 | 3.642 |
| P75 | 3.8539 |
| P90 | 4.06 |
| P95 | 4.19 |
| P99 | 4.48 |
| max | 5.3889 |

### Distribution des tokens

| Bucket | Count | Percentage |
|--------|------:|-----------:|
| 0-249 | 10033 | 82.39% |
| 250-499 | 1819 | 14.94% |
| 500-749 | 319 | 2.62% |
| 750-999 | 5 | 0.04% |
| 1000-1249 | 1 | 0.01% |
| 1250-1499 | 0 | 0% |
| 1500-1749 | 0 | 0% |
| 1750-1999 | 0 | 0% |
| 2000-2249 | 0 | 0% |
| 2250-2499 | 0 | 0% |
| 2500-2999 | 0 | 0% |
| 3000+ | 0 | 0% |

### Seuils tokeniques

| Threshold | Count | Percentage |
|-----------|------:|-----------:|
| >= 500 | 325 | 2.67% |
| >= 750 | 6 | 0.05% |
| >= 1000 | 1 | 0.01% |
| >= 1250 | 0 | 0% |
| >= 1500 | 0 | 0% |
| >= 2000 | 0 | 0% |
| >= 2500 | 0 | 0% |
| >= 3000 | 0 | 0% |

### Top 10 chunks (tokens)

| chunkId | articleNumber | chunkIndex | chunkCount | charCount | tokenCount | chars/token |
|---------|---------------|----------:|-----------:|----------:|-----------:|------------:|
| Annexe II@p2339#1 | Annexe II@p2339 | 1 | 5 | 1998 | 1071 | 1.8655 |
| R4412-149#1 | R4412-149 | 1 | 9 | 1639 | 815 | 2.011 |
| R4412-149#3 | R4412-149 | 3 | 9 | 1835 | 804 | 2.2823 |
| Annexe II@p2339#2 | Annexe II@p2339 | 2 | 5 | 1976 | 799 | 2.4731 |
| L1235-3#0 | L1235-3 | 0 | 1 | 1909 | 753 | 2.5352 |
| annexe-R1422-4#11 | annexe-R1422-4 | 11 | 17 | 1883 | 753 | 2.5007 |
| R4412-149#6 | R4412-149 | 6 | 9 | 1593 | 742 | 2.1469 |
| R4412-149#7 | R4412-149 | 7 | 9 | 1939 | 737 | 2.6309 |
| R4412-149#2 | R4412-149 | 2 | 9 | 1581 | 710 | 2.2268 |
| R4412-149#5 | R4412-149 | 5 | 9 | 1457 | 671 | 2.1714 |

### Anomalies

- **duplicate_chunk_id** (`2@p2999#0`): Duplicate chunkId (occurrence 2)
- **duplicate_chunk_id** (`3@p2999#0`): Duplicate chunkId (occurrence 2)

## Code de commerce (`code-du-commerce`)

- Fichier : `data/processed/code-du-commerce.chunks.json`
- Chunks : 8334
- Total caractères : 6148922
- Total tokens : 1698761
- Ratio global caractères/token : 3.6197

### Caractères

| Metric | Value |
|--------|------:|
| min | 14 |
| mean | 737.81 |
| P50 | 544 |
| P75 | 1082.75 |
| P90 | 1713 |
| P95 | 1884.35 |
| P99 | 1982.67 |
| max | 2000 |

### Tokens

| Metric | Value |
|--------|------:|
| min | 5 |
| mean | 203.84 |
| P50 | 153 |
| P75 | 299.75 |
| P90 | 459 |
| P95 | 502 |
| P99 | 562 |
| max | 869 |

### Ratio caractères/token

| Metric | Value |
|--------|------:|
| min | 2.0613 |
| mean | 3.6 |
| P50 | 3.63 |
| P75 | 3.81 |
| P90 | 3.98 |
| P95 | 4.08 |
| P99 | 4.36 |
| max | 5.2143 |

### Distribution des tokens

| Bucket | Count | Percentage |
|--------|------:|-----------:|
| 0-249 | 5706 | 68.47% |
| 250-499 | 2191 | 26.29% |
| 500-749 | 433 | 5.2% |
| 750-999 | 4 | 0.05% |
| 1000-1249 | 0 | 0% |
| 1250-1499 | 0 | 0% |
| 1500-1749 | 0 | 0% |
| 1750-1999 | 0 | 0% |
| 2000-2249 | 0 | 0% |
| 2250-2499 | 0 | 0% |
| 2500-2999 | 0 | 0% |
| 3000+ | 0 | 0% |

### Seuils tokeniques

| Threshold | Count | Percentage |
|-----------|------:|-----------:|
| >= 500 | 437 | 5.24% |
| >= 750 | 4 | 0.05% |
| >= 1000 | 0 | 0% |
| >= 1250 | 0 | 0% |
| >= 1500 | 0 | 0% |
| >= 2000 | 0 | 0% |
| >= 2500 | 0 | 0% |
| >= 3000 | 0 | 0% |

### Top 10 chunks (tokens)

| chunkId | articleNumber | chunkIndex | chunkCount | charCount | tokenCount | chars/token |
|---------|---------------|----------:|-----------:|----------:|-----------:|------------:|
| L950-1#3 | L950-1 | 3 | 7 | 1825 | 869 | 2.1001 |
| L950-1#5 | L950-1 | 5 | 7 | 1748 | 848 | 2.0613 |
| R930-1#0 | R930-1 | 0 | 2 | 1991 | 825 | 2.4133 |
| Annexe 7-1#8 | Annexe 7-1 | 8 | 12 | 1993 | 794 | 2.5101 |
| L123-11-3#1 | L123-11-3 | 1 | 3 | 1855 | 687 | 2.7001 |
| L950-1#2 | L950-1 | 2 | 7 | 1650 | 686 | 2.4052 |
| L950-1#1 | L950-1 | 1 | 7 | 1832 | 670 | 2.7343 |
| Annexe VII#0 | Annexe VII | 0 | 4 | 1887 | 661 | 2.8548 |
| Annexe 7-2#0 | Annexe 7-2 | 0 | 3 | 1611 | 659 | 2.4446 |
| A743-11#3 | A743-11 | 3 | 5 | 1964 | 657 | 2.9893 |

### Anomalies

_Aucune anomalie non bloquante._

## Code monétaire et financier (`code-monetaire-et-financier`)

- Fichier : `data/processed/code-monetaire-et-financier.chunks.json`
- Chunks : 6645
- Total caractères : 6126943
- Total tokens : 1769730
- Ratio global caractères/token : 3.4621

### Caractères

| Metric | Value |
|--------|------:|
| min | 24 |
| mean | 922.04 |
| P50 | 763 |
| P75 | 1512 |
| P90 | 1865 |
| P95 | 1934 |
| P99 | 1988 |
| max | 2000 |

### Tokens

| Metric | Value |
|--------|------:|
| min | 8 |
| mean | 266.33 |
| P50 | 219 |
| P75 | 430 |
| P90 | 519 |
| P95 | 561.8 |
| P99 | 758.56 |
| max | 1003 |

### Ratio caractères/token

| Metric | Value |
|--------|------:|
| min | 1.8956 |
| mean | 3.51 |
| P50 | 3.5725 |
| P75 | 3.7597 |
| P90 | 3.93 |
| P95 | 4.03 |
| P99 | 4.25 |
| max | 4.8 |

### Distribution des tokens

| Bucket | Count | Percentage |
|--------|------:|-----------:|
| 0-249 | 3619 | 54.46% |
| 250-499 | 2118 | 31.87% |
| 500-749 | 837 | 12.6% |
| 750-999 | 68 | 1.02% |
| 1000-1249 | 3 | 0.05% |
| 1250-1499 | 0 | 0% |
| 1500-1749 | 0 | 0% |
| 1750-1999 | 0 | 0% |
| 2000-2249 | 0 | 0% |
| 2250-2499 | 0 | 0% |
| 2500-2999 | 0 | 0% |
| 3000+ | 0 | 0% |

### Seuils tokeniques

| Threshold | Count | Percentage |
|-----------|------:|-----------:|
| >= 500 | 908 | 13.66% |
| >= 750 | 71 | 1.07% |
| >= 1000 | 3 | 0.05% |
| >= 1250 | 0 | 0% |
| >= 1500 | 0 | 0% |
| >= 2000 | 0 | 0% |
| >= 2500 | 0 | 0% |
| >= 3000 | 0 | 0% |

### Top 10 chunks (tokens)

| chunkId | articleNumber | chunkIndex | chunkCount | charCount | tokenCount | chars/token |
|---------|---------------|----------:|-----------:|----------:|-----------:|------------:|
| R742-10#1 | R742-10 | 1 | 8 | 1968 | 1003 | 1.9621 |
| R743-10#1 | R743-10 | 1 | 8 | 1968 | 1003 | 1.9621 |
| R744-10#1 | R744-10 | 1 | 8 | 1968 | 1003 | 1.9621 |
| R742-10#3 | R742-10 | 3 | 8 | 1999 | 993 | 2.0131 |
| R743-10#3 | R743-10 | 3 | 8 | 1974 | 979 | 2.0163 |
| R744-10#3 | R744-10 | 3 | 8 | 1973 | 978 | 2.0174 |
| L742-8#2 | L742-8 | 2 | 5 | 1989 | 967 | 2.0569 |
| L743-8#2 | L743-8 | 2 | 5 | 1989 | 967 | 2.0569 |
| L744-8#1 | L744-8 | 1 | 5 | 1958 | 963 | 2.0332 |
| L744-8#3 | L744-8 | 3 | 5 | 1993 | 956 | 2.0847 |

### Anomalies

_Aucune anomalie non bloquante._

## Code de la consommation (`code-de-la-consommation`)

- Fichier : `data/processed/code-de-la-consommation.chunks.json`
- Chunks : 2242
- Total caractères : 1444671
- Total tokens : 403679
- Ratio global caractères/token : 3.5788

### Caractères

| Metric | Value |
|--------|------:|
| min | 47 |
| mean | 644.37 |
| P50 | 463 |
| P75 | 870.75 |
| P90 | 1522.9 |
| P95 | 1839.95 |
| P99 | 1979 |
| max | 2000 |

### Tokens

| Metric | Value |
|--------|------:|
| min | 13 |
| mean | 180.05 |
| P50 | 128 |
| P75 | 244 |
| P90 | 418.9 |
| P95 | 489 |
| P99 | 573.18 |
| max | 969 |

### Ratio caractères/token

| Metric | Value |
|--------|------:|
| min | 2.0093 |
| mean | 3.6 |
| P50 | 3.61 |
| P75 | 3.82 |
| P90 | 4.03 |
| P95 | 4.15 |
| P99 | 4.48 |
| max | 5.5625 |

### Distribution des tokens

| Bucket | Count | Percentage |
|--------|------:|-----------:|
| 0-249 | 1699 | 75.78% |
| 250-499 | 437 | 19.49% |
| 500-749 | 100 | 4.46% |
| 750-999 | 6 | 0.27% |
| 1000-1249 | 0 | 0% |
| 1250-1499 | 0 | 0% |
| 1500-1749 | 0 | 0% |
| 1750-1999 | 0 | 0% |
| 2000-2249 | 0 | 0% |
| 2250-2499 | 0 | 0% |
| 2500-2999 | 0 | 0% |
| 3000+ | 0 | 0% |

### Seuils tokeniques

| Threshold | Count | Percentage |
|-----------|------:|-----------:|
| >= 500 | 106 | 4.73% |
| >= 750 | 6 | 0.27% |
| >= 1000 | 0 | 0% |
| >= 1250 | 0 | 0% |
| >= 1500 | 0 | 0% |
| >= 2000 | 0 | 0% |
| >= 2500 | 0 | 0% |
| >= 3000 | 0 | 0% |

### Top 10 chunks (tokens)

| chunkId | articleNumber | chunkIndex | chunkCount | charCount | tokenCount | chars/token |
|---------|---------------|----------:|-----------:|----------:|-----------:|------------:|
| R771-1#1 | R771-1 | 1 | 3 | 1964 | 969 | 2.0268 |
| L351-3#1 | L351-3 | 1 | 3 | 1967 | 942 | 2.0881 |
| L771-2#3 | L771-2 | 3 | 5 | 1967 | 886 | 2.2201 |
| L771-2#1 | L771-2 | 1 | 5 | 1926 | 861 | 2.2369 |
| L455-2#0 | L455-2 | 0 | 1 | 1728 | 860 | 2.0093 |
| L252-1#0 | L252-1 | 0 | 1 | 1896 | 799 | 2.373 |
| R224-52#0 | R224-52 | 0 | 1 | 1950 | 693 | 2.8139 |
| L511-7#0 | L511-7 | 0 | 1 | 1900 | 666 | 2.8529 |
| R224-70#0 | R224-70 | 0 | 2 | 1978 | 666 | 2.97 |
| R412-27#0 | R412-27 | 0 | 2 | 1990 | 649 | 3.0663 |

### Anomalies

_Aucune anomalie non bloquante._

## Conclusion descriptive

Analyse effectuée sur 6 corpus et 33684 chunks, avec le tokenizer `tiktoken` (`cl100k_base`) pour le modèle `text-embedding-3-large`.

Configuration de chunking actuelle : cible 1500 caractères, maximum 2000 caractères.

Ratio global caractères/token sur l'ensemble des corpus : 3.5687.

- **Code pénal** : médiane 138 tokens, P95 492.7 tokens, max 611 tokens ; 0% des chunks >= 1000 tokens, 0% >= 1500 tokens, 0% >= 2000 tokens.
- **Code civil** : médiane 80 tokens, P95 289 tokens, max 605 tokens ; 0% des chunks >= 1000 tokens, 0% >= 1500 tokens, 0% >= 2000 tokens.
- **Code du travail** : médiane 116 tokens, P95 456 tokens, max 1071 tokens ; 0.01% des chunks >= 1000 tokens, 0% >= 1500 tokens, 0% >= 2000 tokens.
- **Code de commerce** : médiane 153 tokens, P95 502 tokens, max 869 tokens ; 0% des chunks >= 1000 tokens, 0% >= 1500 tokens, 0% >= 2000 tokens.
- **Code monétaire et financier** : médiane 219 tokens, P95 561.8 tokens, max 1003 tokens ; 0.05% des chunks >= 1000 tokens, 0% >= 1500 tokens, 0% >= 2000 tokens.
- **Code de la consommation** : médiane 128 tokens, P95 489 tokens, max 969 tokens ; 0% des chunks >= 1000 tokens, 0% >= 1500 tokens, 0% >= 2000 tokens.

Ces résultats constituent une photographie quantitative de la stratégie actuelle en caractères. Ils pourront servir à décider si une stratégie de chunking token-aware est pertinente, sans présupposer de changement immédiat.
