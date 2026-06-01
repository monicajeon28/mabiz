/**
 * GraphQL Client Examples
 *
 * Ready-to-use examples for integrating the GraphQL API into:
 * - React components (useQuery, useMutation, useSubscription)
 * - JavaScript/Node.js
 * - cURL commands
 *
 * Usage:
 * 1. Copy-paste into your component
 * 2. Update endpoint URL if needed
 * 3. Add authorization token
 */

// ═════════════════════════════════════════════════════════════
// REACT EXAMPLES
// ═════════════════════════════════════════════════════════════

/**
 * Example 1: React Hook - Get Contacts List
 *
 * Usage:
 * function MyComponent() {
 *   const { data, loading, error } = useGetContacts({ limit: 50 });
 *   // Use data, loading, error
 * }
 */
export const REACT_GET_CONTACTS = `
import { useQuery, gql } from '@apollo/client';

const GET_CONTACTS = gql\`
  query GetContacts($limit: Int!, $offset: Int!) {
    contacts(limit: $limit, offset: $offset) {
      edges {
        node {
          id
          name
          email
          phone
          segment
          lens
          riskScore
          riskLevel
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
\`;

function ContactsList() {
  const [page, setPage] = React.useState(0);
  const { loading, error, data, fetchMore } = useQuery(GET_CONTACTS, {
    variables: { limit: 50, offset: 0 }
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Risk Level</th>
            <th>Lens</th>
          </tr>
        </thead>
        <tbody>
          {data.contacts.edges.map(edge => (
            <tr key={edge.node.id}>
              <td>{edge.node.name}</td>
              <td>{edge.node.email}</td>
              <td>{edge.node.riskLevel}</td>
              <td>{edge.node.lens}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <button
          onClick={() => setPage(page - 1)}
          disabled={!data.contacts.pageInfo.hasPreviousPage}
        >
          Previous
        </button>
        <button
          onClick={() => setPage(page + 1)}
          disabled={!data.contacts.pageInfo.hasNextPage}
        >
          Next
        </button>
      </div>
    </div>
  );
}
`;

/**
 * Example 2: React Hook - Create Campaign Mutation
 *
 * Usage:
 * function CampaignForm() {
 *   const [createCampaign] = useCreateCampaign();
 *   const handleSubmit = (data) => createCampaign({ variables: { input: data } });
 * }
 */
export const REACT_CREATE_CAMPAIGN = `
import { useMutation, gql } from '@apollo/client';

const CREATE_CAMPAIGN = gql\`
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) {
      id
      name
      status
      totalContacts
    }
  }
\`;

function CampaignForm() {
  const [createCampaign, { loading, error }] = useMutation(CREATE_CAMPAIGN, {
    onCompleted: (data) => {
      console.log('Campaign created:', data.createCampaign.id);
    },
    onError: (error) => {
      console.error('Error creating campaign:', error);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    await createCampaign({
      variables: {
        input: {
          name: 'Q2 Summer Campaign',
          description: 'Target high-risk contacts',
          channels: ['SMS', 'EMAIL'],
          messageTemplate: 'Limited time offer!',
          targetSegments: ['L6_TIMING_LOSS_AVERSION'],
          targetLenses: ['L6_TIME_SENSITIVE'],
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Campaign'}
      </button>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
    </form>
  );
}
`;

/**
 * Example 3: React Hook - Get Analytics
 */
export const REACT_GET_ANALYTICS = `
import { useQuery, gql } from '@apollo/client';

const GET_ANALYTICS = gql\`
  query GetAnalytics($period: String!) {
    analytics(period: $period) {
      period
      totalRevenue
      revenueGrowth
      totalContacts
      newContactsAdded
      activeContacts
      campaignsRunning
      averageConversionRate
      averageCPA
      segmentDistribution {
        segment
        count
        conversionRate
        averageLifetimeValue
      }
    }
  }
\`;

function AnalyticsDashboard() {
  const { data: analyticsData, loading } = useQuery(GET_ANALYTICS, {
    variables: { period: 'MONTH' }
  });

  if (loading) return <p>Loading analytics...</p>;

  const analyticsValues = analyticsData?.analytics;

  return (
    <div>
      <h2>Monthly Analytics</h2>
      <div className="kpi-grid">
        <div className="kpi">
          <label>Total Revenue</label>
          <value>\\$\${(analyticsValues?.totalRevenue / 1000).toFixed(1)}K</value>
        </div>
        <div className="kpi">
          <label>Active Contacts</label>
          <value>{analyticsValues?.activeContacts}</value>
        </div>
        <div className="kpi">
          <label>Conversion Rate</label>
          <value>{analyticsValues?.averageConversionRate.toFixed(1)}%</value>
        </div>
        <div className="kpi">
          <label>CPA</label>
          <value>\\$\${analyticsValues?.averageCPA.toFixed(0)}</value>
        </div>
      </div>

      <h3>Segment Distribution</h3>
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Count</th>
            <th>Conv Rate</th>
            <th>Avg LTV</th>
          </tr>
        </thead>
        <tbody>
          {analyticsValues?.segmentDistribution.map((seg: any) => (
            <tr key={seg.segment}>
              <td>{seg.segment}</td>
              <td>{seg.count}</td>
              <td>{(seg.conversionRate * 100).toFixed(1)}%</td>
              <td>\\$\${seg.averageLifetimeValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;

/**
 * Example 4: React Hook - Get Forecasts
 */
export const REACT_GET_FORECASTS = `
import { useQuery, gql } from '@apollo/client';

const GET_FORECASTS = gql\`
  query GetForecasts($days: Int!) {
    revenueForecasts(days: $days, limit: 10) {
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
\`;

function ForecastChart() {
  const { data: forecastData, loading } = useQuery(GET_FORECASTS, {
    variables: { days: 30 }
  });

  if (loading) return <p>Loading forecast...</p>;

  const forecasts = forecastData?.revenueForecasts || [];

  return (
    <div>
      <h2>30-Day Revenue Forecast</h2>
      <div style={{ height: 400 }}>
        {/* Use Recharts or Chart.js to visualize */}
        {forecasts.map((forecastItem: any) => (
          <div key={forecastItem.days}>
            Day {forecastItem.days}: \\$\${forecastItem.predictedValue.toLocaleString()}
            (\\$\${forecastItem.lowerBound} - \\$\${forecastItem.upperBound})
          </div>
        ))}
      </div>

      {forecasts[0] && (
        <div>
          <h3>Key Drivers</h3>
          <ul>
            {forecasts[0].drivers.map((driver: any) => (
              <li key={driver.name}>
                {driver.name}: {driver.impact > 0 ? '+' : ''}{driver.impact.toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
`;

// ═════════════════════════════════════════════════════════════
// JAVASCRIPT/NODE.JS EXAMPLES
// ═════════════════════════════════════════════════════════════

/**
 * Example 5: JavaScript - Fetch with Promise
 */
export const JS_FETCH_EXAMPLE = `
async function getContacts() {
  const query = \`
    query GetContacts($limit: Int!) {
      contacts(limit: $limit) {
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
  \`;

  const response = await fetch('http://localhost:3000/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer YOUR_SESSION_TOKEN\`
    },
    body: JSON.stringify({
      query,
      variables: { limit: 50 }
    })
  });

  const { data, errors } = await response.json();

  if (errors) {
    console.error('GraphQL Errors:', errors);
    return null;
  }

  return data.contacts;
}

// Usage
getContacts().then(contacts => {
  console.log('Total contacts:', contacts.totalCount);
  contacts.edges.forEach(edge => {
    console.log(\`\${edge.node.name}: Risk \${edge.node.riskScore}%\`);
  });
});
`;

/**
 * Example 6: JavaScript - Mutation
 */
export const JS_MUTATION_EXAMPLE = `
async function createCampaign(input) {
  const mutation = \`
    mutation CreateCampaign($input: CreateCampaignInput!) {
      createCampaign(input: $input) {
        id
        name
        status
        totalContacts
      }
    }
  \`;

  const response = await fetch('http://localhost:3000/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer YOUR_SESSION_TOKEN\`
    },
    body: JSON.stringify({
      query: mutation,
      variables: { input }
    })
  });

  const { data, errors } = await response.json();

  if (errors) {
    throw new Error(errors[0].message);
  }

  return data.createCampaign;
}

// Usage
createCampaign({
  name: 'Q2 Campaign',
  channels: ['SMS', 'EMAIL'],
  messageTemplate: 'Limited offer!',
  targetSegments: ['L6_TIMING_LOSS_AVERSION'],
  targetLenses: ['L6_TIME_SENSITIVE']
}).then(campaign => {
  console.log('Created campaign:', campaign.id);
}).catch(error => {
  console.error('Error:', error.message);
});
`;

// ═════════════════════════════════════════════════════════════
// CURL EXAMPLES
// ═════════════════════════════════════════════════════════════

/**
 * Example 7: cURL - Get Contacts
 */
export const CURL_GET_CONTACTS = `
curl -X POST http://localhost:3000/api/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \\
  -d '{
    "query": "{ contacts(limit: 10) { edges { node { id name email } } } }"
  }'
`;

/**
 * Example 8: cURL - Create Campaign
 */
export const CURL_CREATE_CAMPAIGN = `
curl -X POST http://localhost:3000/api/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \\
  -d '{
    "query": "mutation { createCampaign(input: { name: \\"Q2 Campaign\\", channels: [SMS], messageTemplate: \\"Hi!\\"}) { id name } }"
  }'
`;

/**
 * Example 9: cURL - Get Analytics
 */
export const CURL_GET_ANALYTICS = `
curl -X POST http://localhost:3000/api/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \\
  -d '{
    "query": "{ analytics(period: \\"MONTH\\") { totalRevenue totalContacts averageConversionRate } }"
  }'
`;

/**
 * Example 10: cURL - Get Forecasts
 */
export const CURL_GET_FORECASTS = `
curl -X POST http://localhost:3000/api/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \\
  -d '{
    "query": "{ revenueForecasts(days: 30) { forecastDate predictedValue confidence } }"
  }'
`;

// ═════════════════════════════════════════════════════════════
// EXPORT ALL EXAMPLES
// ═════════════════════════════════════════════════════════════

export const ALL_EXAMPLES = {
  react: {
    getContacts: REACT_GET_CONTACTS,
    createCampaign: REACT_CREATE_CAMPAIGN,
    getAnalytics: REACT_GET_ANALYTICS,
    getForecasts: REACT_GET_FORECASTS,
  },
  javascript: {
    fetch: JS_FETCH_EXAMPLE,
    mutation: JS_MUTATION_EXAMPLE,
  },
  curl: {
    getContacts: CURL_GET_CONTACTS,
    createCampaign: CURL_CREATE_CAMPAIGN,
    getAnalytics: CURL_GET_ANALYTICS,
    getForecasts: CURL_GET_FORECASTS,
  },
};

/**
 * Print example by category and name
 *
 * Usage:
 * printExample('react', 'getContacts');
 */
export function printExample(category: string, name: string) {
  const example = (ALL_EXAMPLES as any)[category]?.[name];

  if (!example) {
    console.error(
      `Example not found: ${category}.${name}`
    );
    return;
  }

  console.log(example);
}
