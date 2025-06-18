# Serplexity

# GEO Dashboard – Build Requirements (MVP v0.9)

Prepared for: **Founding team**  
Intended for: **Cursor / code-gen agents** and **human collaborators**  
Cloud stack: **AWS RDS (PostgreSQL)** · **S3** · **EC2**

---

## 1. Product Snapshot
| Item | Description |
|------|-------------|
| **Problem** | Companies are losing organic visibility as AI answers replace blue links. They need sentence-level visibility tracking & actionable rewrites. |
| **Solution** | A SaaS dashboard that: 1) scrapes AI search answers, 2) measures share-of-voice (PAWC, AIR, etc.), 3) correlates with click data, 4) highlights rewrite opportunities. |
| **Target users** | SEO / Content leads at mid-market & enterprise brands; Agencies offering GEO retainers. |
| **MVP timeline** | 12 weeks to first paying pilot. |

---

## 2. Data the Client Must Supply
| Layer | Required? | Client input | Purpose |
|-------|-----------|--------------|---------|
| 1. **Domain scope** | ✅ | Primary domains & sub-domains | Tag brand citations |
| 2. **Query universe (CSV)** | ⚠️ *Strongly recommended* | 100-1 000 queries (`query,priority`) | Defines tracking scope |
| 3. **Competitor set** | ⚠️ | ≤3 rival domains | Competitive SOV metric |
| 4. **Analytics access** | ⚠️ | GA4 service key **or** S3 log dump | Traffic / CTY metrics |
| 5. **Commercial values** | ⚠️ | Rev-per-visit or lead | Visibility-gap $ weighting |
| 6. **Knowledge base** | ⚠️ | JSON / CSV / Confluence URL | Hallucination check |

*(Layer 7 “rewrite tagging” deferred to v1.1)*

---

## 3. Metrics Scope

### 3.1 MVP must-have
| # | Metric | Capture | Refresh |
|---|--------|---------|---------|
| 1 | **PAWC %** | Sentence split → word share → exp-decay | Weekly (daily for top 50) |
| 2 | **Answer-Inclusion Rate** | % queries with ≥1 brand citation | Weekly |
| 3 | **Competitive SOV** | Run PAWC for rivals | Weekly |
| 5 | **GE Referral Sessions** | GA4 / log count with `utm_source=ge_*` | Continuous |
| 7 | **Visibility Gap Index** | (Traffic potential × Rev) × (1-PAWC) | Monthly |

### 3.2 Post-pilot additions
Subjective Impression, Hallucination alerts, Lever effectiveness, Compliance score.

---

## 4. Core Functional Requirements
| ID | Requirement |
|----|-------------|
| **F-1** | Accept & validate client onboarding CSV/JSON (domains, queries, competitors). |
| **F-2** | Nightly crawler pulls AI answers from **Google SGE**, **Bing Copilot**, **Perplexity** via BrightData rotating proxy pool. |
| **F-3** | Parser extracts citations (`url`, `sentence`, `pos`). |
| **F-4** | Metrics engine computes PAWC, AIR, SOV, Gap Index. |
| **F-5** | Store raw answers & metrics in PostgreSQL (schema §6). |
| **F-6** | Expose REST and GraphQL endpoints (`/metrics?domain=&date=`). |
| **F-7** | React + Recharts dashboard (tables, line/area charts). |
| **F-8** | CSV/JSON export and webhook push on metric deltas. |
| **F-9** | Admin CLI for ad-hoc crawl, backfill, tenant bootstrap. |

---

## 5. Non-Functional Requirements
* **Scalability:** 10 k queries × 3 engines × 7-day retention ≈ 210 k answer docs → fits single `t3.medium` per layer.  
* **Latency:** Dashboard ≤ 2 s for 50 k-row queries.  
* **Security:** IAM least privilege; S3 buckets encrypted; all traffic via HTTPS; auth via **Amazon Cognito + JWTs**.  
* **Cost target:** < \$400 / month infra at 10 k queries.  

---

## 6. High-Level Data Model (PostgreSQL)
| Table | Key columns |
|-------|-------------|
| `clients` | `id (PK)`, `name`, `domains[]`, `created_at` |
| `queries` | `id`, `client_id`, `query_text`, `priority` |
| `answers` | `id`, `query_id`, `engine`, `answer_raw`, `scraped_at` |
| `citations` | `id`, `answer_id`, `sentence_idx`, `sentence_txt`, `url`, `brand_flag`, `competitor_flag` |
| `metrics_daily` | `date`, `query_id`, `engine`, `pawc`, `air`, `first_citation_idx` |
| `traffic_sessions` | `date`, `client_id`, `engine`, `sessions` |
| `gap_index` | `date`, `query_id`, `gap_score` |

---

## 7. System Architecture
'                                   ┌────────────┐  
'                 client CSV/JSON → │  S3 Input   │  
'                                   └────┬───────┘  
'                                        │ (Lambda ingest)  
'                         nightly cron    ▼  
'                     ┌──────────┐  ┌────────────┐  
'  EC2 Crawler stack  │ headless │→ │  Raw Pages  │ (S3)  
'  (Puppeteer +       │ browser  │  └──┬──────────┘  
'  BrightData proxy)  └──────────┘     │  
'                                       ▼  
'                                ┌─────────────┐  
'                                │ Parser / ETL│  
'                                └────┬────────┘  
'                                     ▼  
'                              ┌───────────┐  
'                              │  RDS (PG) │◄── GA4/log loader  
'                              └──┬────────┘  
'        API (FastAPI)           │  
'        React + Recharts        ▼  
'                       ┌────────────┐  
'                       │  EC2 App   │  
'                       └────────────┘  

**Services**
* **EC2-Crawler** – Ubuntu, Node, Chromium, BrightData proxy; pushes JSON to S3.  
* **ETL Lambda** – Python; transforms JSON → PostgreSQL.  
* **EC2-App** – FastAPI backend + React frontend served by nginx.  
* **RDS PostgreSQL** – single-AZ `db.t3.medium`; encrypted snapshots, 7-day PITR.  
* **S3** – Raw answer storage, client uploads, log archive.

---

## 8. External Integrations
| API | Purpose |
|-----|---------|
| **Google Analytics 4** | Pull sessions by `utm_source`. |
| **Semrush / Ahrefs** | Keyword volume for Gap Index. |
| **OpenAI / Anthropic** | (Phase 2) Subjective Impression scoring. |

---

## 9. Milestones & Estimates
| Week | Deliverable |
|------|-------------|
| 1 | Repo scaffold; Terraform for VPC + RDS + S3. |
| 2 | Perplexity crawler MVP. |
| 3 | PostgreSQL schema + ETL Lambda. |
| 4 | Metric calc (PAWC, AIR); skeleton React UI. |
| 6 | Google SGE & Bing adapters; competitor logic. |
| 7 | GA4 connector; GE referral sessions metric live. |
| 8 | Visibility Gap Index + Semrush integration. |
| 9 | Cognito auth; multi-tenant separation; billing stubs. |
| 10 | Pilot client onboarding; dashboard walkthrough. |
| 12 | Hardening, docs, v0.9 release. |

---

## 10. Next Actions (Team of Two)
1. Deploy Terraform stack (VPC, S3, RDS, Cognito).  
2. Build Perplexity crawler → end-to-end flow to PG.  
3. Scaffold FastAPI service & React-Recharts dashboard.  
4. Sign first beta client with limited query set for feedback.

*End of document*