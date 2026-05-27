# GraphQL API - Quick Start Guide

Get the mabiz GraphQL API running in 5 minutes.

## Installation

### 1. Install Dependencies

Most dependencies are already in `package.json`. Install any missing ones:

```bash
npm install @apollo/server @as-integrations/next graphql-tag
npm install --save-dev @graphql-codegen/cli @graphql-codegen/typescript
```

### 2. No Migration Needed

The GraphQL API works alongside existing REST endpoints. No breaking changes.

## Running the Server

### Development Mode

```bash
npm run dev
```

GraphQL Playground is available at:
```
http://localhost:3000/api/graphql
```

### Production Mode

```bash
npm run build
npm start
```

Introspection will be disabled (set `GRAPHQL_INTROSPECTION=false`).

## First Query

### Using GraphQL Playground

1. Open http://localhost:3000/api/graphql
2. Paste this query:

```graphql
query {
  health
}
```

3. Click the play button
4. Should return: `"OK"`

### Using cURL

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health }"}'
```

## Get Contacts

### Simplest Query

```graphql
query {
  contacts(limit: 10) {
    edges {
      node {
        id
        name
        email
        riskScore
      }
    }
    totalCount
  }
}
```

### With Filtering

```graphql
query {
  contacts(
    filter: {
      riskLevel: HIGH
      segment: L6_TIMING_LOSS_AVERSION
    }
    limit: 50
    orderBy: "riskScore"
    orderDirection: "DESC"
  ) {
    edges {
      node {
        id
        name
        email
        riskScore
        lens
        lastContactedAt
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

## Create Campaign

### Mutation

```graphql
mutation {
  createCampaign(input: {
    name: "Q2 Summer Campaign"
    channels: [SMS, EMAIL]
    messageTemplate: "Limited time offer!"
    targetSegments: [L6_TIMING_LOSS_AVERSION]
    targetLenses: [L6_TIME_SENSITIVE]
  }) {
    id
    name
    status
    totalContacts
  }
}
```

Expected response:

```json
{
  "data": {
    "createCampaign": {
      "id": "cam_abc123",
      "name": "Q2 Summer Campaign",
      "status": "DRAFT",
      "totalContacts": 245
    }
  }
}
```

## Get Analytics

```graphql
query {
  analytics(period: "MONTH") {
    totalRevenue
    totalContacts
    activeContacts
    campaignsRunning
    averageConversionRate
    averageCPA
    
    segmentDistribution {
      segment
      count
      conversionRate
    }
  }
}
```

## Get Forecasts

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
  }
}
```

## TypeScript Support

### Generate Types

```bash
npm run graphql:codegen
```

This generates TypeScript types matching your schema in:
```
src/lib/graphql/generated/types.ts
```

### Use in React

```typescript
import { useQuery } from '@apollo/client';
import { GetContactsQuery, GetContactsQueryVariables } from '@/lib/graphql/generated/types';

const GET_CONTACTS = gql`
  query GetContacts($limit: Int!) {
    contacts(limit: $limit) {
      edges { node { id name email } }
    }
  }
`;

function ContactList() {
  const { data, loading } = useQuery<GetContactsQuery, GetContactsQueryVariables>(
    GET_CONTACTS,
    { variables: { limit: 50 } }
  );

  // TypeScript now knows the shape of data!
  return <div>{data?.contacts?.totalCount} contacts</div>;
}
```

## Common Queries

### Get Single Contact

```graphql
query {
  contact(id: "contact123") {
    id
    name
    email
    phone
    riskScore
    lens
    segment_data { name }
    campaigns { id name }
  }
}
```

### Get At-Risk Contacts

```graphql
query {
  atRiskContacts(riskLevel: CRITICAL, limit: 20) {
    id
    name
    riskScore
    lastContactedAt
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
      deliveryRate
      openRate
      clickRate
      conversionRate
      estimatedRevenue
      costPerAcquisition
      returnOnAdSpend
    }
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
    recommendedChannels
  }
}
```

## Common Mutations

### Update Campaign Status

```graphql
mutation {
  launchCampaign(id: "cam123") {
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
    contactId: "contact123"
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
      contactId: "contact123"
      workflowId: "wf_grant_cardone_5_step"
    }
  ) {
    id
    status
    startedAt
    logs
  }
}
```

## Testing

### Run All Tests

```bash
npm test -- graphql.test.ts
```

### Test Specific Feature

```bash
npm test -- graphql.test.ts -t "Query Resolvers"
npm test -- graphql.test.ts -t "PII Masking"
npm test -- graphql.test.ts -t "Performance"
```

### Coverage Report

```bash
npm test -- graphql.test.ts --coverage
```

## Performance Tips

### 1. Use Pagination

Always paginate large queries:

```graphql
# ✅ Good
query {
  contacts(limit: 50, offset: 0) {
    edges { node { id name } }
    pageInfo { hasNextPage }
  }
}

# ❌ Bad (might timeout)
query {
  contacts(limit: 10000) {
    edges { node { id name } }
  }
}
```

### 2. Request Only Needed Fields

```graphql
# ✅ Good (smaller response)
query {
  contacts(limit: 50) {
    edges { node { id name } }
  }
}

# ❌ Bad (larger response)
query {
  contacts(limit: 50) {
    edges { 
      node {
        id name email phone segment lens riskScore
        leadScore departureDate budgetRange
        lastContactedAt optOutAt
        # ... 20+ more fields
      }
    }
  }
}
```

### 3. Batch Related Queries

```graphql
# ✅ Good (batched into 1 call to each resolver)
query {
  contact1: contact(id: "123") { id name }
  contact2: contact(id: "456") { id name }
  contact3: contact(id: "789") { id name }
}
```

## Troubleshooting

### Query Returns 401 Unauthorized

**Problem:** You're not authenticated.

**Solution:** Make sure you're logged in and have a valid session.

```bash
# Check if you have session token
echo $SESSION_TOKEN

# Add to request header
curl -H "Authorization: Bearer $SESSION_TOKEN" ...
```

### Query Returns 404 Not Found

**Problem:** Resource doesn't exist.

**Solution:** Check the ID is correct:

```graphql
query {
  contact(id: "wrong_id") {
    id
  }
}
```

### Query Is Slow (>1000ms)

**Problem:** Query is hitting database hard.

**Solution:**
1. Add pagination: `limit: 50, offset: 0`
2. Add filters: `filter: { riskLevel: HIGH }`
3. Request fewer fields
4. Check database indexes are created

### GraphQL Playground Not Loading

**Problem:** Playground not available in production.

**Solution:** Playground is only available in development mode (`npm run dev`).

For production, use:
- [Apollo Sandbox](https://sandbox.apollo.dev)
- [GraphiQL](https://graphiql-online.com)
- [Postman](https://www.postman.com)

## Next Steps

1. **Read Full Documentation:** [GRAPHQL_API.md](./GRAPHQL_API.md)
2. **Review Implementation:** [GRAPHQL_IMPLEMENTATION_SUMMARY.md](./GRAPHQL_IMPLEMENTATION_SUMMARY.md)
3. **Integrate with UI:** Update React components to use GraphQL
4. **Set Up Monitoring:** Track query performance and errors
5. **Phase 2:** Enable subscriptions for real-time updates

## More Help

- **Errors?** Check query syntax in Playground
- **Performance?** Use DevTools to measure latency
- **Types?** Run `npm run graphql:codegen`
- **Examples?** See [client-examples.ts](../src/lib/graphql/client-examples.ts)

---

**Happy querying! 🚀**
