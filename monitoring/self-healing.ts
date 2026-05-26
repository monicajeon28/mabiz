/**
 * Self-Healing Automation System
 * Automatically recovers from common failures
 *
 * Implemented Strategies:
 * 1. Connection pool exhaustion → Restart pool
 * 2. API rate limit → Exponential backoff
 * 3. Cache corruption → Auto-regenerate
 * 4. Database deadlock → Retry with backoff
 * 5. Memory leak → Graceful restart
 */

import { createClient } from '@supabase/supabase-js';

interface HealingAction {
  id: string;
  name: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  enabled: boolean;
  execute: () => Promise<HealingResult>;
  condition: () => Promise<boolean>;
}

interface HealingResult {
  success: boolean;
  message: string;
  recoveryTime: number;
  timestamp: string;
}

interface HealthStatus {
  healthy: boolean;
  issues: string[];
  timestamp: string;
}

class SelfHealingSystem {
  private supabase: any;
  private healingActions: HealingAction[] = [];
  private healingHistory: HealingResult[] = [];
  private maxHistorySize = 1000;

  constructor(
    supabaseUrl: string,
    supabaseKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeActions();
  }

  /**
   * Initialize all healing actions
   */
  private initializeActions() {
    this.healingActions = [
      this.createConnectionPoolHealing(),
      this.createRateLimitHealing(),
      this.createCacheHealing(),
      this.createDatabaseHealing(),
      this.createMemoryLeakHealing(),
      this.createOrphanedRecordHealing(),
      this.createDuplicateRecordHealing(),
      this.createStuckCampaignHealing(),
      this.createFailedBackupHealing()
    ];
  }

  /**
   * 1. Connection Pool Exhaustion Healing
   */
  private createConnectionPoolHealing(): HealingAction {
    return {
      id: 'connection-pool-healing',
      name: 'Database Connection Pool Healing',
      description: 'Restart and rebalance DB connection pool',
      priority: 'CRITICAL',
      enabled: true,
      condition: async () => {
        try {
          // Check pool utilization
          const { data } = await this.supabase.rpc('get_pool_stats');
          return data?.utilization >= 90;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Kill idle connections
          await this.supabase.rpc('kill_idle_connections', {
            idle_seconds: 300
          });

          // Reset pool
          await this.supabase.rpc('reset_connection_pool');

          // Verify recovery
          const { data } = await this.supabase.rpc('get_pool_stats');
          const recovered = data?.utilization < 70;

          return {
            success: recovered,
            message: recovered
              ? `Connection pool recovered (utilization: ${data?.utilization}%)`
              : 'Connection pool not fully recovered',
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Connection pool healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 2. API Rate Limit Healing
   */
  private createRateLimitHealing(): HealingAction {
    const backoffStrategy = {
      baseDelay: 1000,
      maxDelay: 60000,
      multiplier: 2,
      jitter: 0.1
    };

    return {
      id: 'rate-limit-healing',
      name: 'API Rate Limit Recovery',
      description: 'Implement exponential backoff for rate-limited requests',
      priority: 'HIGH',
      enabled: true,
      condition: async () => {
        // Check recent 429 errors
        try {
          const { data } = await this.supabase.rpc('get_recent_errors', {
            status_code: 429,
            minutes: 10
          });
          return (data?.length || 0) > 3;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Calculate backoff
          let delay = backoffStrategy.baseDelay;
          let retries = 0;
          const maxRetries = 5;

          while (retries < maxRetries) {
            const jitterAmount = delay * backoffStrategy.jitter;
            const actualDelay = delay + (Math.random() * jitterAmount - jitterAmount / 2);

            console.log(`Rate limit backoff: waiting ${Math.round(actualDelay)}ms (retry ${retries + 1}/${maxRetries})`);

            await new Promise(resolve => setTimeout(resolve, actualDelay));

            // Try request
            const { error } = await this.supabase.from('health_checks').select('*').limit(1);
            if (!error) {
              return {
                success: true,
                message: `Recovered from rate limit after ${retries + 1} retries`,
                recoveryTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
              };
            }

            delay = Math.min(delay * backoffStrategy.multiplier, backoffStrategy.maxDelay);
            retries++;
          }

          return {
            success: false,
            message: `Rate limit not recovered after ${maxRetries} retries`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Rate limit healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 3. Cache Invalidation & Regeneration
   */
  private createCacheHealing(): HealingAction {
    return {
      id: 'cache-healing',
      name: 'Cache Invalidation & Regeneration',
      description: 'Clear corrupted cache and regenerate',
      priority: 'MEDIUM',
      enabled: true,
      condition: async () => {
        try {
          // Check cache consistency
          const { data } = await this.supabase.rpc('check_cache_integrity');
          return data?.inconsistent_keys > 0;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Clear cache
          await this.supabase.rpc('invalidate_all_cache');

          // Regenerate critical caches
          const cacheKeys = [
            'contacts_by_group',
            'campaigns_active',
            'affiliate_stats',
            'sms_templates'
          ];

          for (const key of cacheKeys) {
            await this.supabase.rpc('regenerate_cache', { cache_key: key });
          }

          return {
            success: true,
            message: `Cache regenerated (${cacheKeys.length} keys)`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Cache healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 4. Database Deadlock & Transaction Failure Healing
   */
  private createDatabaseHealing(): HealingAction {
    return {
      id: 'database-deadlock-healing',
      name: 'Database Deadlock Resolution',
      description: 'Detect and resolve database deadlocks',
      priority: 'CRITICAL',
      enabled: true,
      condition: async () => {
        try {
          const { data } = await this.supabase.rpc('check_deadlocks');
          return data?.deadlock_count > 0;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Get deadlocked transactions
          const { data: deadlocks } = await this.supabase.rpc('get_deadlocked_transactions');

          // Kill long-running transactions
          if (deadlocks) {
            for (const txn of deadlocks) {
              await this.supabase.rpc('kill_long_transaction', {
                transaction_id: txn.id,
                duration_ms: txn.duration
              });
            }
          }

          // Retry failed operations
          const { data: failedOps } = await this.supabase.rpc('get_failed_operations', {
            error_pattern: 'deadlock',
            minutes: 5
          });

          let retryCount = 0;
          if (failedOps) {
            for (const op of failedOps.slice(0, 10)) {
              try {
                await this.supabase.rpc('retry_operation', { operation_id: op.id });
                retryCount++;
              } catch {
                // Continue with next operation
              }
            }
          }

          return {
            success: true,
            message: `Resolved deadlocks and retried ${retryCount} operations`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Deadlock healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 5. Memory Leak Detection & Graceful Restart
   */
  private createMemoryLeakHealing(): HealingAction {
    return {
      id: 'memory-leak-healing',
      name: 'Memory Leak Detection & Restart',
      description: 'Detect memory leaks and trigger graceful restart',
      priority: 'HIGH',
      enabled: true,
      condition: async () => {
        if (typeof process === 'undefined') return false;

        const memoryUsage = process.memoryUsage();
        const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

        // Alert if >85% of heap used
        return heapUsedPercent > 85;
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          if (typeof process === 'undefined') {
            throw new Error('Node.js process object not available');
          }

          // Force garbage collection
          if (global.gc) {
            global.gc();
          }

          // Log memory before/after
          const memBefore = process.memoryUsage();
          console.log(`Memory usage: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);

          // If still high, schedule graceful restart
          const heapUsedPercent = (memBefore.heapUsed / memBefore.heapTotal) * 100;
          if (heapUsedPercent > 85) {
            console.log('Scheduling graceful restart due to memory leak');
            // In production, this would trigger a graceful shutdown
            // allowing in-flight requests to complete before restart
            process.emit('SIGTERM');
          }

          return {
            success: true,
            message: `Memory cleaned (${Math.round(memBefore.heapUsed / 1024 / 1024)}MB)`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Memory healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 6. Orphaned Contact Record Healing
   */
  private createOrphanedRecordHealing(): HealingAction {
    return {
      id: 'orphaned-record-healing',
      name: 'Orphaned Record Cleanup',
      description: 'Find and clean orphaned contact records',
      priority: 'HIGH',
      enabled: true,
      condition: async () => {
        try {
          const { data } = await this.supabase.rpc('find_orphaned_contacts');
          return (data?.count || 0) > 0;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Find orphaned contacts
          const { data: orphaned } = await this.supabase.rpc('find_orphaned_contacts');

          if (!orphaned || orphaned.count === 0) {
            return {
              success: true,
              message: 'No orphaned records found',
              recoveryTime: Date.now() - startTime,
              timestamp: new Date().toISOString()
            };
          }

          // Move to archive or delete
          await this.supabase.rpc('archive_orphaned_contacts', {
            contact_ids: orphaned.ids
          });

          return {
            success: true,
            message: `Archived ${orphaned.count} orphaned contacts`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Orphaned record healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 7. Duplicate Record Healing
   */
  private createDuplicateRecordHealing(): HealingAction {
    return {
      id: 'duplicate-record-healing',
      name: 'Duplicate Contact Remediation',
      description: 'Detect and merge/remove duplicate contacts',
      priority: 'MEDIUM',
      enabled: true,
      condition: async () => {
        try {
          const { data } = await this.supabase.rpc('find_duplicate_contacts');
          return (data?.count || 0) > 0;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Find duplicates
          const { data: duplicates } = await this.supabase.rpc('find_duplicate_contacts');

          if (!duplicates || duplicates.count === 0) {
            return {
              success: true,
              message: 'No duplicates found',
              recoveryTime: Date.now() - startTime,
              timestamp: new Date().toISOString()
            };
          }

          // Merge duplicates (keep older, merge data)
          let mergedCount = 0;
          for (const group of duplicates.groups) {
            try {
              await this.supabase.rpc('merge_duplicate_contacts', {
                primary_id: group.primary_id,
                duplicate_ids: group.duplicate_ids
              });
              mergedCount++;
            } catch {
              // Continue with next group
            }
          }

          return {
            success: true,
            message: `Merged ${mergedCount}/${duplicates.groups.length} duplicate groups`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Duplicate healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 8. Stuck Campaign Healing
   */
  private createStuckCampaignHealing(): HealingAction {
    return {
      id: 'stuck-campaign-healing',
      name: 'Stuck Campaign Recovery',
      description: 'Detect and resume stuck campaigns',
      priority: 'HIGH',
      enabled: true,
      condition: async () => {
        try {
          const { data } = await this.supabase.rpc('find_stuck_campaigns', {
            minutes: 30
          });
          return (data?.count || 0) > 0;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Find stuck campaigns
          const { data: stuck } = await this.supabase.rpc('find_stuck_campaigns', {
            minutes: 30
          });

          if (!stuck || stuck.count === 0) {
            return {
              success: true,
              message: 'No stuck campaigns found',
              recoveryTime: Date.now() - startTime,
              timestamp: new Date().toISOString()
            };
          }

          // Resume campaigns
          let resumedCount = 0;
          for (const campaign of stuck.campaigns) {
            try {
              await this.supabase.rpc('resume_campaign', {
                campaign_id: campaign.id
              });
              resumedCount++;
            } catch {
              // Continue
            }
          }

          return {
            success: true,
            message: `Resumed ${resumedCount}/${stuck.count} stuck campaigns`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Campaign healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * 9. Failed Backup Healing
   */
  private createFailedBackupHealing(): HealingAction {
    return {
      id: 'backup-healing',
      name: 'Failed Backup Recovery',
      description: 'Retry failed backup jobs',
      priority: 'HIGH',
      enabled: true,
      condition: async () => {
        try {
          const { data } = await this.supabase.rpc('check_backup_status');
          return data?.last_failed && !data?.last_success;
        } catch {
          return false;
        }
      },
      execute: async () => {
        const startTime = Date.now();
        try {
          // Retry backup
          await this.supabase.rpc('trigger_backup');

          // Verify backup completion
          const { data } = await this.supabase.rpc('check_backup_status');

          return {
            success: data?.last_success,
            message: data?.last_success ? 'Backup completed successfully' : 'Backup retry still pending',
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            success: false,
            message: `Backup healing failed: ${String(error)}`,
            recoveryTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          };
        }
      }
    };
  }

  /**
   * Run all enabled healing actions
   */
  async runHealingCycle(): Promise<HealthStatus> {
    const issues: string[] = [];
    const timestamp = new Date().toISOString();

    console.log(`\n=== Self-Healing Cycle Started [${timestamp}] ===\n`);

    for (const action of this.healingActions) {
      if (!action.enabled) {
        console.log(`⏭️  Skipped: ${action.name}`);
        continue;
      }

      try {
        const needsHealing = await action.condition();

        if (!needsHealing) {
          console.log(`✅ ${action.name}: OK`);
          continue;
        }

        console.log(`🔧 ${action.name}: Attempting healing...`);
        const result = await action.execute();

        if (result.success) {
          console.log(`✅ ${action.name}: Recovered (${result.recoveryTime}ms)`);
          console.log(`   Message: ${result.message}`);
        } else {
          console.log(`❌ ${action.name}: Failed`);
          console.log(`   Message: ${result.message}`);
          issues.push(`${action.name}: ${result.message}`);
        }

        // Store result
        this.recordHealingAction(result);
      } catch (error) {
        const errorMsg = String(error);
        console.log(`❌ ${action.name}: Exception - ${errorMsg}`);
        issues.push(`${action.name}: ${errorMsg}`);
      }
    }

    console.log(`\n=== Healing Cycle Completed ===\n`);

    return {
      healthy: issues.length === 0,
      issues,
      timestamp
    };
  }

  /**
   * Record healing action in history
   */
  private recordHealingAction(result: HealingResult) {
    this.healingHistory.push(result);

    // Trim history if too large
    if (this.healingHistory.length > this.maxHistorySize) {
      this.healingHistory = this.healingHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get healing history
   */
  getHealingHistory(limit: number = 100): HealingResult[] {
    return this.healingHistory.slice(-limit);
  }

  /**
   * Get healing statistics
   */
  getStatistics() {
    const total = this.healingHistory.length;
    const successful = this.healingHistory.filter(h => h.success).length;
    const avgRecoveryTime = total > 0
      ? this.healingHistory.reduce((sum, h) => sum + h.recoveryTime, 0) / total
      : 0;

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) : 'N/A',
      averageRecoveryTime: Math.round(avgRecoveryTime),
      lastAction: this.healingHistory[this.healingHistory.length - 1]
    };
  }
}

// Export for use
export { SelfHealingSystem };

/**
 * Usage Example:
 *
 * const healer = new SelfHealingSystem(
 *   process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   process.env.SUPABASE_SERVICE_ROLE_KEY!
 * );
 *
 * // Run periodically (e.g., every 5 minutes)
 * setInterval(async () => {
 *   const status = await healer.runHealingCycle();
 *   if (!status.healthy) {
 *     console.error('System issues:', status.issues);
 *     // Notify via Sentry, Slack, etc.
 *   }
 * }, 5 * 60 * 1000);
 */
