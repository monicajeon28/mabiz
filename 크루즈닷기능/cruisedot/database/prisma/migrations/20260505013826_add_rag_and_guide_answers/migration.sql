-- CreateTable RagQuestion
CREATE TABLE "RagQuestion" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "videoId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'youtube-comment',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cluster" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable BotGuideAnswer
CREATE TABLE "BotGuideAnswer" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai-generated',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotGuideAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RagQuestion_question_key" ON "RagQuestion"("question");

-- CreateIndex
CREATE INDEX "RagQuestion_status_likeCount_idx" ON "RagQuestion"("status", "likeCount");

-- CreateIndex
CREATE INDEX "RagQuestion_cluster_idx" ON "RagQuestion"("cluster");

-- CreateIndex
CREATE UNIQUE INDEX "BotGuideAnswer_key_key" ON "BotGuideAnswer"("key");

-- CreateIndex
CREATE INDEX "BotGuideAnswer_isActive_updatedAt_idx" ON "BotGuideAnswer"("isActive", "updatedAt");
