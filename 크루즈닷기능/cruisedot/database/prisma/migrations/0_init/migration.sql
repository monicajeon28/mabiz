-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminActionLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminMessage" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sendAt" TIMESTAMP,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AdminMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdminMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateCommissionTier" (
    "id" SERIAL PRIMARY KEY,
    "affiliateProductId" INTEGER NOT NULL,
    "cabinType" TEXT NOT NULL,
    "pricingRowId" TEXT,
    "fareCategory" TEXT,
    "fareLabel" TEXT,
    "saleAmount" INTEGER,
    "costAmount" INTEGER,
    "hqShareAmount" INTEGER,
    "branchShareAmount" INTEGER,
    "salesShareAmount" INTEGER,
    "overrideAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateCommissionTier_affiliateProductId_fkey" FOREIGN KEY ("affiliateProductId") REFERENCES "AffiliateProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateContract" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankAccountHolder" TEXT,
    "idCardPath" TEXT,
    "idCardOriginalName" TEXT,
    "bankbookPath" TEXT,
    "bankbookOriginalName" TEXT,
    "invitedByProfileId" INTEGER,
    "consentPrivacy" BOOLEAN NOT NULL DEFAULT false,
    "consentNonCompete" BOOLEAN NOT NULL DEFAULT false,
    "consentDbUse" BOOLEAN NOT NULL DEFAULT false,
    "consentPenalty" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "notes" TEXT,
    "metadata" JSONB,
    "submittedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP,
    "reviewerId" INTEGER,
    "contractSignedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateContract_invitedByProfileId_fkey" FOREIGN KEY ("invitedByProfileId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateContract_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateDocument" (
    "id" SERIAL PRIMARY KEY,
    "profileId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "filePath" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileHash" TEXT,
    "uploadedById" INTEGER,
    "approvedById" INTEGER,
    "uploadedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP,
    "metadata" JSONB,
    "affiliateContractId" INTEGER,
    CONSTRAINT "AffiliateDocument_affiliateContractId_fkey" FOREIGN KEY ("affiliateContractId") REFERENCES "AffiliateContract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateDocument_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateInteraction" (
    "id" SERIAL PRIMARY KEY,
    "leadId" INTEGER NOT NULL,
    "profileId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "interactionType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "metadata" JSONB,
    CONSTRAINT "AffiliateInteraction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateInteraction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "AffiliateLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateLead" (
    "id" SERIAL PRIMARY KEY,
    "linkId" INTEGER,
    "managerId" INTEGER,
    "agentId" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "passportRequestedAt" TIMESTAMP,
    "passportCompletedAt" TIMESTAMP,
    "lastContactedAt" TIMESTAMP,
    "nextActionAt" TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "groupId" INTEGER,
    CONSTRAINT "AffiliateLead_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PartnerCustomerGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLead_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLead_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateLink" (
    "id" SERIAL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "affiliateProductId" INTEGER,
    "productCode" TEXT,
    "managerId" INTEGER,
    "agentId" INTEGER,
    "issuedById" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP,
    "lastAccessedAt" TIMESTAMP,
    "campaignName" TEXT,
    "description" TEXT,
    "landingVariant" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateLink_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLink_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLink_affiliateProductId_fkey" FOREIGN KEY ("affiliateProductId") REFERENCES "AffiliateProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateLinkEvent" (
    "id" SERIAL PRIMARY KEY,
    "linkId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateLinkEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLinkEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateMedia" (
    "id" SERIAL PRIMARY KEY,
    "interactionId" INTEGER,
    "documentId" INTEGER,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "uploadedById" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateMedia_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AffiliateDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateMedia_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "AffiliateInteraction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateProduct" (
    "id" SERIAL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "cruiseProductId" INTEGER,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "defaultSaleAmount" INTEGER,
    "defaultCostAmount" INTEGER,
    "defaultNetRevenue" INTEGER,
    "metadata" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP,
    "effectiveFrom" TIMESTAMP NOT NULL,
    "effectiveTo" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateProduct_cruiseProductId_fkey" FOREIGN KEY ("cruiseProductId") REFERENCES "CruiseProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateProfile" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "affiliateCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "displayName" TEXT,
    "branchLabel" TEXT,
    "nickname" TEXT,
    "profileTitle" TEXT,
    "bio" TEXT,
    "profileImage" TEXT,
    "coverImage" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "kakaoLink" TEXT,
    "instagramHandle" TEXT,
    "youtubeChannel" TEXT,
    "homepageUrl" TEXT,
    "landingSlug" TEXT,
    "landingTheme" JSONB,
    "landingAnnouncement" TEXT,
    "welcomeMessage" TEXT,
    "externalLinks" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankAccountHolder" TEXT,
    "withholdingRate" REAL NOT NULL DEFAULT 3.3,
    "contractStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "contractSignedAt" TIMESTAMP,
    "kycCompletedAt" TIMESTAMP,
    "onboardedAt" TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateRelation" (
    "id" SERIAL PRIMARY KEY,
    "managerId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP,
    "disconnectedAt" TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateRelation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateRelation_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateSale" (
    "id" SERIAL PRIMARY KEY,
    "externalOrderCode" TEXT,
    "linkId" INTEGER,
    "leadId" INTEGER,
    "affiliateProductId" INTEGER,
    "managerId" INTEGER,
    "agentId" INTEGER,
    "productCode" TEXT,
    "cabinType" TEXT,
    "fareCategory" TEXT,
    "headcount" INTEGER,
    "saleAmount" INTEGER NOT NULL,
    "costAmount" INTEGER,
    "netRevenue" INTEGER,
    "branchCommission" INTEGER,
    "salesCommission" INTEGER,
    "overrideCommission" INTEGER,
    "withholdingAmount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "saleDate" TIMESTAMP,
    "confirmedAt" TIMESTAMP,
    "refundedAt" TIMESTAMP,
    "cancellationReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateSale_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateSale_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateSale_affiliateProductId_fkey" FOREIGN KEY ("affiliateProductId") REFERENCES "AffiliateProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateSale_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "AffiliateLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateSale_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatBotFlow" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'AI 지니 채팅봇(구매)',
    "description" TEXT,
    "startQuestionId" INTEGER,
    "finalPageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "ChatBotQuestion" (
    "id" SERIAL PRIMARY KEY,
    "flowId" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" TEXT NOT NULL DEFAULT 'choice',
    "spinType" TEXT,
    "information" TEXT,
    "optionA" TEXT,
    "optionB" TEXT,
    "options" JSONB,
    "nextQuestionIdA" INTEGER,
    "nextQuestionIdB" INTEGER,
    "nextQuestionIds" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "ChatBotQuestion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ChatBotFlow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatBotResponse" (
    "id" SERIAL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "selectedOption" TEXT,
    "selectedText" TEXT,
    "responseTime" INTEGER,
    "isAbandoned" BOOLEAN NOT NULL DEFAULT false,
    "nextQuestionId" INTEGER,
    "questionOrder" INTEGER,
    "optionLabel" TEXT,
    "displayedAt" TIMESTAMP,
    "answeredAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatBotResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ChatBotQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatBotResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatBotSession" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatBotSession" (
    "id" SERIAL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "flowId" INTEGER NOT NULL,
    "userId" INTEGER,
    "userPhone" TEXT,
    "userEmail" TEXT,
    "productCode" TEXT,
    "startedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP,
    "endedAt" TIMESTAMP,
    "durationMs" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "finalStatus" TEXT NOT NULL DEFAULT 'ONGOING',
    "finalPageUrl" TEXT,
    "paymentStatus" TEXT,
    "paymentAttemptedAt" TIMESTAMP,
    "paymentCompletedAt" TIMESTAMP,
    "paymentOrderId" TEXT,
    "conversionRate" REAL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "ChatBotSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChatBotSession_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ChatBotFlow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatHistory" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "tripId" INTEGER,
    "sessionId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "ChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatHistory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "tripId" INTEGER,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "ChecklistItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CmsNotificationTemplate" (
    "id" SERIAL PRIMARY KEY,
    "triggerCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "CommissionAdjustment" (
    "id" SERIAL PRIMARY KEY,
    "ledgerId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP,
    CONSTRAINT "CommissionAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommissionAdjustment_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommissionAdjustment_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "CommissionLedger" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" SERIAL PRIMARY KEY,
    "saleId" INTEGER NOT NULL,
    "profileId" INTEGER,
    "entryType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "withholdingAmount" INTEGER,
    "settlementId" INTEGER,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "CommissionLedger_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "MonthlySettlement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommissionLedger_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommissionLedger_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "AffiliateSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityComment" (
    "id" SERIAL PRIMARY KEY,
    "postId" INTEGER NOT NULL,
    "userId" INTEGER,
    "content" TEXT NOT NULL,
    "authorName" TEXT,
    "parentCommentId" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "CommunityComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "CommunityComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "authorName" TEXT,
    "images" JSONB,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "CommunityPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CruiseProduct" (
    "id" SERIAL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "cruiseLine" TEXT NOT NULL,
    "shipName" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "nights" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "itineraryPattern" JSONB NOT NULL,
    "basePrice" INTEGER,
    "description" TEXT,
    "source" TEXT,
    "category" TEXT,
    "tags" JSONB,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isGeniePack" BOOLEAN NOT NULL DEFAULT false,
    "isDomestic" BOOLEAN NOT NULL DEFAULT false,
    "isJapan" BOOLEAN NOT NULL DEFAULT false,
    "isBudget" BOOLEAN NOT NULL DEFAULT false,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "isMainProduct" BOOLEAN NOT NULL DEFAULT false,
    "saleStatus" TEXT NOT NULL DEFAULT '판매중',
    "startDate" TIMESTAMP,
    "endDate" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "CruiseReview" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER,
    "productCode" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "images" JSONB,
    "cruiseLine" TEXT,
    "shipName" TEXT,
    "travelDate" TIMESTAMP,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "CruiseReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerGroup" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "parentGroupId" INTEGER,
    "affiliateProfileId" INTEGER,
    "funnelTalkIds" JSONB,
    "funnelSmsIds" JSONB,
    "funnelEmailIds" JSONB,
    "reEntryHandling" TEXT,
    "autoMoveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoMoveSettings" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "CustomerGroup_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "CustomerGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerGroup_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerGroupMember" (
    "id" SERIAL PRIMARY KEY,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" INTEGER,
    CONSTRAINT "CustomerGroupMember_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailAddressBook" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "EmailAddressBook_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "tripId" INTEGER,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "foreignAmount" REAL NOT NULL,
    "krwAmount" REAL NOT NULL,
    "usdAmount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "Expense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeatureUsage" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "feature" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "FeatureUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Itinerary" (
    "id" SERIAL PRIMARY KEY,
    "tripId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "date" TIMESTAMP NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "country" TEXT,
    "currency" TEXT,
    "language" TEXT,
    "arrival" TEXT,
    "departure" TEXT,
    "time" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "allAboardAt" TIMESTAMP,
    "arrivalAt" TIMESTAMP,
    "portLat" REAL,
    "portLng" REAL,
    CONSTRAINT "Itinerary_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItineraryGroup" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "itinerary" JSONB NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" SERIAL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "question" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "metadata" JSONB,
    "language" TEXT NOT NULL DEFAULT 'ko',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "embedding" JSONB,
    "embeddingUpdatedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MallContent" (
    "id" SERIAL PRIMARY KEY,
    "section" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "MallProductContent" (
    "id" SERIAL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "thumbnail" TEXT,
    "images" JSONB,
    "videos" JSONB,
    "fonts" JSONB,
    "layout" JSONB,
    "customCss" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MallProductContent_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "CruiseProduct" ("productCode") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapTravelRecord" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "cruiseName" TEXT NOT NULL,
    "companion" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" TIMESTAMP NOT NULL,
    "endDate" TIMESTAMP NOT NULL,
    "impressions" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MapTravelRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingInsight" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "insightType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MarketingInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" SERIAL PRIMARY KEY,
    "roomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP,
    CONSTRAINT "MeetingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MeetingRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingRoom" (
    "id" SERIAL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "hostId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "password" TEXT,
    "maxParticipants" INTEGER NOT NULL DEFAULT 10,
    "isWaitingRoomEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isRecordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledStart" TIMESTAMP,
    "scheduledEnd" TIMESTAMP,
    "meetingLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "endedAt" TIMESTAMP,
    CONSTRAINT "MeetingRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlySettlement" (
    "id" SERIAL PRIMARY KEY,
    "periodStart" TIMESTAMP NOT NULL,
    "periodEnd" TIMESTAMP NOT NULL,
    "targetRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP,
    "lockedAt" TIMESTAMP,
    "paymentDate" TIMESTAMP,
    "exportUrl" TEXT,
    "summary" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MonthlySettlement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "tripId" INTEGER,
    "itineraryId" INTEGER,
    "notificationType" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PageContent" (
    "id" SERIAL PRIMARY KEY,
    "pagePath" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "itemId" TEXT,
    "contentType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "PartnerCustomerGroup" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "profileId" INTEGER,
    "productCode" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PartnerCustomerGroup_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PassportRequestLog" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "messageBody" TEXT NOT NULL,
    "messageChannel" TEXT NOT NULL DEFAULT 'SMS',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorReason" TEXT,
    "sentAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PassportRequestLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PassportRequestTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PassportRequestLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PassportRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PassportRequestTemplate" (
    "id" SERIAL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '여권 제출 안내',
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PassportRequestTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PassportSubmission" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "tripId" INTEGER,
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP NOT NULL,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP,
    "driveFolderUrl" TEXT,
    "extraData" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PassportSubmission_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PassportSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PassportSubmissionGuest" (
    "id" SERIAL PRIMARY KEY,
    "submissionId" INTEGER NOT NULL,
    "groupNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passportNumber" TEXT,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMP,
    "passportExpiryDate" TIMESTAMP,
    "ocrRawData" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PassportSubmissionGuest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "PassportSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordEvent" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductInquiry" (
    "id" SERIAL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passportNumber" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "ProductInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductInquiry_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "CruiseProduct" ("productCode") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductView" (
    "id" SERIAL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "userId" INTEGER,
    "viewedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductView_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "CruiseProduct" ("productCode") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "tags" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RePurchaseTrigger" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "lastTripEndDate" TIMESTAMP NOT NULL,
    "triggerType" TEXT NOT NULL,
    "messageSent" BOOLEAN NOT NULL DEFAULT false,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "RePurchaseTrigger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefundPolicyGroup" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduledMessage" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '예약메시지',
    "groupName" TEXT,
    "description" TEXT,
    "sendMethod" TEXT NOT NULL,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "senderEmail" TEXT,
    "optOutNumber" TEXT,
    "isAdMessage" BOOLEAN NOT NULL DEFAULT false,
    "autoAddAdTag" BOOLEAN NOT NULL DEFAULT true,
    "autoAddOptOut" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP,
    "startTime" TEXT,
    "maxDays" INTEGER NOT NULL DEFAULT 99999,
    "repeatInterval" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "targetGroupId" INTEGER,
    CONSTRAINT "ScheduledMessage_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "CustomerGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduledMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledMessageStage" (
    "id" SERIAL PRIMARY KEY,
    "scheduledMessageId" INTEGER NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "daysAfter" INTEGER NOT NULL DEFAULT 0,
    "sendTime" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "ScheduledMessageStage_scheduledMessageId_fkey" FOREIGN KEY ("scheduledMessageId") REFERENCES "ScheduledMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunnelMessage" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "groupId" INTEGER,
    "messageType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "groupName" TEXT,
    "description" TEXT,
    "senderPhone" TEXT,
    "senderEmail" TEXT,
    "sendTime" TEXT,
    "optOutNumber" TEXT,
    "autoAddOptOut" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "FunnelMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FunnelMessage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunnelMessageStage" (
    "id" SERIAL PRIMARY KEY,
    "funnelMessageId" INTEGER NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "daysAfter" INTEGER NOT NULL DEFAULT 0,
    "sendTime" TEXT,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "FunnelMessageStage_funnelMessageId_fkey" FOREIGN KEY ("funnelMessageId") REFERENCES "FunnelMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "csrfToken" TEXT,
    "expiresAt" TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettlementEvent" (
    "id" SERIAL PRIMARY KEY,
    "settlementId" INTEGER NOT NULL,
    "userId" INTEGER,
    "eventType" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SettlementEvent_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "MonthlySettlement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TravelDiaryEntry" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "tripId" INTEGER,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visitDate" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "TravelDiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TravelDiaryEntry_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER,
    "reservationCode" TEXT,
    "cruiseName" TEXT,
    "companionType" TEXT,
    "destination" JSONB,
    "startDate" TIMESTAMP,
    "endDate" TIMESTAMP,
    "nights" INTEGER NOT NULL DEFAULT 0,
    "days" INTEGER NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trip_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CruiseProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripFeedback" (
    "id" SERIAL PRIMARY KEY,
    "tripId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "satisfactionScore" INTEGER,
    "improvementComments" TEXT,
    "detailedFeedback" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "TripFeedback_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "tripCount" INTEGER NOT NULL DEFAULT 0,
    "totalTripCount" INTEGER NOT NULL DEFAULT 0,
    "currentTripEndDate" TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'user',
    "onboardingUpdatedAt" TIMESTAMP,
    "onboardingUpdatedByUser" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP,
    "hibernatedAt" TIMESTAMP,
    "isHibernated" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP,
    "lockedReason" TEXT,
    "customerStatus" TEXT,
    "testModeStartedAt" TIMESTAMP,
    "customerSource" TEXT,
    "adminMemo" TEXT,
    "mallUserId" TEXT,
    "mallNickname" TEXT,
    "genieStatus" TEXT,
    "genieLinkedAt" TIMESTAMP,
    "kakaoChannelAdded" BOOLEAN NOT NULL DEFAULT false,
    "kakaoChannelAddedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "pwaGenieInstalledAt" TIMESTAMP,
    "pwaMallInstalledAt" TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserMessageRead" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "readAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserMessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserMessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AdminMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSchedule" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "alarm" BOOLEAN NOT NULL DEFAULT false,
    "alarmTime" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "UserSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisitedCountry" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "lastVisited" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "VisitedCountry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "exposureTitle" TEXT,
    "category" TEXT,
    "pageGroup" TEXT,
    "description" TEXT,
    "htmlContent" TEXT NOT NULL,
    "headerScript" TEXT,
    "businessInfo" JSONB,
    "exposureImage" TEXT,
    "attachmentFile" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "shortcutUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "marketingAccountId" INTEGER,
    "marketingFunnelId" INTEGER,
    "funnelOrder" INTEGER,
    "groupId" INTEGER,
    "additionalGroupId" INTEGER,
    "checkDuplicateGroup" BOOLEAN NOT NULL DEFAULT false,
    "inputLimit" TEXT NOT NULL DEFAULT '무제한 허용',
    "completionPageUrl" TEXT,
    "buttonTitle" TEXT NOT NULL DEFAULT '신청하기',
    "smsNotification" BOOLEAN NOT NULL DEFAULT false,
    "commentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "infoCollection" BOOLEAN NOT NULL DEFAULT false,
    "scheduledMessageId" INTEGER,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "LandingPage_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LandingPage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LandingPage_scheduledMessageId_fkey" FOREIGN KEY ("scheduledMessageId") REFERENCES "ScheduledMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LandingPage_marketingAccountId_fkey" FOREIGN KEY ("marketingAccountId") REFERENCES "MarketingAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LandingPage_marketingFunnelId_fkey" FOREIGN KEY ("marketingFunnelId") REFERENCES "MarketingFunnel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LandingPageView" (
    "id" SERIAL PRIMARY KEY,
    "landingPageId" INTEGER NOT NULL,
    "userId" INTEGER,
    "userPhone" TEXT,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "viewedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    CONSTRAINT "LandingPageView_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LandingPageView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LandingPageFunnel" (
    "id" SERIAL PRIMARY KEY,
    "landingPageId" INTEGER NOT NULL,
    "userId" INTEGER,
    "userPhone" TEXT,
    "funnelName" TEXT NOT NULL,
    "startTime" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP,
    "duration" INTEGER,
    "pagesViewed" JSONB,
    "metadata" JSONB,
    CONSTRAINT "LandingPageFunnel_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LandingPageFunnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LandingPageRegistration" (
    "id" SERIAL PRIMARY KEY,
    "landingPageId" INTEGER NOT NULL,
    "userId" INTEGER,
    "customerName" TEXT NOT NULL,
    "customerGroup" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "customFields" JSONB,
    "metadata" JSONB,
    "registeredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "LandingPageRegistration_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LandingPageRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LandingPageComment" (
    "id" SERIAL PRIMARY KEY,
    "landingPageId" INTEGER NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    CONSTRAINT "LandingPageComment_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingAccount" (
    "id" SERIAL PRIMARY KEY,
    "accountName" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "maxCustomers" INTEGER NOT NULL DEFAULT 99000,
    "maxPages" INTEGER NOT NULL DEFAULT 3000,
    "maxFunnels" INTEGER NOT NULL DEFAULT 300,
    "currentCustomerCount" INTEGER NOT NULL DEFAULT 0,
    "currentPageCount" INTEGER NOT NULL DEFAULT 0,
    "currentFunnelCount" INTEGER NOT NULL DEFAULT 0,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'UNLIMITED',
    "subscriptionExpiresAt" TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MarketingAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingCustomer" (
    "id" SERIAL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "notes" TEXT,
    "lastContactedAt" TIMESTAMP,
    "convertedAt" TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MarketingCustomer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketingAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingFunnel" (
    "id" SERIAL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "funnelName" TEXT NOT NULL,
    "description" TEXT,
    "funnelType" TEXT NOT NULL DEFAULT 'SALES',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stages" JSONB NOT NULL,
    "automationRules" JSONB,
    "conversionGoal" TEXT,
    "conversionRate" REAL DEFAULT 0,
    "totalVisitors" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MarketingFunnel_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketingAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunnelStage" (
    "id" SERIAL PRIMARY KEY,
    "funnelId" INTEGER NOT NULL,
    "stageName" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL,
    "stageType" TEXT NOT NULL,
    "triggerCondition" JSONB,
    "actionType" TEXT,
    "actionContent" JSONB,
    "delayDays" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "FunnelStage_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "MarketingFunnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingLead" (
    "id" SERIAL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "source" TEXT NOT NULL,
    "sourceDetail" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "MarketingLead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketingAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingLead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MarketingCustomer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadInteraction" (
    "id" SERIAL PRIMARY KEY,
    "leadId" INTEGER NOT NULL,
    "interactionType" TEXT NOT NULL,
    "interactionContent" JSONB,
    "result" TEXT,
    "notes" TEXT,
    "occurredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "LeadInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketingLead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeadScore" (
    "id" SERIAL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "leadId" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreBreakdown" JSONB,
    "lastCalculatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "LeadScore_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketingAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadScore_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MarketingCustomer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadScore_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketingLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FunnelConversion" (
    "id" SERIAL PRIMARY KEY,
    "funnelId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "conversionType" TEXT NOT NULL,
    "conversionValue" REAL,
    "conversionStage" TEXT,
    "metadata" JSONB,
    "convertedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FunnelConversion_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "MarketingFunnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FunnelConversion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MarketingCustomer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepeatPurchase" (
    "id" SERIAL PRIMARY KEY,
    "customerId" INTEGER NOT NULL,
    "firstPurchaseAt" TIMESTAMP NOT NULL,
    "lastPurchaseAt" TIMESTAMP NOT NULL,
    "purchaseCount" INTEGER NOT NULL DEFAULT 1,
    "totalPurchaseValue" REAL NOT NULL DEFAULT 0,
    "averagePurchaseValue" REAL NOT NULL DEFAULT 0,
    "daysSinceLastPurchase" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "RepeatPurchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MarketingCustomer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViralLoop" (
    "id" SERIAL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "referralCode" TEXT NOT NULL,
    "referredByCustomerId" INTEGER,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "rewardEarned" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "ViralLoop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarketingAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ViralLoop_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "MarketingCustomer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ViralLoop_referredByCustomerId_fkey" FOREIGN KEY ("referredByCustomerId") REFERENCES "MarketingCustomer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminSmsConfig" (
    "id" SERIAL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aligo',
    "apiKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "kakaoSenderKey" TEXT,
    "kakaoChannelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AdminSmsConfig_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerSmsConfig" (
    "id" SERIAL PRIMARY KEY,
    "profileId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aligo',
    "apiKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "kakaoSenderKey" TEXT,
    "kakaoChannelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "PartnerSmsConfig_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateSmsConfig" (
    "id" SERIAL PRIMARY KEY,
    "profileId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aligo',
    "apiKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "kakaoSenderKey" TEXT,
    "kakaoChannelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "AffiliateSmsConfig_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingConfig" (
    "id" SERIAL PRIMARY KEY,
    "googlePixelId" TEXT,
    "googleTagManagerId" TEXT,
    "googleAdsId" TEXT,
    "googleApiKey" TEXT,
    "googleTestMode" BOOLEAN NOT NULL DEFAULT false,
    "facebookPixelId" TEXT,
    "facebookAppId" TEXT,
    "facebookAccessToken" TEXT,
    "facebookTestMode" BOOLEAN NOT NULL DEFAULT false,
    "naverPixelId" TEXT,
    "kakaoPixelId" TEXT,
    "isGoogleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isFacebookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isNaverEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isKakaoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "SeoConfig" (
    "id" SERIAL PRIMARY KEY,
    "pagePath" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "keywords" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "ogType" TEXT DEFAULT 'website',
    "ogUrl" TEXT,
    "twitterCard" TEXT DEFAULT 'summary_large_image',
    "twitterTitle" TEXT,
    "twitterDescription" TEXT,
    "twitterImage" TEXT,
    "structuredData" JSONB,
    "canonicalUrl" TEXT,
    "robots" TEXT,
    "hreflang" JSONB,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SeoGlobalConfig" (
    "id" SERIAL PRIMARY KEY,
    "googleSearchConsoleVerification" TEXT,
    "googleSearchConsolePropertyId" TEXT,
    "googleAnalyticsId" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "youtubeUrl" TEXT,
    "twitterUrl" TEXT,
    "naverBlogUrl" TEXT,
    "kakaoChannelUrl" TEXT,
    "defaultSiteName" TEXT DEFAULT '크루즈 가이드',
    "defaultSiteDescription" TEXT,
    "defaultKeywords" TEXT,
    "defaultOgImage" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "contactAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateIndex
CREATE INDEX "AdminActionLog_adminId_createdAt_idx" ON "AdminActionLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionLog_targetUserId_createdAt_idx" ON "AdminActionLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_userId_isActive_createdAt_idx" ON "AdminMessage"("userId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_adminId_createdAt_idx" ON "AdminMessage"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateCommissionTier_pricingRowId_idx" ON "AffiliateCommissionTier"("pricingRowId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommissionTier_affiliateProductId_cabinType_fareCategory_fareLabel_key" ON "AffiliateCommissionTier"("affiliateProductId", "cabinType", "fareCategory", "fareLabel");

-- CreateIndex
CREATE INDEX "AffiliateContract_invitedByProfileId_idx" ON "AffiliateContract"("invitedByProfileId");

-- CreateIndex
CREATE INDEX "AffiliateContract_status_submittedAt_idx" ON "AffiliateContract"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "AffiliateContract_phone_status_idx" ON "AffiliateContract"("phone", "status");

-- CreateIndex
CREATE INDEX "AffiliateDocument_profileId_documentType_idx" ON "AffiliateDocument"("profileId", "documentType");

-- CreateIndex
CREATE INDEX "AffiliateInteraction_leadId_occurredAt_idx" ON "AffiliateInteraction"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "AffiliateLead_groupId_idx" ON "AffiliateLead"("groupId");

-- CreateIndex
CREATE INDEX "AffiliateLead_customerPhone_idx" ON "AffiliateLead"("customerPhone");

-- CreateIndex
CREATE INDEX "AffiliateLead_agentId_status_idx" ON "AffiliateLead"("agentId", "status");

-- CreateIndex
CREATE INDEX "AffiliateLead_managerId_status_idx" ON "AffiliateLead"("managerId", "status");

-- CreateIndex
CREATE INDEX "AffiliateLead_status_idx" ON "AffiliateLead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "AffiliateLink"("code");

-- CreateIndex
CREATE INDEX "AffiliateLink_utmSource_utmMedium_utmCampaign_idx" ON "AffiliateLink"("utmSource", "utmMedium", "utmCampaign");

-- CreateIndex
CREATE INDEX "AffiliateLink_campaignName_idx" ON "AffiliateLink"("campaignName");

-- CreateIndex
CREATE INDEX "AffiliateLink_status_idx" ON "AffiliateLink"("status");

-- CreateIndex
CREATE INDEX "AffiliateLink_agentId_idx" ON "AffiliateLink"("agentId");

-- CreateIndex
CREATE INDEX "AffiliateLink_managerId_idx" ON "AffiliateLink"("managerId");

-- CreateIndex
CREATE INDEX "AffiliateLinkEvent_linkId_createdAt_idx" ON "AffiliateLinkEvent"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateMedia_documentId_idx" ON "AffiliateMedia"("documentId");

-- CreateIndex
CREATE INDEX "AffiliateMedia_interactionId_idx" ON "AffiliateMedia"("interactionId");

-- CreateIndex
CREATE INDEX "AffiliateProduct_isPublished_idx" ON "AffiliateProduct"("isPublished");

-- CreateIndex
CREATE INDEX "AffiliateProduct_status_idx" ON "AffiliateProduct"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProduct_productCode_effectiveFrom_key" ON "AffiliateProduct"("productCode", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_affiliateCode_key" ON "AffiliateProfile"("affiliateCode");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_landingSlug_key" ON "AffiliateProfile"("landingSlug");

-- CreateIndex
CREATE INDEX "AffiliateProfile_displayName_idx" ON "AffiliateProfile"("displayName");

-- CreateIndex
CREATE INDEX "AffiliateProfile_nickname_idx" ON "AffiliateProfile"("nickname");

-- CreateIndex
CREATE INDEX "AffiliateProfile_type_status_idx" ON "AffiliateProfile"("type", "status");

-- CreateIndex
CREATE INDEX "AffiliateRelation_agentId_status_idx" ON "AffiliateRelation"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateRelation_managerId_agentId_key" ON "AffiliateRelation"("managerId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateSale_externalOrderCode_key" ON "AffiliateSale"("externalOrderCode");

-- CreateIndex
CREATE INDEX "AffiliateSale_agentId_idx" ON "AffiliateSale"("agentId");

-- CreateIndex
CREATE INDEX "AffiliateSale_managerId_idx" ON "AffiliateSale"("managerId");

-- CreateIndex
CREATE INDEX "AffiliateSale_saleDate_idx" ON "AffiliateSale"("saleDate");

-- CreateIndex
CREATE INDEX "AffiliateSale_status_idx" ON "AffiliateSale"("status");

-- CreateIndex
CREATE INDEX "ChatBotFlow_order_idx" ON "ChatBotFlow"("order");

-- CreateIndex
CREATE INDEX "ChatBotFlow_category_isActive_idx" ON "ChatBotFlow"("category", "isActive");

-- CreateIndex
CREATE INDEX "ChatBotQuestion_nextQuestionIdB_idx" ON "ChatBotQuestion"("nextQuestionIdB");

-- CreateIndex
CREATE INDEX "ChatBotQuestion_nextQuestionIdA_idx" ON "ChatBotQuestion"("nextQuestionIdA");

-- CreateIndex
CREATE INDEX "ChatBotQuestion_flowId_order_idx" ON "ChatBotQuestion"("flowId", "order");

-- CreateIndex
CREATE INDEX "ChatBotResponse_isAbandoned_idx" ON "ChatBotResponse"("isAbandoned");

-- CreateIndex
CREATE INDEX "ChatBotResponse_questionOrder_idx" ON "ChatBotResponse"("questionOrder");

-- CreateIndex
CREATE INDEX "ChatBotResponse_questionId_idx" ON "ChatBotResponse"("questionId");

-- CreateIndex
CREATE INDEX "ChatBotResponse_sessionId_createdAt_idx" ON "ChatBotResponse"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatBotSession_sessionId_key" ON "ChatBotSession"("sessionId");

-- CreateIndex
CREATE INDEX "ChatBotSession_paymentStatus_idx" ON "ChatBotSession"("paymentStatus");

-- CreateIndex
CREATE INDEX "ChatBotSession_sessionId_idx" ON "ChatBotSession"("sessionId");

-- CreateIndex
CREATE INDEX "ChatBotSession_finalStatus_idx" ON "ChatBotSession"("finalStatus");

-- CreateIndex
CREATE INDEX "ChatBotSession_isCompleted_idx" ON "ChatBotSession"("isCompleted");

-- CreateIndex
CREATE INDEX "ChatBotSession_userId_idx" ON "ChatBotSession"("userId");

-- CreateIndex
CREATE INDEX "ChatBotSession_flowId_startedAt_idx" ON "ChatBotSession"("flowId", "startedAt");

-- CreateIndex
CREATE INDEX "ChatHistory_userId_tripId_createdAt_idx" ON "ChatHistory"("userId", "tripId", "createdAt");

-- CreateIndex
CREATE INDEX "ChecklistItem_userId_tripId_idx" ON "ChecklistItem"("userId", "tripId");

-- CreateIndex
CREATE INDEX "ChecklistItem_order_idx" ON "ChecklistItem"("order");

-- CreateIndex
CREATE UNIQUE INDEX "CmsNotificationTemplate_triggerCode_key" ON "CmsNotificationTemplate"("triggerCode");

-- CreateIndex
CREATE INDEX "CmsNotificationTemplate_triggerCode_isActive_idx" ON "CmsNotificationTemplate"("triggerCode", "isActive");

-- CreateIndex
CREATE INDEX "CommissionLedger_profileId_isSettled_idx" ON "CommissionLedger"("profileId", "isSettled");

-- CreateIndex
CREATE INDEX "CommissionLedger_saleId_idx" ON "CommissionLedger"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLedger_saleId_profileId_entryType_key" ON "CommissionLedger"("saleId", "profileId", "entryType");

-- CreateIndex
CREATE INDEX "CommunityComment_parentCommentId_idx" ON "CommunityComment"("parentCommentId");

-- CreateIndex
CREATE INDEX "CommunityComment_userId_idx" ON "CommunityComment"("userId");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_createdAt_idx" ON "CommunityComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_isDeleted_createdAt_idx" ON "CommunityPost"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_userId_idx" ON "CommunityPost"("userId");

-- CreateIndex
CREATE INDEX "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_category_isDeleted_idx" ON "CommunityPost"("category", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "CruiseProduct_productCode_key" ON "CruiseProduct"("productCode");

-- CreateIndex
CREATE INDEX "CruiseProduct_saleStatus_idx" ON "CruiseProduct"("saleStatus");

-- CreateIndex
CREATE INDEX "CruiseProduct_category_idx" ON "CruiseProduct"("category");

-- CreateIndex
CREATE INDEX "CruiseProduct_isMainProduct_idx" ON "CruiseProduct"("isMainProduct");

-- CreateIndex
CREATE INDEX "CruiseProduct_isUrgent_idx" ON "CruiseProduct"("isUrgent");

-- CreateIndex
CREATE INDEX "CruiseProduct_isBudget_idx" ON "CruiseProduct"("isBudget");

-- CreateIndex
CREATE INDEX "CruiseProduct_isJapan_idx" ON "CruiseProduct"("isJapan");

-- CreateIndex
CREATE INDEX "CruiseProduct_isDomestic_idx" ON "CruiseProduct"("isDomestic");

-- CreateIndex
CREATE INDEX "CruiseProduct_isGeniePack_idx" ON "CruiseProduct"("isGeniePack");

-- CreateIndex
CREATE INDEX "CruiseProduct_isPremium_idx" ON "CruiseProduct"("isPremium");

-- CreateIndex
CREATE INDEX "CruiseProduct_isRecommended_idx" ON "CruiseProduct"("isRecommended");

-- CreateIndex
CREATE INDEX "CruiseProduct_isPopular_idx" ON "CruiseProduct"("isPopular");

-- CreateIndex
CREATE INDEX "CruiseProduct_source_idx" ON "CruiseProduct"("source");

-- CreateIndex
CREATE INDEX "CruiseProduct_productCode_idx" ON "CruiseProduct"("productCode");

-- CreateIndex
CREATE INDEX "CruiseReview_userId_idx" ON "CruiseReview"("userId");

-- CreateIndex
CREATE INDEX "CruiseReview_createdAt_idx" ON "CruiseReview"("createdAt");

-- CreateIndex
CREATE INDEX "CruiseReview_productCode_isApproved_isDeleted_idx" ON "CruiseReview"("productCode", "isApproved", "isDeleted");

-- CreateIndex
CREATE INDEX "CruiseReview_rating_isApproved_isDeleted_idx" ON "CruiseReview"("rating", "isApproved", "isDeleted");

-- CreateIndex
CREATE INDEX "CustomerGroup_affiliateProfileId_idx" ON "CustomerGroup"("affiliateProfileId");

-- CreateIndex
CREATE INDEX "CustomerGroup_parentGroupId_idx" ON "CustomerGroup"("parentGroupId");

-- CreateIndex
CREATE INDEX "CustomerGroup_name_idx" ON "CustomerGroup"("name");

-- CreateIndex
CREATE INDEX "CustomerGroup_adminId_idx" ON "CustomerGroup"("adminId");

-- CreateIndex
CREATE INDEX "CustomerGroupMember_userId_idx" ON "CustomerGroupMember"("userId");

-- CreateIndex
CREATE INDEX "CustomerGroupMember_groupId_idx" ON "CustomerGroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroupMember_groupId_userId_key" ON "CustomerGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "EmailAddressBook_email_idx" ON "EmailAddressBook"("email");

-- CreateIndex
CREATE INDEX "EmailAddressBook_adminId_createdAt_idx" ON "EmailAddressBook"("adminId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAddressBook_adminId_email_key" ON "EmailAddressBook"("adminId", "email");

-- CreateIndex
CREATE INDEX "Expense_userId_tripId_idx" ON "Expense"("userId", "tripId");

-- CreateIndex
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureUsage_feature_usageCount_idx" ON "FeatureUsage"("feature", "usageCount");

-- CreateIndex
CREATE INDEX "FeatureUsage_lastUsedAt_idx" ON "FeatureUsage"("lastUsedAt");

-- CreateIndex
CREATE INDEX "FeatureUsage_userId_lastUsedAt_idx" ON "FeatureUsage"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsage_userId_feature_key" ON "FeatureUsage"("userId", "feature");

-- CreateIndex
CREATE INDEX "Itinerary_tripId_day_idx" ON "Itinerary"("tripId", "day");

-- CreateIndex
CREATE INDEX "Itinerary_date_idx" ON "Itinerary"("date");

-- CreateIndex
CREATE INDEX "ItineraryGroup_name_idx" ON "ItineraryGroup"("name");

-- CreateIndex
CREATE INDEX "KnowledgeBase_category_isActive_idx" ON "KnowledgeBase"("category", "isActive");

-- CreateIndex
CREATE INDEX "KnowledgeBase_keywords_idx" ON "KnowledgeBase"("keywords");

-- CreateIndex
CREATE INDEX "MallContent_order_idx" ON "MallContent"("order");

-- CreateIndex
CREATE INDEX "MallContent_section_isActive_idx" ON "MallContent"("section", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MallContent_section_key_key" ON "MallContent"("section", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MallProductContent_productCode_key" ON "MallProductContent"("productCode");

-- CreateIndex
CREATE INDEX "MallProductContent_productCode_isActive_idx" ON "MallProductContent"("productCode", "isActive");

-- CreateIndex
CREATE INDEX "MapTravelRecord_userId_createdAt_idx" ON "MapTravelRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MapTravelRecord_createdAt_idx" ON "MapTravelRecord"("createdAt");

-- CreateIndex
CREATE INDEX "MapTravelRecord_startDate_idx" ON "MapTravelRecord"("startDate");

-- CreateIndex
CREATE INDEX "MarketingInsight_userId_insightType_idx" ON "MarketingInsight"("userId", "insightType");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingInsight_userId_insightType_key" ON "MarketingInsight"("userId", "insightType");

-- CreateIndex
CREATE INDEX "MeetingParticipant_joinedAt_idx" ON "MeetingParticipant"("joinedAt");

-- CreateIndex
CREATE INDEX "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");

-- CreateIndex
CREATE INDEX "MeetingParticipant_roomId_idx" ON "MeetingParticipant"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoom_roomId_key" ON "MeetingRoom"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoom_meetingLink_key" ON "MeetingRoom"("meetingLink");

-- CreateIndex
CREATE INDEX "MeetingRoom_scheduledStart_idx" ON "MeetingRoom"("scheduledStart");

-- CreateIndex
CREATE INDEX "MeetingRoom_meetingLink_idx" ON "MeetingRoom"("meetingLink");

-- CreateIndex
CREATE INDEX "MeetingRoom_status_createdAt_idx" ON "MeetingRoom"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MeetingRoom_hostId_idx" ON "MeetingRoom"("hostId");

-- CreateIndex
CREATE INDEX "MeetingRoom_roomId_idx" ON "MeetingRoom"("roomId");

-- CreateIndex
CREATE INDEX "MonthlySettlement_status_idx" ON "MonthlySettlement"("status");

-- CreateIndex
CREATE INDEX "MonthlySettlement_periodStart_periodEnd_idx" ON "MonthlySettlement"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_eventKey_key" ON "NotificationLog"("eventKey");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_tripId_idx" ON "NotificationLog"("userId", "tripId");

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");

-- CreateIndex
CREATE INDEX "PageContent_pagePath_idx" ON "PageContent"("pagePath");

-- CreateIndex
CREATE INDEX "PageContent_order_idx" ON "PageContent"("order");

-- CreateIndex
CREATE INDEX "PageContent_pagePath_section_isActive_idx" ON "PageContent"("pagePath", "section", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PageContent_pagePath_section_itemId_key" ON "PageContent"("pagePath", "section", "itemId");

-- CreateIndex
CREATE INDEX "PartnerCustomerGroup_productCode_idx" ON "PartnerCustomerGroup"("productCode");

-- CreateIndex
CREATE INDEX "PartnerCustomerGroup_profileId_idx" ON "PartnerCustomerGroup"("profileId");

-- CreateIndex
CREATE INDEX "PassportRequestLog_status_sentAt_idx" ON "PassportRequestLog"("status", "sentAt");

-- CreateIndex
CREATE INDEX "PassportRequestLog_adminId_sentAt_idx" ON "PassportRequestLog"("adminId", "sentAt");

-- CreateIndex
CREATE INDEX "PassportRequestLog_userId_sentAt_idx" ON "PassportRequestLog"("userId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "PassportSubmission_token_key" ON "PassportSubmission"("token");

-- CreateIndex
CREATE INDEX "PassportSubmission_isSubmitted_updatedAt_idx" ON "PassportSubmission"("isSubmitted", "updatedAt");

-- CreateIndex
CREATE INDEX "PassportSubmission_tripId_idx" ON "PassportSubmission"("tripId");

-- CreateIndex
CREATE INDEX "PassportSubmission_userId_idx" ON "PassportSubmission"("userId");

-- CreateIndex
CREATE INDEX "PassportSubmissionGuest_name_idx" ON "PassportSubmissionGuest"("name");

-- CreateIndex
CREATE INDEX "PassportSubmissionGuest_submissionId_groupNumber_idx" ON "PassportSubmissionGuest"("submissionId", "groupNumber");

-- CreateIndex
CREATE INDEX "ProductInquiry_createdAt_idx" ON "ProductInquiry"("createdAt");

-- CreateIndex
CREATE INDEX "ProductInquiry_status_idx" ON "ProductInquiry"("status");

-- CreateIndex
CREATE INDEX "ProductInquiry_userId_idx" ON "ProductInquiry"("userId");

-- CreateIndex
CREATE INDEX "ProductInquiry_productCode_idx" ON "ProductInquiry"("productCode");

-- CreateIndex
CREATE INDEX "ProductView_viewedAt_idx" ON "ProductView"("viewedAt");

-- CreateIndex
CREATE INDEX "ProductView_userId_viewedAt_idx" ON "ProductView"("userId", "viewedAt");

-- CreateIndex
CREATE INDEX "ProductView_productCode_viewedAt_idx" ON "ProductView"("productCode", "viewedAt");

-- CreateIndex
CREATE INDEX "Prospect_createdAt_idx" ON "Prospect"("createdAt");

-- CreateIndex
CREATE INDEX "Prospect_isActive_idx" ON "Prospect"("isActive");

-- CreateIndex
CREATE INDEX "Prospect_phone_idx" ON "Prospect"("phone");

-- CreateIndex
CREATE INDEX "Prospect_email_idx" ON "Prospect"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "RePurchaseTrigger_userId_lastTripEndDate_idx" ON "RePurchaseTrigger"("userId", "lastTripEndDate");

-- CreateIndex
CREATE INDEX "RePurchaseTrigger_converted_createdAt_idx" ON "RePurchaseTrigger"("converted", "createdAt");

-- CreateIndex
CREATE INDEX "RefundPolicyGroup_name_idx" ON "RefundPolicyGroup"("name");

-- CreateIndex
CREATE INDEX "ScheduledMessage_targetGroupId_idx" ON "ScheduledMessage"("targetGroupId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_startDate_isActive_idx" ON "ScheduledMessage"("startDate", "isActive");

-- CreateIndex
CREATE INDEX "ScheduledMessage_category_isActive_idx" ON "ScheduledMessage"("category", "isActive");

-- CreateIndex
CREATE INDEX "ScheduledMessage_adminId_createdAt_idx" ON "ScheduledMessage"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduledMessageStage_scheduledMessageId_stageNumber_idx" ON "ScheduledMessageStage"("scheduledMessageId", "stageNumber");

-- CreateIndex
CREATE INDEX "ScheduledMessageStage_scheduledMessageId_order_idx" ON "ScheduledMessageStage"("scheduledMessageId", "order");

-- CreateIndex
CREATE INDEX "FunnelMessage_groupId_idx" ON "FunnelMessage"("groupId");

-- CreateIndex
CREATE INDEX "FunnelMessage_messageType_isActive_idx" ON "FunnelMessage"("messageType", "isActive");

-- CreateIndex
CREATE INDEX "FunnelMessage_adminId_createdAt_idx" ON "FunnelMessage"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "FunnelMessageStage_funnelMessageId_stageNumber_idx" ON "FunnelMessageStage"("funnelMessageId", "stageNumber");

-- CreateIndex
CREATE INDEX "FunnelMessageStage_funnelMessageId_order_idx" ON "FunnelMessageStage"("funnelMessageId", "order");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "SettlementEvent_settlementId_createdAt_idx" ON "SettlementEvent"("settlementId", "createdAt");

-- CreateIndex
CREATE INDEX "TravelDiaryEntry_userId_tripId_idx" ON "TravelDiaryEntry"("userId", "tripId");

-- CreateIndex
CREATE INDEX "TravelDiaryEntry_userId_countryCode_idx" ON "TravelDiaryEntry"("userId", "countryCode");

-- CreateIndex
CREATE INDEX "TravelDiaryEntry_visitDate_idx" ON "TravelDiaryEntry"("visitDate");

-- CreateIndex
CREATE INDEX "Trip_userId_status_idx" ON "Trip"("userId", "status");

-- CreateIndex
CREATE INDEX "Trip_startDate_idx" ON "Trip"("startDate");

-- CreateIndex
CREATE INDEX "Trip_createdAt_idx" ON "Trip"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TripFeedback_tripId_key" ON "TripFeedback"("tripId");

-- CreateIndex
CREATE INDEX "TripFeedback_userId_idx" ON "TripFeedback"("userId");

-- CreateIndex
CREATE INDEX "TripFeedback_createdAt_idx" ON "TripFeedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isHibernated_lastActiveAt_idx" ON "User"("isHibernated", "lastActiveAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_customerStatus_idx" ON "User"("customerStatus");

-- CreateIndex
CREATE INDEX "User_role_customerStatus_idx" ON "User"("role", "customerStatus");

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_action_createdAt_idx" ON "UserActivity"("action", "createdAt");

-- CreateIndex
CREATE INDEX "UserMessageRead_userId_readAt_idx" ON "UserMessageRead"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserMessageRead_userId_messageId_key" ON "UserMessageRead"("userId", "messageId");

-- CreateIndex
CREATE INDEX "UserSchedule_userId_date_idx" ON "UserSchedule"("userId", "date");

-- CreateIndex
CREATE INDEX "UserSchedule_date_idx" ON "UserSchedule"("date");

-- CreateIndex
CREATE INDEX "VisitedCountry_userId_idx" ON "VisitedCountry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitedCountry_userId_countryCode_key" ON "VisitedCountry"("userId", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_shortcutUrl_key" ON "LandingPage"("shortcutUrl");

-- CreateIndex
CREATE INDEX "LandingPage_adminId_idx" ON "LandingPage"("adminId");

-- CreateIndex
CREATE INDEX "LandingPage_category_idx" ON "LandingPage"("category");

-- CreateIndex
CREATE INDEX "LandingPage_pageGroup_idx" ON "LandingPage"("pageGroup");

-- CreateIndex
CREATE INDEX "LandingPage_slug_idx" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_groupId_idx" ON "LandingPage"("groupId");

-- CreateIndex
CREATE INDEX "LandingPage_isActive_idx" ON "LandingPage"("isActive");

-- CreateIndex
CREATE INDEX "LandingPage_isPublic_idx" ON "LandingPage"("isPublic");

-- CreateIndex
CREATE INDEX "LandingPage_marketingAccountId_idx" ON "LandingPage"("marketingAccountId");

-- CreateIndex
CREATE INDEX "LandingPage_marketingFunnelId_funnelOrder_idx" ON "LandingPage"("marketingFunnelId", "funnelOrder");

-- CreateIndex
CREATE INDEX "LandingPageView_landingPageId_viewedAt_idx" ON "LandingPageView"("landingPageId", "viewedAt");

-- CreateIndex
CREATE INDEX "LandingPageView_userId_viewedAt_idx" ON "LandingPageView"("userId", "viewedAt");

-- CreateIndex
CREATE INDEX "LandingPageView_userPhone_idx" ON "LandingPageView"("userPhone");

-- CreateIndex
CREATE INDEX "LandingPageFunnel_landingPageId_startTime_idx" ON "LandingPageFunnel"("landingPageId", "startTime");

-- CreateIndex
CREATE INDEX "LandingPageFunnel_userId_startTime_idx" ON "LandingPageFunnel"("userId", "startTime");

-- CreateIndex
CREATE INDEX "LandingPageFunnel_userPhone_idx" ON "LandingPageFunnel"("userPhone");

-- CreateIndex
CREATE INDEX "LandingPageFunnel_funnelName_idx" ON "LandingPageFunnel"("funnelName");

-- CreateIndex
CREATE INDEX "LandingPageRegistration_landingPageId_registeredAt_idx" ON "LandingPageRegistration"("landingPageId", "registeredAt");

-- CreateIndex
CREATE INDEX "LandingPageRegistration_phone_idx" ON "LandingPageRegistration"("phone");

-- CreateIndex
CREATE INDEX "LandingPageRegistration_userId_idx" ON "LandingPageRegistration"("userId");

-- CreateIndex
CREATE INDEX "LandingPageRegistration_customerGroup_idx" ON "LandingPageRegistration"("customerGroup");

-- CreateIndex
CREATE INDEX "LandingPageRegistration_registeredAt_idx" ON "LandingPageRegistration"("registeredAt");

-- CreateIndex
CREATE INDEX "LandingPageComment_landingPageId_createdAt_idx" ON "LandingPageComment"("landingPageId", "createdAt");

-- CreateIndex
CREATE INDEX "LandingPageComment_createdAt_idx" ON "LandingPageComment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAccount_accountCode_key" ON "MarketingAccount"("accountCode");

-- CreateIndex
CREATE INDEX "MarketingAccount_ownerId_idx" ON "MarketingAccount"("ownerId");

-- CreateIndex
CREATE INDEX "MarketingAccount_accountCode_idx" ON "MarketingAccount"("accountCode");

-- CreateIndex
CREATE INDEX "MarketingAccount_status_idx" ON "MarketingAccount"("status");

-- CreateIndex
CREATE INDEX "MarketingCustomer_accountId_status_idx" ON "MarketingCustomer"("accountId", "status");

-- CreateIndex
CREATE INDEX "MarketingCustomer_accountId_createdAt_idx" ON "MarketingCustomer"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingCustomer_phone_idx" ON "MarketingCustomer"("phone");

-- CreateIndex
CREATE INDEX "MarketingCustomer_email_idx" ON "MarketingCustomer"("email");

-- CreateIndex
CREATE INDEX "MarketingCustomer_leadScore_idx" ON "MarketingCustomer"("leadScore");

-- CreateIndex
CREATE INDEX "MarketingCustomer_status_lastContactedAt_idx" ON "MarketingCustomer"("status", "lastContactedAt");

-- CreateIndex
CREATE INDEX "MarketingFunnel_accountId_status_idx" ON "MarketingFunnel"("accountId", "status");

-- CreateIndex
CREATE INDEX "MarketingFunnel_accountId_funnelType_idx" ON "MarketingFunnel"("accountId", "funnelType");

-- CreateIndex
CREATE INDEX "MarketingFunnel_funnelName_idx" ON "MarketingFunnel"("funnelName");

-- CreateIndex
CREATE INDEX "FunnelStage_funnelId_stageOrder_idx" ON "FunnelStage"("funnelId", "stageOrder");

-- CreateIndex
CREATE INDEX "FunnelStage_funnelId_isActive_idx" ON "FunnelStage"("funnelId", "isActive");

-- CreateIndex
CREATE INDEX "MarketingLead_accountId_status_idx" ON "MarketingLead"("accountId", "status");

-- CreateIndex
CREATE INDEX "MarketingLead_accountId_createdAt_idx" ON "MarketingLead"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingLead_phone_idx" ON "MarketingLead"("phone");

-- CreateIndex
CREATE INDEX "MarketingLead_email_idx" ON "MarketingLead"("email");

-- CreateIndex
CREATE INDEX "MarketingLead_leadScore_idx" ON "MarketingLead"("leadScore");

-- CreateIndex
CREATE INDEX "LeadInteraction_leadId_occurredAt_idx" ON "LeadInteraction"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "LeadInteraction_interactionType_occurredAt_idx" ON "LeadInteraction"("interactionType", "occurredAt");

-- CreateIndex
CREATE INDEX "LeadScore_accountId_score_idx" ON "LeadScore"("accountId", "score");

-- CreateIndex
CREATE INDEX "LeadScore_customerId_idx" ON "LeadScore"("customerId");

-- CreateIndex
CREATE INDEX "LeadScore_leadId_idx" ON "LeadScore"("leadId");

-- CreateIndex
CREATE INDEX "LeadScore_lastCalculatedAt_idx" ON "LeadScore"("lastCalculatedAt");

-- CreateIndex
CREATE INDEX "FunnelConversion_funnelId_convertedAt_idx" ON "FunnelConversion"("funnelId", "convertedAt");

-- CreateIndex
CREATE INDEX "FunnelConversion_customerId_convertedAt_idx" ON "FunnelConversion"("customerId", "convertedAt");

-- CreateIndex
CREATE INDEX "FunnelConversion_conversionType_convertedAt_idx" ON "FunnelConversion"("conversionType", "convertedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepeatPurchase_customerId_key" ON "RepeatPurchase"("customerId");

-- CreateIndex
CREATE INDEX "RepeatPurchase_customerId_idx" ON "RepeatPurchase"("customerId");

-- CreateIndex
CREATE INDEX "RepeatPurchase_lastPurchaseAt_idx" ON "RepeatPurchase"("lastPurchaseAt");

-- CreateIndex
CREATE INDEX "RepeatPurchase_isActive_daysSinceLastPurchase_idx" ON "RepeatPurchase"("isActive", "daysSinceLastPurchase");

-- CreateIndex
CREATE UNIQUE INDEX "ViralLoop_referralCode_key" ON "ViralLoop"("referralCode");

-- CreateIndex
CREATE INDEX "ViralLoop_accountId_status_idx" ON "ViralLoop"("accountId", "status");

-- CreateIndex
CREATE INDEX "ViralLoop_customerId_idx" ON "ViralLoop"("customerId");

-- CreateIndex
CREATE INDEX "ViralLoop_referralCode_idx" ON "ViralLoop"("referralCode");

-- CreateIndex
CREATE INDEX "ViralLoop_referredByCustomerId_idx" ON "ViralLoop"("referredByCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSmsConfig_adminId_key" ON "AdminSmsConfig"("adminId");

-- CreateIndex
CREATE INDEX "AdminSmsConfig_adminId_isActive_idx" ON "AdminSmsConfig"("adminId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSmsConfig_profileId_key" ON "PartnerSmsConfig"("profileId");

-- CreateIndex
CREATE INDEX "PartnerSmsConfig_profileId_isActive_idx" ON "PartnerSmsConfig"("profileId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateSmsConfig_profileId_key" ON "AffiliateSmsConfig"("profileId");

-- CreateIndex
CREATE INDEX "AffiliateSmsConfig_profileId_isActive_idx" ON "AffiliateSmsConfig"("profileId", "isActive");

-- CreateIndex
CREATE INDEX "MarketingConfig_isGoogleEnabled_idx" ON "MarketingConfig"("isGoogleEnabled");

-- CreateIndex
CREATE INDEX "MarketingConfig_isFacebookEnabled_idx" ON "MarketingConfig"("isFacebookEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "SeoConfig_pagePath_key" ON "SeoConfig"("pagePath");

-- CreateIndex
CREATE INDEX "SeoConfig_pagePath_idx" ON "SeoConfig"("pagePath");

-- CreateIndex
CREATE INDEX "SeoConfig_pageType_idx" ON "SeoConfig"("pageType");

-- CreateIndex
CREATE INDEX "SeoConfig_lastUpdated_idx" ON "SeoConfig"("lastUpdated");

-- CreateIndex
CREATE INDEX "SeoGlobalConfig_createdAt_idx" ON "SeoGlobalConfig"("createdAt");

