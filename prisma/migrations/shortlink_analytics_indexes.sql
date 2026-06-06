-- Migration: Add ShortLinkClick analytics indexes
-- Purpose: Optimize queries for analytics APIs
-- Date: 2026-06-06

-- Index for groupBy queries on linkId and clickedAt
CREATE INDEX IF NOT EXISTS "idx_shortlinkclick_linkid_clickedat"
ON "ShortLinkClick"("linkId", "clickedAt" DESC);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS "idx_shortlinkclick_clickedat_linkid"
ON "ShortLinkClick"("clickedAt" DESC, "linkId");

-- Index for contact-based analysis
CREATE INDEX IF NOT EXISTS "idx_shortlinkclick_contactid"
ON "ShortLinkClick"("contactId");

-- Index for aggregation by contactId
CREATE INDEX IF NOT EXISTS "idx_shortlinkclick_linkid_contactid"
ON "ShortLinkClick"("linkId", "contactId");

-- Index for date-based grouping
CREATE INDEX IF NOT EXISTS "idx_shortlinkclick_linkid_date"
ON "ShortLinkClick"("linkId", DATE("clickedAt"));

-- Composite index for common query pattern: linkId + date range
CREATE INDEX IF NOT EXISTS "idx_shortlinkclick_perf"
ON "ShortLinkClick"("linkId", "clickedAt" DESC, "contactId");
