# GraphQL API Documentation

## Overview

The mabiz CRM GraphQL API provides a flexible, type-safe interface for querying and mutating CRM data. Built with Apollo Server and Next.js, it offers:

- **Type Safety**: Full TypeScript support with auto-generated types
- **Performance**: DataLoader batching prevents N+1 queries
- **Security**: Authentication, authorization, and field-level PII masking
- **Developer Experience**: Interactive Playground in development mode
- **Monitoring**: Query performance logging and custom error handling

## Quick Start

### Endpoint

```
POST /api/graphql
```

### Authentication

Include your session token in the `Authorization` header:

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"query":"{ health }"}'
```

### GraphQL Playground

In development, open your browser to:

```
http://localhost:3000/api/graphql
```

The interactive explorer allows you to:
- Write and execute queries
- Browse the full schema
- Auto-complete fields and arguments
- View inline documentation

## Schema Reference

### Types

#### Contact

Represents a customer or prospect in the CRM system.

```graphql
type Contact {
  id: ID!
  phone: String!
  name: String!
  email: String  # Masked for non-admin users
  
  organizationId: ID!
  assignedUserId: String
  
  # Segmentation & Psychology
  segment: ContactSegment!
  lens: LensType!
  riskScore: Int!  # 0-100
  riskLevel: RiskLevel!
  leadScore: Int!
  
  # Product & Booking
  productName: String
  cruiseInterest: String
  departureDate: DateTime
  budgetRange: String
  bookingRef: String
  
  # History
  lastContactedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  optOutAt: DateTime
  
  # Payment
  lastPaymentStatus: String
  lastPaymentAt: DateTime
  
  # Relationships
  segment_data: Segment
  campaigns: [Campaign!]!
  interactions: [ContactInteraction!]!
}
```

**PII Masking Rules:**
- `GLOBAL_ADMIN`: No masking
- `ORG_ADMIN`: No masking
- `AGENT`: Email and phone masked (e.g., `j***@e***.com`)
- `PUBLIC`: Full masking (no access)

#### Campaign

Represents a marketing campaign or communication sequence.

```graphql
type Campaign {
  id: ID!
  organizationId: ID!
  name: String!
  description: String
  
  channels: [CampaignChannel!]!
  status: CampaignStatus!
  messageTemplate: String!
  
  targetSegments: [ContactSegment!]!
  targetLenses: [LensType!]!
  totalContacts: Int!
  
  metrics: CampaignMetrics!
  
  scheduledAt: DateTime
  startedAt: DateTime
  completedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  
  abVariants: [CampaignVariant!]!
  contacts: [Contact!]!
}
```

#### Segment

Customer segment with psychological profile.

```graphql
type Segment {
  id: ID!
  organizationId: ID!
  name: String!
  lens: LensType!
  size: Int!
  
  churnRisk: Float!  # 0-100
  conversionRate: Float!
  averageLifetimeValue: Float!
  
  profile: JSON!  # Demographic + psychographic
  recommendedChannels: [CampaignChannel!]!
  
  createdAt: DateTime!
  updatedAt: DateTime!
  contacts: [Contact!]!
}
```

#### Forecast

Predictive analytics result.

```graphql
type Forecast {
  id: ID!
  organizationId: ID!
  metric: String!  # REVENUE, CONVERSION_RATE, CHURN_RATE, LTV
  
  forecastDate: DateTime!
  days: Int!
  
  predictedValue: Float!
  lowerBound: Float!  # 95% CI
  upperBound: Float!  # 95% CI
  confidence: Float!  # 0-100
  
  drivers: [ForecastDriver!]!
  previousActualValue: Float
  trend: Float!  # % change
  seasonality: Float!
  
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

#### Analytics

Organization-wide performance metrics.

```graphql
type Analytics {
  organizationId: ID!
  period: String!  # TODAY, WEEK, MONTH, QUARTER, YEAR
  
  totalRevenue: Float!
  revenueGrowth: Float!
  
  totalContacts: Int!
  newContactsAdded: Int!
  activeContacts: Int!
  churnedContacts: Int!
  
  campaignsRunning: Int!
  averageConversionRate: Float!
  averageCPA: Float!
  
  segmentDistribution: [SegmentStat!]!
  
  highRiskContacts: Int!
  criticalRiskContacts: Int!
  
  topPartners: [Partner!]!
  partnerRetention: Float!
  
  generatedAt: DateTime!
}
```

### Enums

#### ContactSegment

Psychological lens classification for contacts:

- `L0_REACTIVATION` - Inactive customers needing re-engagement
- `L1_PRICE_OBJECTION` - Price-sensitive buyers
- `L2_PREPARATION_ANXIETY` - Anxious about preparation
- `L3_DIFFERENTIATION` - Competing options awareness
- `L4_FEATURE_STRUCTURE` - Feature-focused decision makers
- `L5_SUITABILITY_MEDICAL` - Health/medical concerns
- `L6_TIMING_LOSS_AVERSION` - Time-sensitive with loss aversion
- `L7_COMPANION_PERSUASION` - Family/companion influenced
- `L8_REPURCHASE_HABIT` - Repeat customers
- `L9_HEALTH_SAFETY_TRUST` - Trust-based buyers
- `L10_IMMEDIATE_CLOSING` - Ready-to-buy urgency

#### CampaignStatus

- `DRAFT` - Not yet started
- `SCHEDULED` - Scheduled to start
- `RUNNING` - Currently active
- `PAUSED` - Paused by user
- `COMPLETED` - Finished
- `CANCELLED` - Cancelled

#### CampaignChannel

- `SMS`
- `EMAIL`
- `KAKAO`
- `PUSH_NOTIFICATION`

#### RiskLevel

- `LOW` - Risk score 0-40
- `MEDIUM` - Risk score 40-60
- `HIGH` - Risk score 60-80
- `CRITICAL` - Risk score 80-100

## Query Examples

### Get Single Contact

```graphql
query {
  contact(id: "cl5k3j2x1") {
    id
    name
    email
    phone
    segment
    lens
    riskScore
    riskLevel
    campaigns {
      id
      name
      status
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "contact": {
      "id": "cl5k3j2x1",
      "name": "John Doe",
      "email": "j***@e***.com",
      "phone": "010****5678",
      "segment": "L6_TIMING_LOSS_AVERSION",
      "lens": "L6_TIME_SENSITIVE",
      "riskScore": 65,
      "riskLevel": "HIGH",
      "campaigns": [
        {
          "id": "cam123",
          "name": "Q2 Summer Promo",
          "status": "RUNNING"
        }
      ]
    }
  }
}
```

### Search Contacts with Filters

```graphql
query {
  contacts(
    filter: {
      segment: L6_TIMING_LOSS_AVERSION
      riskLevel: HIGH
      leadScoreMin: 50
      createdAfter: "2026-04-01T00:00:00Z"
    }
    limit: 50
    offset: 0
    orderBy: "leadScore"
    orderDirection: "DESC"
  ) {
    edges {
      node {
        id
        name
        email
        riskScore
        leadScore
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      totalCount: Int!
    }
    totalCount
  }
}
```

### Get Campaign Metrics

```graphql
query {
  campaign(id: "cam123") {
    id
    name
    status
    totalContacts
    
    metrics {
      totalSent
      totalDelivered
      totalOpened
      totalClicked
      totalConversions
      
      deliveryRate
      openRate
      clickRate
      conversionRate
      
      estimatedRevenue
      costPerAcquisition
      returnOnAdSpend
    }
    
    abVariants {
      name
      percentage
      conversionRate
    }
  }
}
```

### Get Revenue Forecast

```graphql
query {
  revenueForecasts(days: 30, limit: 10) {
    forecastDate
    days
    
    predictedValue
    lowerBound
    upperBound
    confidence
    
    drivers {
      name
      impact
      description
    }
    
    previousActualValue
    trend
  }
}
```

### Get Segments

```graphql
query {
  segments {
    id
    name
    lens
    size
    
    churnRisk
    conversionRate
    averageLifetimeValue
    
    recommendedChannels
  }
}
```

### Get Analytics

```graphql
query {
  analytics(period: "MONTH") {
    period
    
    totalRevenue
    revenueGrowth
    
    totalContacts
    newContactsAdded
    activeContacts
    churnedContacts
    
    campaignsRunning
    averageConversionRate
    averageCPA
    
    segmentDistribution {
      segment
      count
      conversionRate
      averageLifetimeValue
    }
    
    highRiskContacts
    criticalRiskContacts
  }
}
```

## Mutation Examples

### Create Campaign

```graphql
mutation {
  createCampaign(
    input: {
      name: "Q2 Summer Campaign"
      description: "Target high-risk contacts"
      channels: [SMS, EMAIL]
      messageTemplate: "Limited time offer! Book now for 20% off..."
      targetSegments: [L6_TIMING_LOSS_AVERSION, L10_IMMEDIATE_CLOSING]
      targetLenses: [L6_TIME_SENSITIVE, L10_URGENT_BUYER]
      scheduledAt: "2026-06-01T09:00:00Z"
    }
  ) {
    id
    name
    status
    totalContacts
  }
}
```

**Response:**

```json
{
  "data": {
    "createCampaign": {
      "id": "cam456",
      "name": "Q2 Summer Campaign",
      "status": "DRAFT",
      "totalContacts": 2450
    }
  }
}
```

### Launch Campaign

```graphql
mutation {
  launchCampaign(id: "cam456") {
    id
    status
    startedAt
    metrics {
      totalSent
      deliveryRate
    }
  }
}
```

### Update Contact Risk

```graphql
mutation {
  updateContactRisk(
    contactId: "cl5k3j2x1"
    riskScore: 75
    riskLevel: HIGH
  ) {
    id
    riskScore
    riskLevel
  }
}
```

### Trigger Workflow

```graphql
mutation {
  triggerWorkflow(
    input: {
      contactId: "cl5k3j2x1"
      workflowId: "wf_grant_cardone_5_step"
      metadata: {
        reason: "high_risk_detected"
        priority: "urgent"
      }
    }
  ) {
    id
    status
    startedAt
    logs
  }
}
```

## Error Handling

GraphQL errors follow standard GraphQL error format:

```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

### Common Error Codes

| Code | HTTP | Meaning | Solution |
|------|------|---------|----------|
| `UNAUTHENTICATED` | 401 | Missing or invalid token | Include valid Authorization header |
| `FORBIDDEN` | 403 | Insufficient permissions | Request higher privilege level |
| `NOT_FOUND` | 404 | Resource doesn't exist | Verify ID is correct |
| `BAD_REQUEST` | 400 | Invalid input | Check query parameters |
| `INTERNAL_SERVER_ERROR` | 500 | Server error | Check server logs |

## Performance Best Practices

### 1. Use Pagination

Always paginate large result sets:

```graphql
query {
  contacts(limit: 50, offset: 0) {
    edges { node { id name } }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

### 2. Request Only Needed Fields

GraphQL allows you to request exactly what you need:

```graphql
# ✅ Good: Only request needed fields
query {
  contact(id: "123") {
    id
    name
    riskScore
  }
}

# ❌ Bad: Requesting all fields
query {
  contact(id: "123") {
    __typename
    ... all 30+ fields
  }
}
```

### 3. Batch Related Queries

DataLoaders automatically batch similar queries:

```graphql
# ✅ Good: Batched into single query
query {
  contact1: contact(id: "123") { id name }
  contact2: contact(id: "456") { id name }
  contact3: contact(id: "789") { id name }
}
```

### 4. Cache Results

Use HTTP caching headers (in queries with cache directive):

```graphql
query GetContacts @cached(ttl: 3600) {
  segments { id name size }
}
```

## Rate Limiting

Not yet implemented (Phase 2). Current limits:

- 1000 requests per minute per organization
- 10000 total GraphQL operations per day

## Monitoring

### Query Performance Logging

Queries taking >1000ms are automatically logged:

```
[GraphQL Performance] duration=1250ms operationName=GetContacts
```

Check logs in: `/var/log/graphql-performance.log`

### Health Check

```graphql
query {
  health
}
```

Returns `"OK"` if system is healthy.

## Client Libraries

### JavaScript/TypeScript

```typescript
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const client = new ApolloClient({
  link: new HttpLink({
    uri: 'http://localhost:3000/api/graphql',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  }),
  cache: new InMemoryCache(),
});

// Usage
const { data } = await client.query({
  query: gql`
    query {
      contacts(limit: 10) {
        edges { node { id name } }
      }
    }
  `
});
```

### React Hook

```typescript
import { useQuery, gql } from '@apollo/client';

const GET_CONTACTS = gql`
  query GetContacts($limit: Int!) {
    contacts(limit: $limit) {
      edges { node { id name email } }
    }
  }
`;

function ContactList() {
  const { loading, error, data } = useQuery(GET_CONTACTS, {
    variables: { limit: 50 }
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {data.contacts.edges.map(edge => (
        <li key={edge.node.id}>{edge.node.name}</li>
      ))}
    </ul>
  );
}
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "{ segments { id name size } }"
  }'
```

## Development

### Generate TypeScript Types

```bash
npm run graphql:codegen
```

This generates types matching your schema in `src/lib/graphql/generated/types.ts`

### Schema Introspection

Get full schema in JSON format:

```bash
npm run graphql:introspect > schema.json
```

### Testing Queries

```bash
npm run test:graphql
```

Runs all GraphQL integration tests.

## Roadmap (Phase 2)

- [ ] Real-time subscriptions (WebSocket)
- [ ] Query complexity analysis (prevent expensive queries)
- [ ] Rate limiting per user/organization
- [ ] API key authentication (in addition to session)
- [ ] Batch mutations (load multiple contacts at once)
- [ ] Custom field filters and sorting
- [ ] Full-text search on all string fields
- [ ] Webhook subscriptions (alternative to WebSocket)

## Support

For issues or questions:

1. Check the [GraphQL spec](https://spec.graphql.org)
2. Review error logs in `/var/log/graphql.log`
3. Open an issue on GitHub

---

**Last Updated:** 2026-05-27  
**API Version:** 1.0.0
