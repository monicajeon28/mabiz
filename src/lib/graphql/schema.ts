/**
 * GraphQL Schema Definition for mabiz CRM
 * Defines types, queries, mutations, and subscriptions
 *
 * Generated TypeScript types: npm run codegen
 * Schema reference: docs/GRAPHQL_API.md
 *
 * Structure:
 * - Types: Contact, Campaign, Forecast, Segment, Partner, Analytics
 * - Queries: contact, contacts, campaigns, segments, forecasts
 * - Mutations: createCampaign, updateContact, triggerWorkflow
 * - Subscriptions: onSaleCreated, onCampaignStatusChanged (optional Phase 2)
 */

import { gql } from "graphql-tag";

export const typeDefs = gql`
  # ═════════════════════════════════════════════════════════════
  # SCALAR TYPES
  # ═════════════════════════════════════════════════════════════

  scalar DateTime
  scalar JSON

  # ═════════════════════════════════════════════════════════════
  # ENUM TYPES
  # ═════════════════════════════════════════════════════════════

  enum ContactSegment {
    L0_REACTIVATION
    L1_PRICE_OBJECTION
    L2_PREPARATION_ANXIETY
    L3_DIFFERENTIATION
    L4_FEATURE_STRUCTURE
    L5_SUITABILITY_MEDICAL
    L6_TIMING_LOSS_AVERSION
    L7_COMPANION_PERSUASION
    L8_REPURCHASE_HABIT
    L9_HEALTH_SAFETY_TRUST
    L10_IMMEDIATE_CLOSING
    UNCLASSIFIED
  }

  enum LensType {
    L0_INACTIVE
    L1_PRICE_SENSITIVE
    L2_ANXIOUS
    L3_COMPETITOR_AWARE
    L4_FEATURE_FOCUSED
    L5_HEALTH_CONSCIOUS
    L6_TIME_SENSITIVE
    L7_FAMILY_INFLUENCED
    L8_HABITUAL
    L9_TRUST_BASED
    L10_URGENT_BUYER
  }

  enum CampaignStatus {
    DRAFT
    SCHEDULED
    RUNNING
    PAUSED
    COMPLETED
    CANCELLED
  }

  enum CampaignChannel {
    SMS
    EMAIL
    KAKAO
    PUSH_NOTIFICATION
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum PartnerTier {
    TIER_1_BRONZE
    TIER_2_SILVER
    TIER_3_GOLD
    TIER_4_PLATINUM
  }

  # ═════════════════════════════════════════════════════════════
  # OBJECT TYPES
  # ═════════════════════════════════════════════════════════════

  """
  Contact represents a customer or prospect in the CRM system.
  Includes personal info, segmentation, risk scoring, and interaction history.
  """
  type Contact {
    id: ID!
    phone: String!
    name: String!
    email: String

    # Organization and Assignment
    organizationId: ID!
    assignedUserId: String

    # Segmentation & Lens Classification
    segment: ContactSegment!
    lens: LensType!

    # Risk and Performance Metrics
    riskScore: Int! # 0-100
    riskLevel: RiskLevel!
    leadScore: Int!

    # Product and Booking
    productName: String
    cruiseInterest: String
    departureDate: DateTime
    budgetRange: String
    bookingRef: String

    # Contact History
    lastContactedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    optOutAt: DateTime

    # Payment Information (masked)
    lastPaymentStatus: String
    lastPaymentAt: DateTime
    lastRefundedAt: DateTime
    purchasedAt: DateTime

    # Relationships
    segment_data: Segment
    campaigns: [Campaign!]!
    interactions: [ContactInteraction!]!
    lens_classification: LensClassification

    # Metadata
    affiliateCode: String
    adminMemo: String
  }

  """
  ContactInteraction tracks all communications with a contact
  """
  type ContactInteraction {
    id: ID!
    contactId: ID!
    type: String! # SMS, EMAIL, CALL, KAKAO
    channel: CampaignChannel!
    message: String!
    sentAt: DateTime!
    openedAt: DateTime
    clickedAt: DateTime
    status: String! # SENT, DELIVERED, OPENED, CLICKED, FAILED
    metadata: JSON
  }

  """
  LensClassification represents a contact's psychology-based lens profile
  """
  type LensClassification {
    id: ID!
    contactId: ID!
    lens: LensType!
    confidence: Float! # 0-100
    signals: [String!]! # What triggered this lens detection
    recommendedMessage: String
    expectedConversionRate: Float! # L-specific conversion rate
    updatedAt: DateTime!
  }

  """
  Campaign represents a marketing campaign or communication sequence
  """
  type Campaign {
    id: ID!
    organizationId: ID!
    name: String!
    description: String

    # Campaign Setup
    channels: [CampaignChannel!]!
    status: CampaignStatus!
    messageTemplate: String!

    # Targeting
    targetSegments: [ContactSegment!]!
    targetLenses: [LensType!]!
    totalContacts: Int!

    # Performance Metrics
    metrics: CampaignMetrics!

    # Scheduling
    scheduledAt: DateTime
    startedAt: DateTime
    completedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # A/B Testing
    abVariants: [CampaignVariant!]!

    # Relationships
    contacts: [Contact!]!
  }

  """
  CampaignVariant for A/B testing
  """
  type CampaignVariant {
    id: ID!
    campaignId: ID!
    name: String! # "Variant A", "Variant B"
    messageTemplate: String!
    percentage: Float! # 0-100 (split percentage)

    # Performance
    totalSent: Int!
    delivered: Int!
    opened: Int!
    clicked: Int!
    conversions: Int!

    # Calculated Rates
    deliveryRate: Float!
    openRate: Float!
    clickRate: Float!
    conversionRate: Float!

    createdAt: DateTime!
  }

  """
  CampaignMetrics aggregates campaign performance across all contacts
  """
  type CampaignMetrics {
    campaignId: ID!

    # Volumes
    totalContacts: Int!
    totalSent: Int!
    totalDelivered: Int!
    totalOpened: Int!
    totalClicked: Int!
    totalConversions: Int!

    # Rates (%)
    deliveryRate: Float!
    openRate: Float!
    clickRate: Float!
    conversionRate: Float!

    # Revenue Impact
    estimatedRevenue: Float!
    costPerAcquisition: Float!
    returnOnAdSpend: Float!

    # Trending
    sentPerDay: Float!
    conversionTrend: Float! # Week-over-week % change
    updatedAt: DateTime!
  }

  """
  Segment represents a customer segment with psychological profile
  """
  type Segment {
    id: ID!
    organizationId: ID!
    name: String!
    description: String

    # Segmentation
    lens: LensType!
    size: Int! # Number of contacts

    # Metrics
    churnRisk: Float! # 0-100
    conversionRate: Float!
    averageLifetimeValue: Float!

    # Profile
    profile: JSON! # Demographic + psychographic data
    recommendedMessage: String
    recommendedChannels: [CampaignChannel!]!

    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    contacts: [Contact!]!
  }

  """
  Forecast provides predictive analytics for revenue and conversion
  """
  type Forecast {
    id: ID!
    organizationId: ID!
    metric: String! # REVENUE, CONVERSION_RATE, CHURN_RATE, LTV

    # Prediction Window
    forecastDate: DateTime!
    days: Int! # Days in future to forecast

    # Predicted Values
    predictedValue: Float!
    lowerBound: Float! # 95% confidence interval lower
    upperBound: Float! # 95% confidence interval upper
    confidence: Float! # 0-100

    # Drivers (what influenced the forecast)
    drivers: [ForecastDriver!]!

    # Historical Context
    previousActualValue: Float
    trend: Float! # Week-over-week % change
    seasonality: Float! # Estimated seasonal impact

    createdAt: DateTime!
    updatedAt: DateTime!
  }

  """
  ForecastDriver explains what factors influenced the forecast
  """
  type ForecastDriver {
    name: String!
    impact: Float! # Positive or negative % impact
    description: String!
  }

  """
  Partner represents an affiliate or sales partner
  """
  type Partner {
    id: ID!
    organizationId: ID!
    name: String!
    email: String
    phone: String

    # Sales Performance
    totalSales: Float!
    salesThisMonth: Float!
    commissionRate: Float! # 15-25%
    commissionEarned: Float!

    # Partnership Info
    tier: PartnerTier!
    status: String! # ACTIVE, SUSPENDED, INACTIVE
    joinedAt: DateTime!

    # Churn Risk
    riskScore: Int! # 0-100
    lastActivityAt: DateTime
    inactivityDays: Int!

    # Relationships
    contacts: [Contact!]!
    sales: [PartnerSale!]!

    createdAt: DateTime!
    updatedAt: DateTime!
  }

  """
  PartnerSale tracks revenue attributed to a partner
  """
  type PartnerSale {
    id: ID!
    partnerId: ID!
    contactId: ID!
    amount: Float!
    commissionAmount: Float!
    attributionModel: String! # LAST_TOUCH, TIME_DECAY, DATA_DRIVEN
    saleDate: DateTime!
    createdAt: DateTime!
  }

  """
  Analytics aggregates system-wide performance metrics
  """
  type Analytics {
    organizationId: ID!
    period: String! # TODAY, WEEK, MONTH, QUARTER, YEAR

    # Revenue Metrics
    totalRevenue: Float!
    revenueGrowth: Float! # Week-over-week %

    # Contact Metrics
    totalContacts: Int!
    newContactsAdded: Int!
    activeContacts: Int!
    churnedContacts: Int!

    # Campaign Metrics
    campaignsRunning: Int!
    averageConversionRate: Float!
    averageCPA: Float!

    # Segment Distribution
    segmentDistribution: [SegmentStat!]!

    # Risk Assessment
    highRiskContacts: Int!
    criticalRiskContacts: Int!

    # Partner Performance
    topPartners: [Partner!]!
    partnerRetention: Float!

    generatedAt: DateTime!
  }

  """
  SegmentStat represents a single segment's contribution
  """
  type SegmentStat {
    segment: ContactSegment!
    count: Int!
    conversionRate: Float!
    averageLifetimeValue: Float!
  }

  # ═════════════════════════════════════════════════════════════
  # INPUT TYPES (for Mutations)
  # ═════════════════════════════════════════════════════════════

  input ContactFilterInput {
    segment: ContactSegment
    lens: LensType
    riskLevel: RiskLevel
    assignedUserId: String
    phone: String
    email: String
    leadScoreMin: Int
    leadScoreMax: Int
    createdAfter: DateTime
    createdBefore: DateTime
    search: String # Full-text search on name/email/phone
  }

  input CampaignFilterInput {
    status: CampaignStatus
    channel: CampaignChannel
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input CreateCampaignInput {
    name: String!
    description: String
    channels: [CampaignChannel!]!
    messageTemplate: String!
    targetSegments: [ContactSegment!]!
    targetLenses: [LensType!]!
    scheduledAt: DateTime
  }

  input UpdateContactSegmentInput {
    contactId: ID!
    segmentId: ID!
  }

  input TriggerWorkflowInput {
    contactId: ID!
    workflowId: ID!
    metadata: JSON
  }

  input CreateSegmentInput {
    name: String!
    description: String
    lens: LensType!
    profile: JSON!
  }

  # ═════════════════════════════════════════════════════════════
  # ROOT TYPES
  # ═════════════════════════════════════════════════════════════

  """
  Root Query type - read-only operations
  """
  type Query {
    # ─────────────── Contact Queries ───────────────
    """
    Get a single contact by ID with all relationships
    """
    contact(id: ID!): Contact

    """
    Search and filter contacts with pagination
    Up to 1000 results per query (use offset for pagination)
    """
    contacts(
      filter: ContactFilterInput
      limit: Int! = 50
      offset: Int! = 0
      orderBy: String = "createdAt"
      orderDirection: String = "DESC"
    ): ContactConnection!

    """
    Get contacts at high risk of churn
    """
    atRiskContacts(
      riskLevel: RiskLevel = HIGH
      limit: Int! = 50
    ): [Contact!]!

    # ─────────────── Campaign Queries ───────────────
    """
    Get a single campaign with metrics and variants
    """
    campaign(id: ID!): Campaign

    """
    List all campaigns with filtering and pagination
    """
    campaigns(
      filter: CampaignFilterInput
      limit: Int! = 50
      offset: Int! = 0
    ): CampaignConnection!

    # ─────────────── Segment Queries ───────────────
    """
    Get all segments for the organization
    """
    segments: [Segment!]!

    """
    Get a single segment with contact list
    """
    segment(id: ID!): Segment

    # ─────────────── Forecast Queries ───────────────
    """
    Get revenue forecast for specified number of days
    """
    revenueForecasts(
      days: Int! = 30
      limit: Int! = 10
    ): [Forecast!]!

    """
    Get conversion rate forecast
    """
    conversionForecasts(
      days: Int! = 30
    ): [Forecast!]!

    """
    Get churn rate forecast
    """
    churnForecasts(
      days: Int! = 30
    ): [Forecast!]!

    # ─────────────── Partner Queries ───────────────
    """
    Get all partners for the organization
    """
    partners(limit: Int! = 50): [Partner!]!

    """
    Get a single partner with sales and contacts
    """
    partner(id: ID!): Partner

    """
    Get top performing partners
    """
    topPartners(limit: Int! = 10): [Partner!]!

    # ─────────────── Analytics Queries ───────────────
    """
    Get organization-wide analytics for a time period
    """
    analytics(period: String! = "MONTH"): Analytics!

    """
    Get real-time health check
    """
    health: String!
  }

  """
  Connection type for paginated contact results
  """
  type ContactConnection {
    edges: [ContactEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ContactEdge {
    node: Contact!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  """
  Connection type for paginated campaign results
  """
  type CampaignConnection {
    edges: [CampaignEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CampaignEdge {
    node: Campaign!
    cursor: String!
  }

  """
  Root Mutation type - write operations
  """
  type Mutation {
    # ─────────────── Campaign Mutations ───────────────
    """
    Create a new marketing campaign
    Returns the created campaign with ID
    """
    createCampaign(input: CreateCampaignInput!): Campaign!

    """
    Update an existing campaign
    """
    updateCampaign(
      id: ID!
      name: String
      status: CampaignStatus
      messageTemplate: String
    ): Campaign!

    """
    Delete a campaign (only if DRAFT status)
    """
    deleteCampaign(id: ID!): Boolean!

    """
    Launch a scheduled campaign immediately
    """
    launchCampaign(id: ID!): Campaign!

    """
    Pause a running campaign
    """
    pauseCampaign(id: ID!): Campaign!

    # ─────────────── Contact Mutations ───────────────
    """
    Update a contact's segment and lens classification
    """
    updateContactSegment(input: UpdateContactSegmentInput!): Contact!

    """
    Update a contact's risk score and flags
    """
    updateContactRisk(
      contactId: ID!
      riskScore: Int!
      riskLevel: RiskLevel!
    ): Contact!

    """
    Tag a contact (add to segment, update status, etc)
    """
    tagContact(
      contactId: ID!
      tags: [String!]!
    ): Contact!

    # ─────────────── Workflow Mutations ───────────────
    """
    Trigger an automated workflow for a contact
    E.g., send SMS, update segment, assign to user
    """
    triggerWorkflow(input: TriggerWorkflowInput!): WorkflowExecution!

    """
    Trigger bulk workflow for multiple contacts
    """
    triggerBulkWorkflow(
      contactIds: [ID!]!
      workflowId: ID!
    ): BulkWorkflowResult!

    # ─────────────── Segment Mutations ───────────────
    """
    Create a new customer segment
    """
    createSegment(input: CreateSegmentInput!): Segment!

    """
    Update an existing segment
    """
    updateSegment(
      id: ID!
      name: String
      profile: JSON
    ): Segment!

    """
    Delete a segment
    """
    deleteSegment(id: ID!): Boolean!
  }

  type WorkflowExecution {
    id: ID!
    contactId: ID!
    workflowId: ID!
    status: String! # PENDING, IN_PROGRESS, COMPLETED, FAILED
    startedAt: DateTime!
    completedAt: DateTime
    logs: [String!]!
  }

  type BulkWorkflowResult {
    totalContacts: Int!
    successful: Int!
    failed: Int!
    executions: [WorkflowExecution!]!
  }

  # ═════════════════════════════════════════════════════════════
  # SUBSCRIPTIONS (Phase 2 - WebSocket support)
  # ═════════════════════════════════════════════════════════════

  """
  Subscription type - real-time updates via WebSocket
  Phase 2: Requires Redis pub/sub or similar
  """
  type Subscription {
    """
    Subscribe to new sales in real-time
    """
    onSaleCreated(organizationId: ID!): Contact!

    """
    Subscribe to campaign status changes
    """
    onCampaignStatusChanged(campaignId: ID!): Campaign!

    """
    Subscribe to forecast updates
    """
    onForecastUpdated(organizationId: ID!): Forecast!

    """
    Subscribe to contact risk score changes
    """
    onContactRiskUpdated(contactId: ID!): Contact!
  }

  # ═════════════════════════════════════════════════════════════
  # ERROR TYPES
  # ═════════════════════════════════════════════════════════════

  type GraphQLError {
    code: String!
    message: String!
    path: [String!]
    timestamp: DateTime!
  }
`;
