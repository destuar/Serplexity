-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "domains" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queries" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "query_text" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,

    CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" SERIAL NOT NULL,
    "query_id" INTEGER NOT NULL,
    "engine" TEXT NOT NULL,
    "answer_raw" TEXT NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citations" (
    "id" SERIAL NOT NULL,
    "answer_id" INTEGER NOT NULL,
    "sentence_idx" INTEGER NOT NULL,
    "sentence_txt" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "brand_flag" BOOLEAN NOT NULL,
    "competitor_flag" BOOLEAN NOT NULL,

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics_daily" (
    "date" DATE NOT NULL,
    "query_id" INTEGER NOT NULL,
    "engine" TEXT NOT NULL,
    "pawc" DOUBLE PRECISION NOT NULL,
    "air" DOUBLE PRECISION NOT NULL,
    "first_citation_idx" INTEGER,

    CONSTRAINT "metrics_daily_pkey" PRIMARY KEY ("date","query_id","engine")
);

-- CreateTable
CREATE TABLE "traffic_sessions" (
    "date" DATE NOT NULL,
    "client_id" INTEGER NOT NULL,
    "engine" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,

    CONSTRAINT "traffic_sessions_pkey" PRIMARY KEY ("date","client_id","engine")
);

-- CreateTable
CREATE TABLE "gap_index" (
    "date" DATE NOT NULL,
    "query_id" INTEGER NOT NULL,
    "gap_score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "gap_index_pkey" PRIMARY KEY ("date","query_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "queries_query_text_key" ON "queries"("query_text");

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_sessions" ADD CONSTRAINT "traffic_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_index" ADD CONSTRAINT "gap_index_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
