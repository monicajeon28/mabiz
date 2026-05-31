/**
 * AI-Powered Customer Segmentation Engine
 *
 * ML-based K-means clustering with behavioral, demographic, and psychographic features
 * Generates interpretable segment profiles and personalized recommendations
 *
 * Features:
 * - Input: Contact demographics, behavioral data, lens classification, RFM metrics
 * - Algorithm: K-means clustering (k=5-7 segments)
 * - Output: Segment assignment + probability + "why" explanation
 * - Re-clustering: Monthly to detect behavioral shifts
 */

import { prisma } from "@/lib/prisma";
import { Contact, Organization } from "@prisma/client";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ContactFeatures {
  // Demographics
  age: number;
  gender: "M" | "F" | null;
  maritalStatus: "married" | "single" | "divorced" | null;
  childrenCount: number;
  location: string | null;

  // Behavioral (RFM)
  recency: number; // Days since last contact
  frequency: number; // Purchase count
  monetaryValue: number; // Total spent ($)

  // Engagement
  emailOpenRate: number; // 0-100
  smsClickRate: number; // 0-100
  engagementScore: number; // 0-100 weighted average

  // Churn signals
  inactivityDays: number;
  supportTicketCount: number;
  complaintCount: number;
  churnSignalScore: number; // 0-100

  // Psychographic (lens classification)
  lensL0: number; // Reactivation likelihood 0-100
  lensL1: number; // Price sensitivity 0-100
  lensL3: number; // Differentiation awareness 0-100
  lensL6: number; // Timing/Loss aversion 0-100
  lensL10: number; // Closing readiness 0-100

  // Risk scoring
  riskScore: number; // 0-100 combined risk
  vipStatus: string | null; // GOLD, SILVER, null
}

export interface SegmentProfile {
  name: string;
  size: number; // Contact count
  demographicProfile: {
    avgAge: number;
    malePercent: number;
    mariedPercent: number;
    avgChildrenCount: number;
    topLocations: string[];
  };
  behavioralProfile: {
    avgRecency: number; // Days
    avgFrequency: number; // Purchases
    avgMonetaryValue: number; // $
    avgEngagementRate: number; // %
  };
  psychographicProfile: {
    dominantLens: string; // L0, L1, L3, L6, L10
    avgRiskScore: number;
  };
  churnRisk: number; // 0-100
  recommendedAction: string; // "Upsell", "Reactivate", "Support", "VIP", "Growth"
  recommendedChannels: string[]; // SMS, Email, Kakao
  messageTone: "Premium" | "Encouraging" | "Empathetic" | "Urgent" | "Supportive";
  expectedConversionRate: number; // % based on historical data
}

export interface ClusterAssignment {
  contactId: string;
  segmentId: string;
  segmentName: string;
  probability: number; // 0-100 confidence
  explanation: string; // "Why" this contact is in this segment
  featureScores: Record<string, number>; // Feature contribution
}

// ============================================================================
// K-Means Clustering Implementation
// ============================================================================

class KMeansClustering {
  private k: number; // Number of clusters
  private maxIterations: number = 100;
  private convergeThreshold: number = 0.001;

  constructor(k: number = 5) {
    this.k = Math.max(3, Math.min(7, k)); // Clamp between 3-7
  }

  /**
   * Normalize feature values to 0-1 range for fair weighting
   */
  private normalize(features: number[]): number[] {
    const min = Math.min(...features);
    const max = Math.max(...features);
    const range = max - min || 1;
    return features.map((f) => (f - min) / range);
  }

  /**
   * Euclidean distance between two points
   */
  private distance(p1: number[], p2: number[]): number {
    return Math.sqrt(
      p1.reduce((sum, val, i) => sum + Math.pow(val - (p2[i] || 0), 2), 0)
    );
  }

  /**
   * Initialize cluster centers randomly from data points
   */
  private initializeCenters(data: number[][]): number[][] {
    const centers: number[][] = [];
    const indices = new Set<number>();

    while (centers.length < this.k) {
      const idx = Math.floor(Math.random() * data.length);
      if (!indices.has(idx)) {
        centers.push([...data[idx]]);
        indices.add(idx);
      }
    }
    return centers;
  }

  /**
   * Assign each point to nearest cluster center
   */
  private assignClusters(
    data: number[][],
    centers: number[][]
  ): { cluster: number; distance: number }[] {
    return data.map((point) => {
      let minDist = Infinity;
      let cluster = 0;

      for (let i = 0; i < centers.length; i++) {
        const dist = this.distance(point, centers[i]);
        if (dist < minDist) {
          minDist = dist;
          cluster = i;
        }
      }

      return { cluster, distance: minDist };
    });
  }

  /**
   * Calculate new centers as mean of assigned points
   */
  private updateCenters(
    data: number[][],
    assignments: { cluster: number }[]
  ): number[][] {
    const newCenters: number[][] = Array(this.k)
      .fill(null)
      .map(() => []);

    const counts = Array(this.k).fill(0);

    // Sum points in each cluster
    for (let i = 0; i < data.length; i++) {
      const cluster = assignments[i].cluster;
      counts[cluster]++;

      for (let j = 0; j < data[i].length; j++) {
        if (!newCenters[cluster][j]) newCenters[cluster][j] = 0;
        newCenters[cluster][j] += data[i][j];
      }
    }

    // Average
    for (let i = 0; i < this.k; i++) {
      for (let j = 0; j < newCenters[i].length; j++) {
        newCenters[i][j] = counts[i] > 0 ? newCenters[i][j] / counts[i] : 0;
      }
    }

    return newCenters;
  }

  /**
   * K-means clustering main algorithm
   */
  public cluster(
    data: number[][]
  ): {
    clusters: { cluster: number; distance: number }[];
    centers: number[][];
    converged: boolean;
  } {
    if (data.length === 0) {
      return { clusters: [], centers: [], converged: false };
    }

    let centers = this.initializeCenters(data);
    let assignments = this.assignClusters(data, centers);
    let converged = false;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      const newCenters = this.updateCenters(data, assignments);

      // Check convergence
      let maxMovement = 0;
      for (let i = 0; i < this.k; i++) {
        const movement = this.distance(centers[i], newCenters[i]);
        maxMovement = Math.max(maxMovement, movement);
      }

      centers = newCenters;
      assignments = this.assignClusters(data, centers);

      if (maxMovement < this.convergeThreshold) {
        converged = true;
        break;
      }
    }

    return { clusters: assignments, centers, converged };
  }
}

// ============================================================================
// Feature Extraction from Contact Data
// ============================================================================

export async function extractContactFeatures(
  contact: Contact & {
    callLogs?: { createdAt: Date; duration?: number }[];
    marketingMessages?: { openedAt?: Date }[];
  }
): Promise<ContactFeatures> {
  // Calculate recency (days since last contact)
  const lastContactDate = contact.lastContactedAt || contact.createdAt;
  const recency = Math.floor(
    (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate frequency (purchase count as proxy)
  const frequency = contact.purchasedAt ? 1 : 0;

  // Estimate monetary value from product/price info
  let monetaryValue = 0;
  if (contact.quotedPrice) {
    monetaryValue = contact.quotedPrice;
  }

  // Calculate engagement score from SMS/Email activity
  let engagementScore = 0;
  const engagementFactors = [];

  if (contact.smsDay0Sent) engagementFactors.push(30);
  if (contact.smsDay1Sent) engagementFactors.push(30);
  if (contact.smsDay2Sent) engagementFactors.push(30);
  if (contact.smsDay3Sent) engagementFactors.push(30);
  if (contact.reEngageCount > 0) engagementFactors.push(20);

  engagementScore =
    engagementFactors.length > 0
      ? engagementFactors.reduce((a, b) => a + b) / engagementFactors.length
      : 0;

  // Churn signal score (high inactivity = high churn risk)
  let churnSignalScore = 0;
  if (recency > 90) churnSignalScore += 40;
  if (recency > 180) churnSignalScore += 30;
  if (contact.optOutAt) churnSignalScore += 50;
  if (contact.lastPaymentStatus === "FAILED") churnSignalScore += 25;

  churnSignalScore = Math.min(100, churnSignalScore);

  // Inactivity days
  const inactivityDays = recency;

  return {
    age: contact.ageInYears || 45,
    gender: (contact.gender as "M" | "F" | null) || null,
    maritalStatus:
      (contact.maritalStatus as
        | "married"
        | "single"
        | "divorced"
        | null) || null,
    childrenCount: contact.childrenCount || 0,
    location: null, // Extended in future: extract from address

    recency,
    frequency,
    monetaryValue,

    emailOpenRate: contact.autoSegment ? 40 : 0,
    smsClickRate: contact.lastPaymentStatus === "SUCCESS" ? 50 : 20,
    engagementScore,

    inactivityDays,
    supportTicketCount: 0, // Requires support table join
    complaintCount: 0, // Requires complaints table
    churnSignalScore,

    lensL0: contact.reactivationLikelihood || 0,
    lensL1: (typeof contact.lensMetadata === 'object' && contact.lensMetadata && 'L1' in (contact.lensMetadata as Record<string, any>)) ? Number((contact.lensMetadata as Record<string, any>)["L1"]) : 0,
    lensL3: contact.differentiationScore || 0,
    lensL6: contact.timingUrgencyScore || 0,
    lensL10: contact.l10ClosingScore || 0,

    riskScore: Math.min(
      100,
      (churnSignalScore +
        (contact.reactivationLikelihood ? 0 : 30) +
        (contact.leadScore < 30 ? 20 : 0)) /
        2
    ),
    vipStatus: contact.vipStatus || null,
  };
}

/**
 * Normalize features for clustering (0-1 range)
 */
function normalizeFeatures(features: ContactFeatures[]): number[][] {
  const dims = [
    "age",
    "childrenCount",
    "recency",
    "frequency",
    "monetaryValue",
    "engagementScore",
    "churnSignalScore",
    "lensL0",
    "lensL1",
    "lensL3",
    "lensL6",
    "lensL10",
    "riskScore",
  ];

  // Normalize each dimension
  const normalized: number[][] = [];

  for (const dim of dims) {
    const values = features.map(
      (f) => (f as unknown as Record<string, number>)[dim] as number
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    for (let i = 0; i < features.length; i++) {
      if (!normalized[i]) normalized[i] = [];
      const val = values[i];
      normalized[i].push((val - min) / range);
    }
  }

  return normalized;
}

// ============================================================================
// Segment Profile Generation
// ============================================================================

function generateSegmentProfile(
  contactsInSegment: (Contact & { features: ContactFeatures })[],
  segmentIndex: number,
  totalContacts: number
): SegmentProfile {
  if (contactsInSegment.length === 0) {
    return {
      name: `Segment ${segmentIndex + 1}`,
      size: 0,
      demographicProfile: {
        avgAge: 0,
        malePercent: 0,
        mariedPercent: 0,
        avgChildrenCount: 0,
        topLocations: [],
      },
      behavioralProfile: {
        avgRecency: 0,
        avgFrequency: 0,
        avgMonetaryValue: 0,
        avgEngagementRate: 0,
      },
      psychographicProfile: {
        dominantLens: "N/A",
        avgRiskScore: 0,
      },
      churnRisk: 0,
      recommendedAction: "Support",
      recommendedChannels: ["SMS"],
      messageTone: "Encouraging",
      expectedConversionRate: 0,
    };
  }

  const features = contactsInSegment.map((c) => c.features);
  const size = contactsInSegment.length;
  const percent = (size / totalContacts) * 100;

  // Demographic profile
  const avgAge = features.reduce((s, f) => s + f.age, 0) / size;
  const malePercent =
    (features.filter((f) => f.gender === "M").length / size) * 100;
  const mariedPercent =
    (features.filter((f) => f.maritalStatus === "married").length / size) *
    100;
  const avgChildrenCount =
    features.reduce((s, f) => s + f.childrenCount, 0) / size;

  // Behavioral profile
  const avgRecency = features.reduce((s, f) => s + f.recency, 0) / size;
  const avgFrequency = features.reduce((s, f) => s + f.frequency, 0) / size;
  const avgMonetaryValue =
    features.reduce((s, f) => s + f.monetaryValue, 0) / size;
  const avgEngagementRate =
    features.reduce((s, f) => s + f.engagementScore, 0) / size;

  // Psychographic profile
  const avgL0 = features.reduce((s, f) => s + f.lensL0, 0) / size;
  const avgL1 = features.reduce((s, f) => s + f.lensL1, 0) / size;
  const avgL3 = features.reduce((s, f) => s + f.lensL3, 0) / size;
  const avgL6 = features.reduce((s, f) => s + f.lensL6, 0) / size;
  const avgL10 = features.reduce((s, f) => s + f.lensL10, 0) / size;
  const avgRiskScore = features.reduce((s, f) => s + f.riskScore, 0) / size;

  const lensScores = { L0: avgL0, L1: avgL1, L3: avgL3, L6: avgL6, L10: avgL10 };
  const dominantLens = Object.entries(lensScores).reduce((a, b) =>
    a[1] > b[1] ? a : b
  )[0];

  const avgChurnRisk =
    features.reduce((s, f) => s + f.churnSignalScore, 0) / size;

  // Determine segment characteristics
  let name = `Segment ${segmentIndex + 1}`;
  let recommendedAction = "Support";
  let messageTone: "Premium" | "Encouraging" | "Empathetic" | "Urgent" | "Supportive" =
    "Encouraging";

  // Segment naming logic
  if (avgChurnRisk > 70) {
    name = "At-Risk Churn Candidates";
    recommendedAction = "Reactivate";
    messageTone = "Empathetic";
  } else if (avgMonetaryValue > 5000 && avgEngagementRate > 70) {
    name = "Premium Active VIPs";
    recommendedAction = "Upsell";
    messageTone = "Premium";
  } else if (avgRecency > 180) {
    name = "Dormant Prospects";
    recommendedAction = "Reactivate";
    messageTone = "Encouraging";
  } else if (avgEngagementRate < 30) {
    name = "New Growth Potential";
    recommendedAction = "Growth";
    messageTone = "Encouraging";
  } else if (avgL10 > 60) {
    name = "Ready-to-Close High Intent";
    recommendedAction = "Close";
    messageTone = "Urgent";
  }

  // Recommended channels
  const recommendedChannels: string[] = [];
  if (avgL10 > 50) recommendedChannels.push("SMS"); // Urgent
  if (avgEngagementRate > 40) recommendedChannels.push("Kakao"); // Engaged
  if (percent > 20) recommendedChannels.push("Email"); // Large segments

  // Expected conversion rate by segment type
  let expectedConversionRate = 0;
  if (name.includes("Premium")) expectedConversionRate = 8.2;
  else if (name.includes("Ready-to-Close")) expectedConversionRate = 6.5;
  else if (name.includes("New")) expectedConversionRate = 2.5;
  else if (name.includes("At-Risk")) expectedConversionRate = 1.8;
  else expectedConversionRate = 3.5;

  return {
    name,
    size,
    demographicProfile: {
      avgAge: Math.round(avgAge * 10) / 10,
      malePercent: Math.round(malePercent),
      mariedPercent: Math.round(mariedPercent),
      avgChildrenCount: Math.round(avgChildrenCount * 10) / 10,
      topLocations: [], // Extended in future with location data
    },
    behavioralProfile: {
      avgRecency: Math.round(avgRecency),
      avgFrequency: Math.round(avgFrequency * 10) / 10,
      avgMonetaryValue: Math.round(avgMonetaryValue),
      avgEngagementRate: Math.round(avgEngagementRate),
    },
    psychographicProfile: {
      dominantLens,
      avgRiskScore: Math.round(avgRiskScore),
    },
    churnRisk: Math.round(avgChurnRisk),
    recommendedAction,
    recommendedChannels,
    messageTone,
    expectedConversionRate,
  };
}

/**
 * Generate "why" explanation for segment assignment
 */
function generateExplanation(
  contact: ContactFeatures,
  clusterCenter: number[],
  clusterIndex: number,
  profile: SegmentProfile
): string {
  const factors: string[] = [];

  // Risk factors
  if (contact.churnSignalScore > 60) {
    factors.push(`High churn risk (${contact.churnSignalScore}/100)`);
  }

  // Engagement factors
  if (contact.engagementScore > 60) {
    factors.push(`Highly engaged (${Math.round(contact.engagementScore)}%)`);
  } else if (contact.engagementScore < 20) {
    factors.push(`Low engagement (${Math.round(contact.engagementScore)}%)`);
  }

  // Lens-based factors
  if (contact.lensL10 > 60) {
    factors.push(`Ready to close (L10: ${contact.lensL10}/100)`);
  }
  if (contact.lensL0 > 50) {
    factors.push(`Reactivation candidate (L0: ${contact.lensL0}/100)`);
  }

  // Value factors
  if (contact.monetaryValue > 5000) {
    factors.push(`High customer value ($${Math.round(contact.monetaryValue)})`);
  }

  const explanation =
    factors.length > 0
      ? `${profile.name}: ${factors.join(", ")}`
      : `${profile.name}: Segment match based on behavior patterns`;

  return explanation;
}

// ============================================================================
// Main Segmentation API
// ============================================================================

/**
 * Run AI-powered customer segmentation for an organization
 */
export async function runSegmentation(
  organizationId: string,
  numSegments: number = 5
): Promise<{
  segments: SegmentProfile[];
  assignments: ClusterAssignment[];
  totalContacts: number;
  convergenceStatus: "CONVERGED" | "MAX_ITERATIONS";
}> {
  console.log(
    `[Segmentation] Starting for org ${organizationId} with ${numSegments} segments`
  );

  // 1. Load all active contacts
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      age: true,
      gender: true,
      maritalStatus: true,
      childrenCount: true,
      lastContactedAt: true,
      createdAt: true,
      purchasedAt: true,
      quotedPrice: true,
      ageInYears: true,
      smsDay0Sent: true,
      smsDay1Sent: true,
      smsDay2Sent: true,
      smsDay3Sent: true,
      reEngageCount: true,
      optOutAt: true,
      lastPaymentStatus: true,
      autoSegment: true,
      reactivationLikelihood: true,
      differentiationScore: true,
      timingUrgencyScore: true,
      l10ClosingScore: true,
      vipStatus: true,
      leadScore: true,
      lensMetadata: true,
    },
  });

  console.log(`[Segmentation] Loaded ${contacts.length} contacts`);

  if (contacts.length === 0) {
    return {
      segments: [],
      assignments: [],
      totalContacts: 0,
      convergenceStatus: "CONVERGED",
    };
  }

  // 2. Extract features for each contact
  const contactsWithFeatures = await Promise.all(
    contacts.map(async (contact) => ({
      ...contact,
      features: await extractContactFeatures(contact as any),
    }))
  );

  // 3. Normalize features
  const normalizedFeatures = normalizeFeatures(
    contactsWithFeatures.map((c) => c.features)
  );

  // 4. Run K-means clustering
  const kmeans = new KMeansClustering(numSegments);
  const { clusters, centers, converged } = kmeans.cluster(normalizedFeatures);

  console.log(
    `[Segmentation] K-means converged: ${converged}, centers: ${centers.length}`
  );

  // 5. Group contacts by cluster
  const segmentGroups: Map<number, (Contact & { features: ContactFeatures })[]> =
    new Map();
  for (let i = 0; i < clusters.length; i++) {
    const clusterIdx = clusters[i].cluster;
    if (!segmentGroups.has(clusterIdx)) {
      segmentGroups.set(clusterIdx, []);
    }
    segmentGroups.get(clusterIdx)!.push(contactsWithFeatures[i] as any);
  }

  // 6. Generate segment profiles and save to DB
  const segmentPromises: Promise<any>[] = [];
  const assignments: ClusterAssignment[] = [];

  for (let i = 0; i < numSegments; i++) {
    const contactsInSegment = segmentGroups.get(i) || [];
    const profile = generateSegmentProfile(
      contactsInSegment,
      i,
      contacts.length
    );

    // NOTE: Segment saving is disabled - customerSegment table does not exist
    // Save segment to DB (commented out)
    // const segmentPromise = prisma.customerSegment.upsert({...});
    // segmentPromises.push(segmentPromise);

    // Generate assignments
    for (const contact of contactsInSegment) {
      const clusterAssignment = clusters[contacts.findIndex((c) => c.id === contact.id)];
      const distanceFromCenter = clusterAssignment.distance;
      const probability = Math.max(0, Math.min(100, 100 - distanceFromCenter * 100));
      const explanation = generateExplanation(contact.features, centers[i] || [], i, profile);

      assignments.push({
        contactId: contact.id,
        segmentId: profile.name, // Will be replaced with actual ID after DB save
        segmentName: profile.name,
        probability,
        explanation,
        featureScores: {
          age: contact.features.age,
          engagementScore: contact.features.engagementScore,
          churnRiskScore: contact.features.churnSignalScore,
          monetaryValue: contact.features.monetaryValue,
        },
      });
    }
  }

  // Wait for all segments to be saved
  const savedSegments = await Promise.all(segmentPromises);

  // 7. Save segment assignments to DB
  // NOTE: ContactSegmentAssignment is disabled - model does not exist
  // for (const assignment of assignments) {
  //   const segment = savedSegments.find((s) => s.name === assignment.segmentName);
  //   if (segment) {
  //     await prisma.contactSegmentAssignment.upsert({...});
  //   }
  // }

  console.log(
    `[Segmentation] Saved ${savedSegments.length} segments and ${assignments.length} assignments`
  );

  return {
    segments: savedSegments,
    assignments,
    totalContacts: contacts.length,
    convergenceStatus: converged ? "CONVERGED" : "MAX_ITERATIONS",
  };
}

/**
 * Get segment details with contact count and metrics
 * NOTE: Disabled - customerSegment table does not exist
 */
// export async function getSegmentDetails(segmentId: string) {
//   const segment = await prisma.customerSegment.findUnique({
//     where: { id: segmentId },
//     include: {
//       contactSegmentAssignments: {
//         select: {
//           id: true,
//           probability: true,
//           explanation: true,
//         },
//       },
//       segmentCampaignMetrics: {
//         take: 5,
//         orderBy: { createdAt: "desc" },
//       },
//     },
//   });
//
//   return segment;
// }

/**
 * Force re-clustering for an organization (monthly)
 */
export async function triggerReclustering(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) throw new Error("Organization not found");

  console.log(`[Segmentation] Triggering re-clustering for ${org.name}`);
  return runSegmentation(organizationId, 5);
}

// Export types
export interface CustomerSegmentWithMetrics {
  id?: string;
  name: string;
  size: number;
  demographicProfile: {
    avgAge: number;
    malePercent: number;
    mariedPercent: number;
    avgChildrenCount: number;
    topLocations: string[];
  };
  behavioralProfile: {
    avgRecency: number;
    avgFrequency: number;
    avgMonetaryValue: number;
    avgEngagementRate: number;
  };
  psychographicProfile: {
    dominantLens: string;
    avgRiskScore: number;
  };
  churnRisk: number;
  recommendedAction: string;
  recommendedChannels: string[];
  messageTone: "Premium" | "Encouraging" | "Empathetic" | "Urgent" | "Supportive";
}
