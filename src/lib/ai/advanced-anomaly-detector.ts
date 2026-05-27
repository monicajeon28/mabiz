/**
 * Advanced Anomaly Detection Module
 *
 * Multi-algorithm anomaly detection:
 * 1. Isolation Forest - detects unusual data patterns
 * 2. EWMA (Exponential Weighted Moving Average) - adaptive thresholds
 * 3. Mahalanobis Distance - multivariate outlier detection
 * 4. PELT (Pruned Exact Linear Time) - changepoint detection
 * 5. Z-score based detection - simple statistical outliers
 *
 * Real-time alerts on:
 * - Unusual transaction patterns
 * - Demand spikes/drops
 * - Revenue anomalies
 * - Partner activity changes
 * - Customer behavior shifts
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface AnomalyDataPoint {
  timestamp: Date;
  value: number;
  features?: {
    dayOfWeek: number;
    hour: number;
    isHoliday?: boolean;
    partnerCount?: number;
    activeMessages?: number;
  };
}

export interface DetectedAnomaly {
  timestamp: Date;
  value: number;
  expectedRange: { lower: number; upper: number };
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  algorithms: {
    isolationForest: { anomalous: boolean; score: number };
    ewma: { anomalous: boolean; zscore: number };
    mahalanobis: { anomalous: boolean; distance: number };
    zScore: { anomalous: boolean; zscore: number };
  };
  rootCause?: string;
  recommendation: string;
}

export interface ChangePoint {
  timestamp: Date;
  magnitude: number; // change magnitude
  direction: 'up' | 'down';
  confidence: number;
  explainedBy?: string;
}

export interface AnomalyDetectorConfig {
  sensitivity: number; // 0.5 (low) to 0.95 (high), default 0.85
  minDataPoints: number; // minimum historical data needed
  ewmaAlpha: number; // 0.2 default, higher = more responsive
  isolationTreeCount: number; // 100 default
  mahalanobisThreshold: number; // 2.5 default (Mahalanobis distance)
  zscoreThreshold: number; // 2.5 standard deviations
  changePointMinSize: number; // minimum segment size for PELT
}

/**
 * Isolation Forest - anomaly detection via random forests
 * Anomalies need fewer splits to isolate
 */
export class IsolationForest {
  private trees: IsolationTree[] = [];
  private sampleSize: number;

  constructor(dataPoints: number[], treeCount: number = 100, sampleSize: number = 256) {
    this.sampleSize = Math.min(sampleSize, dataPoints.length);

    for (let i = 0; i < treeCount; i++) {
      const samples = this.randomSample(dataPoints, this.sampleSize);
      this.trees.push(this.buildTree(samples, 0, dataPoints));
    }
  }

  private randomSample(data: number[], size: number): number[] {
    const sample: number[] = [];
    for (let i = 0; i < size; i++) {
      sample.push(data[Math.floor(Math.random() * data.length)]);
    }
    return sample;
  }

  private buildTree(
    data: number[],
    depth: number,
    allData: number[]
  ): IsolationTree {
    if (data.length <= 1 || depth >= Math.log2(this.sampleSize)) {
      return {
        isLeaf: true,
        size: data.length,
        threshold: data[0],
        attribute: 0,
        left: null,
        right: null,
      };
    }

    // Randomly select feature (for 1D, always feature 0)
    const min = Math.min(...data);
    const max = Math.max(...data);
    const threshold = min + Math.random() * (max - min);

    const left = data.filter((x) => x < threshold);
    const right = data.filter((x) => x >= threshold);

    // Ensure non-empty splits
    if (left.length === 0 || right.length === 0) {
      return {
        isLeaf: true,
        size: data.length,
        threshold,
        attribute: 0,
        left: null,
        right: null,
      };
    }

    return {
      isLeaf: false,
      size: data.length,
      threshold,
      attribute: 0,
      left: this.buildTree(left, depth + 1, allData),
      right: this.buildTree(right, depth + 1, allData),
    };
  }

  /**
   * Compute anomaly score for data point (0-1, higher = more anomalous)
   */
  anomalyScore(value: number): number {
    let sumPathLength = 0;

    for (const tree of this.trees) {
      sumPathLength += this.pathLength(value, tree, 0);
    }

    const avgPathLength = sumPathLength / this.trees.length;
    const c = 2 * Math.log(this.sampleSize - 1) + 2;
    return Math.pow(2, -(avgPathLength / c));
  }

  private pathLength(value: number, node: IsolationTree, depth: number): number {
    if (node.isLeaf) {
      return depth + Math.log(node.size || 1);
    }

    if (value < node.threshold) {
      return this.pathLength(value, node.left!, depth + 1);
    } else {
      return this.pathLength(value, node.right!, depth + 1);
    }
  }
}

interface IsolationTree {
  isLeaf: boolean;
  size: number;
  threshold: number;
  attribute: number;
  left: IsolationTree | null;
  right: IsolationTree | null;
}

/**
 * Advanced Anomaly Detector combining multiple algorithms
 */
export class AdvancedAnomalyDetector {
  private config: AnomalyDetectorConfig;
  private isolationForest?: IsolationForest;
  private ewmaState: { level: number; weights: number[] } = { level: 0, weights: [] };
  private historicalMean: number = 0;
  private historicalStd: number = 0;
  private historicalData: AnomalyDataPoint[] = [];
  private covariance: number[][] = [];

  constructor(config: Partial<AnomalyDetectorConfig> = {}) {
    this.config = {
      sensitivity: 0.85,
      minDataPoints: 30,
      ewmaAlpha: 0.2,
      isolationTreeCount: 100,
      mahalanobisThreshold: 2.5,
      zscoreThreshold: 2.5,
      changePointMinSize: 10,
      ...config,
    };
  }

  /**
   * Fit detector to historical data
   */
  fit(historicalData: AnomalyDataPoint[]): void {
    if (historicalData.length < this.config.minDataPoints) {
      throw new Error(
        `Need at least ${this.config.minDataPoints} data points, got ${historicalData.length}`
      );
    }

    this.historicalData = historicalData;
    const values = historicalData.map((d) => d.value);

    // Compute statistics
    this.historicalMean = values.reduce((a, b) => a + b, 0) / values.length;
    this.historicalStd = Math.sqrt(
      values.reduce((a, b) => a + Math.pow(b - this.historicalMean, 2), 0) / values.length
    );

    // Initialize Isolation Forest
    this.isolationForest = new IsolationForest(
      values,
      this.config.isolationTreeCount,
      Math.min(256, values.length)
    );

    // Initialize EWMA
    this.ewmaState.level = this.historicalMean;
    this.ewmaState.weights = values.map((_, i) =>
      Math.pow(1 - this.config.ewmaAlpha, i)
    );

    // Compute covariance matrix (for multivariate outliers)
    this.computeCovariance(historicalData);

    logger.info(
      `Anomaly detector fitted: mean=${this.historicalMean.toFixed(2)}, std=${this.historicalStd.toFixed(2)}`
    );
  }

  /**
   * Compute covariance matrix (simplified for 2D)
   */
  private computeCovariance(data: AnomalyDataPoint[]): void {
    if (!data[0].features) {
      this.covariance = [[this.historicalStd]];
      return;
    }

    // For demo: compute simple covariance
    const means = {
      value: data.reduce((s, d) => s + d.value, 0) / data.length,
      dayOfWeek: data.reduce((s, d) => s + (d.features?.dayOfWeek || 0), 0) / data.length,
    };

    const cov00 = data.reduce((s, d) => s + Math.pow(d.value - means.value, 2), 0) / data.length;
    const cov01 = data.reduce(
      (s, d) =>
        s + (d.value - means.value) * ((d.features?.dayOfWeek || 0) - means.dayOfWeek),
      0
    ) / data.length;
    const cov11 = data.reduce(
      (s, d) => s + Math.pow((d.features?.dayOfWeek || 0) - means.dayOfWeek, 2),
      0
    ) / data.length;

    this.covariance = [
      [cov00, cov01],
      [cov01, cov11],
    ];
  }

  /**
   * Detect anomalies in a data point
   */
  detectAnomaly(point: AnomalyDataPoint): DetectedAnomaly | null {
    const isolationScore = this.isolationForest?.anomalyScore(point.value) || 0;
    const ewmaResult = this.detectEWMA(point.value);
    const zscore = (point.value - this.historicalMean) / Math.max(0.01, this.historicalStd);
    const mahalanobisDistance = this.computeMahalanobis(point);

    // Determine if anomalous
    const isAnomalousIF = isolationScore > this.config.sensitivity;
    const isAnomalousEWMA = ewmaResult.zscore > this.config.zscoreThreshold;
    const isAnomalousZScore = Math.abs(zscore) > this.config.zscoreThreshold;
    const isAnomalousM = mahalanobisDistance > this.config.mahalanobisThreshold;

    // Majority vote
    const anomalyVotes = [isAnomalousIF, isAnomalousEWMA, isAnomalousZScore, isAnomalousM].filter(
      Boolean
    ).length;
    const isAnomaly = anomalyVotes >= 2; // need at least 2 algorithms to agree

    if (!isAnomaly) {
      return null;
    }

    // Calculate severity
    const confidence = anomalyVotes / 4;
    const severity = this.calculateSeverity(point.value, confidence);

    // Root cause analysis
    const rootCause = this.analyzeRootCause(point);

    return {
      timestamp: point.timestamp,
      value: point.value,
      expectedRange: {
        lower: this.historicalMean - 2 * this.historicalStd,
        upper: this.historicalMean + 2 * this.historicalStd,
      },
      severity,
      confidence,
      algorithms: {
        isolationForest: { anomalous: isAnomalousIF, score: isolationScore },
        ewma: { anomalous: isAnomalousEWMA, zscore: ewmaResult.zscore },
        mahalanobis: { anomalous: isAnomalousM, distance: mahalanobisDistance },
        zScore: { anomalous: isAnomalousZScore, zscore },
      },
      rootCause,
      recommendation: this.getRecommendation(point, rootCause),
    };
  }

  /**
   * EWMA-based anomaly detection with adaptive thresholds
   */
  private detectEWMA(value: number): { level: number; zscore: number } {
    const level = this.config.ewmaAlpha * value + (1 - this.config.ewmaAlpha) * this.ewmaState.level;
    const deviation = Math.abs(value - level);
    const expectedDeviation = this.historicalStd * 1.2; // allow some tolerance
    const zscore = deviation / Math.max(0.01, expectedDeviation);

    this.ewmaState.level = level;
    return { level, zscore };
  }

  /**
   * Compute Mahalanobis distance (multivariate outlier detection)
   */
  private computeMahalanobis(point: AnomalyDataPoint): number {
    const features = point.features || { dayOfWeek: 0 };

    // Vector: [value - mean, dayOfWeek - mean]
    const x = [
      point.value - this.historicalMean,
      features.dayOfWeek - 3.5, // center around mid-week
    ];

    // If covariance is singular, use simplified distance
    if (this.covariance.length === 0 || !this.covariance[0]) {
      return Math.abs(x[0]) / Math.max(0.01, this.historicalStd);
    }

    // Compute inverse of covariance (simplified for 2x2)
    const det = this.covariance[0][0] * this.covariance[1][1] - this.covariance[0][1] * this.covariance[1][0];
    if (Math.abs(det) < 1e-6) {
      return Math.abs(x[0]) / Math.max(0.01, this.historicalStd);
    }

    const invCov = [
      [this.covariance[1][1] / det, -this.covariance[0][1] / det],
      [-this.covariance[1][0] / det, this.covariance[0][0] / det],
    ];

    // Mahalanobis distance: sqrt(x' * Cov^-1 * x)
    let distance = 0;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        distance += x[i] * invCov[i][j] * x[j];
      }
    }

    return Math.sqrt(Math.max(0, distance));
  }

  /**
   * Calculate anomaly severity
   */
  private calculateSeverity(
    value: number,
    confidence: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const deviation = Math.abs(value - this.historicalMean) / Math.max(0.01, this.historicalStd);

    if (confidence < 0.5) {
      return 'low';
    }
    if (confidence < 0.65 || deviation < 2) {
      return 'medium';
    }
    if (confidence < 0.85 || deviation < 3) {
      return 'high';
    }
    return 'critical';
  }

  /**
   * Root cause analysis
   */
  private analyzeRootCause(point: AnomalyDataPoint): string | undefined {
    if (!point.features) {
      return undefined;
    }

    const { dayOfWeek, isHoliday, partnerCount, activeMessages } = point.features;

    if (isHoliday) {
      return 'Holiday effect';
    }
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'Weekend pattern';
    }
    if (partnerCount && partnerCount > 5) {
      return 'High partner activity';
    }
    if (activeMessages && activeMessages < 2) {
      return 'Low engagement';
    }

    return undefined;
  }

  /**
   * Get recommendation for anomaly
   */
  private getRecommendation(point: AnomalyDataPoint, rootCause?: string): string {
    if (point.value > this.historicalMean * 1.5) {
      return `Revenue surge detected (+${((point.value / this.historicalMean - 1) * 100).toFixed(0)}%). ${rootCause ? `Check: ${rootCause}` : 'Investigate cause.'} Prepare resources if trend continues.`;
    } else if (point.value < this.historicalMean * 0.5) {
      return `Revenue drop detected (-${((1 - point.value / this.historicalMean) * 100).toFixed(0)}%). ${rootCause ? `Likely: ${rootCause}` : 'Investigate immediately.'} Review active campaigns.`;
    }

    return `Unusual pattern detected. ${rootCause ? `May be caused by: ${rootCause}` : 'Monitor closely for changes.'}`;
  }

  /**
   * Detect changepoints using PELT algorithm (simplified)
   */
  detectChangepoints(data: AnomalyDataPoint[], penalty: number = 10): ChangePoint[] {
    if (data.length < this.config.changePointMinSize * 2) {
      return [];
    }

    const values = data.map((d) => d.value);
    const changepoints: ChangePoint[] = [];
    const minSegmentSize = this.config.changePointMinSize;

    // Simple PELT: find points where cost function increases significantly
    const costs: number[] = [];
    for (let i = minSegmentSize; i < values.length - minSegmentSize; i++) {
      const before = values.slice(0, i);
      const after = values.slice(i);

      const costBefore = this.computeSegmentCost(before);
      const costAfter = this.computeSegmentCost(after);
      const totalCost = costBefore + costAfter + penalty;

      costs.push(totalCost);
    }

    // Find local minima (changepoints)
    for (let i = 1; i < costs.length - 1; i++) {
      if (costs[i] < costs[i - 1] && costs[i] < costs[i + 1]) {
        const changeIdx = i + minSegmentSize;
        const beforeMean = values.slice(0, changeIdx).reduce((a, b) => a + b, 0) / changeIdx;
        const afterMean =
          values.slice(changeIdx).reduce((a, b) => a + b, 0) / (values.length - changeIdx);

        const magnitude = Math.abs(afterMean - beforeMean) / Math.max(0.01, beforeMean);
        const direction = afterMean > beforeMean ? 'up' : 'down';

        if (magnitude > 0.15) {
          // Only report >15% changes
          changepoints.push({
            timestamp: data[changeIdx].timestamp,
            magnitude,
            direction,
            confidence: 1 - costs[i] / Math.max(...costs),
          });
        }
      }
    }

    return changepoints;
  }

  /**
   * Compute cost of a segment (sum of squared deviations)
   */
  private computeSegmentCost(segment: number[]): number {
    if (segment.length === 0) return 0;
    const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
    return segment.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0);
  }
}

/**
 * Anomaly Detection Manager
 */
export class AnomalyDetectionManager {
  static async detectAnomalies(
    metric: 'revenue' | 'orders' | 'customers' = 'revenue',
    sensitivity: number = 0.85
  ): Promise<DetectedAnomaly[]> {
    const data = await this.getHistoricalMetric(metric, 60);
    const detector = new AdvancedAnomalyDetector({ sensitivity });

    detector.fit(data);

    const anomalies: DetectedAnomaly[] = [];
    for (const point of data.slice(-14)) {
      // Check last 14 days
      const anomaly = detector.detectAnomaly(point);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  static async detectChangepoints(
    metric: 'revenue' | 'orders' | 'customers' = 'revenue'
  ): Promise<ChangePoint[]> {
    const data = await this.getHistoricalMetric(metric, 90);
    const detector = new AdvancedAnomalyDetector();
    detector.fit(data);

    return detector.detectChangepoints(data);
  }

  private static async getHistoricalMetric(
    metric: string,
    days: number
  ): Promise<AnomalyDataPoint[]> {
    // Would query from analytics DB
    const data: AnomalyDataPoint[] = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      const dayOfWeek = date.getDay();
      const trend = i * 0.3;
      const seasonal = 50 * Math.sin((i / 7) * Math.PI * 2);
      const weekendEffect = dayOfWeek === 0 || dayOfWeek === 6 ? -40 : 0;
      const noise = Math.random() * 30 - 15;
      const value = 500 + trend + seasonal + weekendEffect + noise;

      data.push({
        timestamp: date,
        value: Math.max(0, value),
        features: {
          dayOfWeek,
          hour: 12,
          partnerCount: Math.floor(Math.random() * 10),
          activeMessages: Math.floor(Math.random() * 50),
        },
      });
    }

    return data;
  }
}
