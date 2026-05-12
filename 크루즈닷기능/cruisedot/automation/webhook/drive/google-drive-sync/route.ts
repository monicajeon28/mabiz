// app/api/webhooks/google-drive-sync/route.ts
// Phase 5: Google Drive Webhook Handler
// Purpose: Receive push notifications from Google Drive API
// When: File/folder changes in monitored Shared Drive
// Action: Trigger immediate sync to Cloudinary (2-5 second latency)
//
// Google Drive Change Notification Flow:
// 1. File uploaded/modified in Google Drive Shared Drive
// 2. Google Drive API → POST /api/webhooks/google-drive-sync
// 3. Webhook verifies signature (GOOGLE_DRIVE_WEBHOOK_SECRET)
// 4. Trigger SyncService.execute() immediately
// 5. Return 204 No Content (fire-and-forget)

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { syncImageCache } from '@/lib/image-cache-sync';
import { createHmac, randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 seconds for webhook response

/**
 * Phase 5 Webhook: Google Drive Change Notifications
 * POST /api/webhooks/google-drive-sync
 *
 * Headers:
 * - X-Goog-Resource-State: (exists|not_exists|not_found)
 * - X-Goog-Resource-ID: (resource ID)
 * - X-Goog-Resource-URI: (resource URI)
 * - X-Goog-Message-Number: (sequential message number)
 * - X-Goog-Expiration: (expiration timestamp)
 * - Authorization: (optional Google signature)
 *
 * Body: Empty or { "resourceId": "...", "resourceUri": "..." }
 *
 * Response: 204 No Content (webhook completed immediately)
 * Actual sync happens in background (async)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  try {
    // ============================================
    // Step 1: Validate webhook signature
    // ============================================
    const signature = req.headers.get('X-Goog-Signature');
    const webhookSecret = process.env.GOOGLE_DRIVE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('[GoogleDriveWebhook] GOOGLE_DRIVE_WEBHOOK_SECRET not configured', {
        requestId,
        severity: 'CRITICAL',
      });
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Verify signature if provided
    if (signature) {
      const body = await req.text();
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(body)
        .digest('base64');

      if (signature !== expectedSignature) {
        logger.warn('[GoogleDriveWebhook] Invalid signature', {
          requestId,
          provided: signature.substring(0, 10) + '...',
          expected: expectedSignature.substring(0, 10) + '...',
        });
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // ============================================
    // Step 2: Extract notification headers
    // ============================================
    const resourceState = req.headers.get('X-Goog-Resource-State');
    const resourceId = req.headers.get('X-Goog-Resource-ID');
    const messageNumber = req.headers.get('X-Goog-Message-Number');

    logger.log('[GoogleDriveWebhook] Received notification', {
      requestId,
      resourceState,
      resourceId: resourceId?.substring(0, 10) + '...',
      messageNumber,
    });

    // ============================================
    // Step 3: Validate notification state
    // ============================================
    if (!resourceState || !['exists', 'not_exists', 'not_found'].includes(resourceState)) {
      logger.warn('[GoogleDriveWebhook] Invalid resource state', {
        requestId,
        resourceState,
      });
      // Still return 204 to acknowledge receipt
      return new NextResponse(null, { status: 204 });
    }

    // Only process "exists" state (file/folder present)
    if (resourceState !== 'exists') {
      logger.log('[GoogleDriveWebhook] Ignoring deletion event', {
        requestId,
        resourceState,
      });
      return new NextResponse(null, { status: 204 });
    }

    // ============================================
    // Step 4: Trigger async sync (fire-and-forget)
    // ============================================
    // Important: Return 204 immediately to Google Drive API
    // The actual sync happens in the background

    // Fire async sync without awaiting
    triggerSyncAsync(requestId, resourceId || 'unknown');

    logger.log('[GoogleDriveWebhook] Sync triggered (async)', {
      requestId,
      resourceId: resourceId?.substring(0, 10) + '...',
      latency: Date.now() - startTime,
    });

    // Return 204 No Content immediately
    // Google Drive expects response within 10-30 seconds
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    logger.error('[GoogleDriveWebhook] Webhook error', {
      requestId,
      error: error?.message,
      stack: error?.stack?.substring(0, 200),
      severity: 'ERROR',
    });

    // Return 500 to indicate webhook failure
    // Google Drive will retry with exponential backoff
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Async sync trigger (background task)
 * Runs independently of webhook response
 *
 * Performance:
 * - Typical latency: 2-5 seconds
 * - Max duration: 240 seconds (Vercel Pro)
 * - Memory limit: 3GB
 *
 * Error handling:
 * - Failures logged to logger
 * - No retry (next Cron will pick up failed items)
 * - Does not affect webhook response
 */
async function triggerSyncAsync(requestId: string, resourceId: string) {
  const startTime = Date.now();

  try {
    const result = await syncImageCache();

    logger.log('[GoogleDriveWebhook] Async sync completed', {
      requestId,
      resourceId: resourceId.substring(0, 10) + '...',
      added: result.added,
      deleted: result.deleted,
      duration: Date.now() - startTime,
    });
  } catch (error: any) {
    logger.error('[GoogleDriveWebhook] Async sync error', {
      requestId,
      resourceId: resourceId.substring(0, 10) + '...',
      error: error?.message,
      duration: Date.now() - startTime,
      severity: 'ERROR',
    });
    // Error is logged but does not affect webhook response
    // Next Cron (4-hourly) will retry automatically
  }
}

/**
 * Phase 5 Webhook Setup Instructions
 * ============================================
 *
 * 1. Google Cloud Console Configuration:
 *    - Project: cruisedot-478810
 *    - API: Google Drive API (already enabled)
 *    - Service Account: cruisedot@cruisedot-478810.iam.gserviceaccount.com
 *
 * 2. Create Notification Watch:
 *    POST https://www.googleapis.com/drive/v3/files/{fileId}/watch
 *    {
 *      "address": "https://your-domain.vercel.app/api/webhooks/google-drive-sync",
 *      "type": "web_hook",
 *      "expiration": 604800000  // 7 days
 *    }
 *
 * 3. Environment Variables (Vercel Dashboard):
 *    - GOOGLE_DRIVE_WEBHOOK_SECRET: openssl rand -hex 32
 *    - GOOGLE_DRIVE_WEBHOOK_URL: https://your-domain.vercel.app/...
 *
 * 4. Verification:
 *    - Monitor logs: vercel logs /api/webhooks/google-drive-sync
 *    - Look for "[GoogleDriveWebhook] Received notification"
 *    - Check async sync results within 5 seconds
 *
 * 5. Troubleshooting:
 *    - If webhook not received: Check firewall/CORS
 *    - If 401 errors: Verify GOOGLE_DRIVE_WEBHOOK_SECRET
 *    - If high latency: Check Cloudinary upload queue
 */
