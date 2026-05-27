-- AI-Powered Customer Segmentation Models
-- Schema additions for ML-based clustering and behavioral analysis

-- CustomerSegment: Stores ML-generated segment definitions
CREATE TABLE "CustomerSegment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Segment Profile (auto-generated)
  profile JSONB NOT NULL DEFAULT '{
    "size": 0,
    "demographics": {},
    "behavioral": {},
    "psychographic": {},
    "churnRisk": 0,
    "recommendedAction": "",
    "messageTone": ""
  }',

  -- Metrics
  size INT DEFAULT 0,
  "churnRiskPercent" NUMERIC(5,2) DEFAULT 0,
  "avgLtv" NUMERIC(12,2) DEFAULT 0,
  "avgEngagementRate" NUMERIC(5,2) DEFAULT 0,
  "predictedConversionRate" NUMERIC(5,2) DEFAULT 0,

  -- Cluster center (for K-means, stored as JSON for flexibility)
  "clusterCenter" JSONB,

  -- Re-clustering metadata
  "lastClusteredAt" TIMESTAMPTZ DEFAULT NOW(),
  "nextClusteringAt" TIMESTAMPTZ,
  "isActive" BOOLEAN DEFAULT true,

  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_segment_org FOREIGN KEY ("organizationId")
    REFERENCES "Organization"(id) ON DELETE CASCADE,

  UNIQUE("organizationId", name)
);

CREATE INDEX idx_segment_org_active ON "CustomerSegment"("organizationId", "isActive");
CREATE INDEX idx_segment_org_churn_risk ON "CustomerSegment"("organizationId", "churnRiskPercent");
CREATE INDEX idx_segment_last_clustered ON "CustomerSegment"("organizationId", "lastClusteredAt");

-- ContactSegmentAssignment: Assigns contacts to ML segments with probability
CREATE TABLE "ContactSegmentAssignment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,

  -- Clustering confidence (0-100)
  probability NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Previous segment (for detecting migration)
  "previousSegmentId" TEXT,
  "migratedAt" TIMESTAMPTZ,

  -- Feature scores used for assignment
  "featureScores" JSONB NOT NULL DEFAULT '{}',

  -- Explanation of "why" in this segment
  explanation TEXT,

  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_assignment_contact FOREIGN KEY ("contactId")
    REFERENCES "Contact"(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_segment FOREIGN KEY ("segmentId")
    REFERENCES "CustomerSegment"(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_org FOREIGN KEY ("organizationId")
    REFERENCES "Organization"(id) ON DELETE CASCADE,

  UNIQUE("contactId", "organizationId")
);

CREATE INDEX idx_assignment_segment ON "ContactSegmentAssignment"("segmentId", "organizationId");
CREATE INDEX idx_assignment_org_contact ON "ContactSegmentAssignment"("organizationId", "contactId");
CREATE INDEX idx_assignment_probability ON "ContactSegmentAssignment"("organizationId", probability);
CREATE INDEX idx_assignment_migrated ON "ContactSegmentAssignment"("organizationId", "migratedAt");

-- SegmentCampaignMetric: Tracks campaign performance by segment
CREATE TABLE "SegmentCampaignMetric" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "campaignId" TEXT,
  "campaignName" VARCHAR(255),

  -- Performance metrics
  sent INT DEFAULT 0,
  opened INT DEFAULT 0,
  clicked INT DEFAULT 0,
  converted INT DEFAULT 0,
  unsubscribed INT DEFAULT 0,
  bounced INT DEFAULT 0,

  -- Calculated rates
  "openRate" NUMERIC(5,2) DEFAULT 0,
  "clickRate" NUMERIC(5,2) DEFAULT 0,
  "conversionRate" NUMERIC(5,2) DEFAULT 0,
  "churnRate" NUMERIC(5,2) DEFAULT 0,

  -- Revenue impact
  revenue NUMERIC(15,2) DEFAULT 0,
  roi NUMERIC(8,2) DEFAULT 0,

  -- Channel info
  channel VARCHAR(20), -- SMS, Email, Kakao, Push
  "dayIndex" INT, -- Day 0, 1, 2, 3, etc.

  -- A/B variant (if applicable)
  "variantId" TEXT,
  "variantName" VARCHAR(100),

  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_metric_segment FOREIGN KEY ("segmentId")
    REFERENCES "CustomerSegment"(id) ON DELETE CASCADE,
  CONSTRAINT fk_metric_org FOREIGN KEY ("organizationId")
    REFERENCES "Organization"(id) ON DELETE CASCADE
);

CREATE INDEX idx_metric_segment ON "SegmentCampaignMetric"("segmentId", "organizationId");
CREATE INDEX idx_metric_campaign ON "SegmentCampaignMetric"("campaignId", "organizationId");
CREATE INDEX idx_metric_channel ON "SegmentCampaignMetric"("organizationId", channel);
CREATE INDEX idx_metric_conversion ON "SegmentCampaignMetric"("organizationId", "conversionRate");

-- SegmentABTest: Auto-suggested A/B tests per segment
CREATE TABLE "SegmentABTest" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Test variants (A and B)
  "variantAId" TEXT,
  "variantAName" VARCHAR(100),
  "variantAConfig" JSONB NOT NULL DEFAULT '{}', -- { message, tone, timing, channel }

  "variantBId" TEXT,
  "variantBName" VARCHAR(100),
  "variantBConfig" JSONB NOT NULL DEFAULT '{}',

  -- Test status
  status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, RUNNING, COMPLETED, ARCHIVED
  "startedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "endAt" TIMESTAMPTZ,

  -- Results (once test is complete)
  "winnerVariantId" TEXT,
  "winnerMetric" VARCHAR(50), -- conversion_rate, open_rate, click_rate, etc.
  "confidenceLevel" NUMERIC(5,2), -- 95, 99, etc.
  "pValue" NUMERIC(10,6), -- statistical significance

  -- Test metrics
  "sampleSizeA" INT DEFAULT 0,
  "sampleSizeB" INT DEFAULT 0,
  "conversionRateA" NUMERIC(5,2) DEFAULT 0,
  "conversionRateB" NUMERIC(5,2) DEFAULT 0,
  "uplift" NUMERIC(8,2), -- % improvement of B vs A

  -- Auto-deployment
  "autoDeployIfSignificant" BOOLEAN DEFAULT false,
  "deployedAt" TIMESTAMPTZ,

  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_test_segment FOREIGN KEY ("segmentId")
    REFERENCES "CustomerSegment"(id) ON DELETE CASCADE,
  CONSTRAINT fk_test_org FOREIGN KEY ("organizationId")
    REFERENCES "Organization"(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_segment ON "SegmentABTest"("segmentId", "organizationId");
CREATE INDEX idx_test_status ON "SegmentABTest"("organizationId", status);
CREATE INDEX idx_test_started ON "SegmentABTest"("organizationId", "startedAt");
CREATE INDEX idx_test_winner ON "SegmentABTest"("organizationId", "winnerVariantId");
