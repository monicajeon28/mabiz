#!/bin/bash

##############################################################################
# Image Sync Monitoring Dashboard (WO-GDRIVE-SYNC)
# Purpose: Monitor Google Drive → ImageCache → Cloudinary sync progress
# Usage: ./scripts/monitor-image-sync.sh [--manual-check]
##############################################################################

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
MONITOR_DURATION_MINUTES=360  # 6 hours
CHECK_INTERVAL_EARLY_SECONDS=60  # First 10 min: every 1 min
CHECK_INTERVAL_LATE_SECONDS=300  # After 10 min: every 5 min
EARLY_PHASE_MINUTES=10
INITIAL_COUNT=0
MANUAL_MODE=false
LOG_FILE="/tmp/image-sync-monitor-$(date +%s).log"
STATS_FILE="/tmp/image-sync-stats.json"

# Progress tracker
declare -A SYNC_HISTORY
SAMPLES=0

##############################################################################
# UTILITY FUNCTIONS
##############################################################################

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] $*" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓ $*${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}⚠ $*${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}✗ $*${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}ℹ $*${NC}" | tee -a "$LOG_FILE"
}

section() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
    echo -e "${CYAN}$*${NC}" | tee -a "$LOG_FILE"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
}

##############################################################################
# DATABASE QUERY FUNCTIONS
##############################################################################

# Query ImageCache status from database
query_image_cache_status() {
    if [ "$MANUAL_MODE" = false ]; then
        # Production: Use Neon DB via prisma
        npx prisma studio --browser=none &
        sleep 2
    fi

    # Fallback: Query directly if DATABASE_URL exists
    if [ -n "${DATABASE_URL:-}" ]; then
        psql "$DATABASE_URL" --tuples-only --no-align -c \
            "SELECT json_build_object(
                'total', COUNT(*),
                'with_cloudinary_url', COUNT(*) FILTER (WHERE \"cloudinaryUrl\" IS NOT NULL),
                'without_cloudinary_url', COUNT(*) FILTER (WHERE \"cloudinaryUrl\" IS NULL),
                'sync_percentage', ROUND(100.0 * COUNT(*) FILTER (WHERE \"cloudinaryUrl\" IS NOT NULL) / COUNT(*), 2),
                'first_synced_at', MIN(\"cloudinarySyncedAt\"),
                'last_synced_at', MAX(\"cloudinarySyncedAt\")
            ) FROM \"ImageCache\";" 2>/dev/null || echo '{"error": "DB connection failed"}'
    else
        # Simulate: Return mock data (for testing)
        local elapsed=$(($(date +%s) - START_TIME))
        local rate=$((elapsed > 0 ? 20 * elapsed / 60 : 0))
        echo "{\"total\": 7306, \"with_cloudinary_url\": $((INITIAL_COUNT + rate)), \"without_cloudinary_url\": $((7306 - INITIAL_COUNT - rate)), \"sync_percentage\": $(awk "BEGIN {printf \"%.2f\", 100.0 * ($INITIAL_COUNT + $rate) / 7306}")}"
    fi
}

# Get Cloudinary folder structure
query_cloudinary_folders() {
    if [ -z "${CLOUDINARY_KEY:-}" ] || [ -z "${CLOUDINARY_SECRET:-}" ]; then
        warn "Cloudinary credentials not configured"
        return 1
    fi

    curl -s "https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME:-doqrbkokh}/resources?prefix=cruise-images&type=upload&max_results=500" \
        -u "${CLOUDINARY_KEY}:${CLOUDINARY_SECRET}" | \
        jq -r '.resources | group_by(.folder // "root") | map({folder: .[0].folder // "root", count: length, total_bytes: map(.bytes | select(. != null)) | add}) | sort_by(.count) | reverse | .[]' 2>/dev/null || \
        echo "Failed to query Cloudinary"
}

# Get Cron execution history
query_cron_logs() {
    local service="${1:-sync-image-cache-to-cloudinary}"

    # Check Vercel logs (requires auth)
    if command -v vercel &> /dev/null && [ -n "${VERCEL_TOKEN:-}" ]; then
        vercel logs "api/cron/$service" --lines 50 2>/dev/null || echo "Cron logs unavailable"
    else
        echo "Vercel CLI not configured"
    fi
}

##############################################################################
# MONITORING FUNCTIONS
##############################################################################

get_initial_count() {
    local status=$(query_image_cache_status)

    if echo "$status" | jq . > /dev/null 2>&1; then
        echo "$status" | jq '.with_cloudinary_url // 0'
    else
        echo 0
    fi
}

get_sync_percentage() {
    local status=$(query_image_cache_status)

    if echo "$status" | jq . > /dev/null 2>&1; then
        echo "$status" | jq '.sync_percentage // 0'
    else
        echo 0
    fi
}

get_remaining_count() {
    local status=$(query_image_cache_status)

    if echo "$status" | jq . > /dev/null 2>&1; then
        echo "$status" | jq '.without_cloudinary_url // 0'
    else
        echo 0
    fi
}

print_current_status() {
    local status=$(query_image_cache_status)

    if ! echo "$status" | jq . > /dev/null 2>&1; then
        warn "Failed to query database"
        return 1
    fi

    local total=$(echo "$status" | jq '.total')
    local synced=$(echo "$status" | jq '.with_cloudinary_url')
    local remaining=$(echo "$status" | jq '.without_cloudinary_url')
    local percentage=$(echo "$status" | jq '.sync_percentage')
    local last_synced=$(echo "$status" | jq -r '.last_synced_at // "Never"')

    # Calculate progress bar
    local bar_width=50
    local filled=$((percentage * bar_width / 100))
    local empty=$((bar_width - filled))
    local bar=""
    for ((i=0; i<filled; i++)); do bar="${bar}█"; done
    for ((i=0; i<empty; i++)); do bar="${bar}░"; done

    echo ""
    echo -e "${CYAN}📊 ImageCache Sync Status${NC}"
    echo -e "  Total Images:      ${BLUE}$total${NC}"
    echo -e "  Synced:            ${GREEN}$synced${NC} ✓"
    echo -e "  Remaining:         ${YELLOW}$remaining${NC}"
    echo -e "  Percentage:        ${CYAN}$percentage%${NC}"
    echo -e "  Progress:          [${bar}] $percentage%"
    echo -e "  Last Synced:       $last_synced"
    echo ""
}

estimate_completion_time() {
    local elapsed_minutes=$(($(date +%s) - START_TIME) / 60)
    local synced_now=$(get_remaining_count)

    if [ $((INITIAL_COUNT - synced_now)) -eq 0 ]; then
        echo "N/A (no progress yet)"
        return
    fi

    # Calculate sync rate
    local synced_items=$((INITIAL_COUNT - synced_now))
    local rate_per_minute=$((synced_items > 0 ? synced_items / (elapsed_minutes + 1) : 0))

    if [ $rate_per_minute -eq 0 ]; then
        echo "N/A (calculating...)"
        return
    fi

    local items_remaining=$(get_remaining_count)
    local minutes_remaining=$((items_remaining / (rate_per_minute + 1)))

    if [ $minutes_remaining -lt 1 ]; then
        echo "< 1 minute"
    else
        local hours=$((minutes_remaining / 60))
        local mins=$((minutes_remaining % 60))
        if [ $hours -gt 0 ]; then
            echo "${hours}h ${mins}m"
        else
            echo "${mins}m"
        fi
    fi
}

print_statistics() {
    local elapsed_seconds=$(($(date +%s) - START_TIME))
    local elapsed_minutes=$((elapsed_seconds / 60))

    local status=$(query_image_cache_status)
    local synced=$(echo "$status" | jq '.with_cloudinary_url')
    local synced_in_interval=$((INITIAL_COUNT - synced))

    local rate_per_hour=0
    if [ $elapsed_minutes -gt 0 ]; then
        rate_per_hour=$((synced_in_interval * 60 / elapsed_minutes))
    fi

    local remaining=$(get_remaining_count)
    local completion_time=$(estimate_completion_time)

    echo ""
    echo -e "${CYAN}📈 Statistics${NC}"
    echo -e "  Elapsed Time:      ${elapsed_minutes}m ${elapsed_seconds%?}s"
    echo -e "  Synced in Period:  ${GREEN}$synced_in_interval${NC}"
    echo -e "  Sync Rate:         ${GREEN}$rate_per_hour/hour${NC}"
    echo -e "  Items Remaining:   ${YELLOW}$remaining${NC}"
    echo -e "  Est. Completion:   ${CYAN}$completion_time${NC}"
    echo ""
}

##############################################################################
# VALIDATION FUNCTIONS
##############################################################################

validate_first_batch() {
    section "🔍 First Batch Validation (20 images)"

    if [ -z "${CLOUDINARY_API_KEY:-}" ] || [ -z "${CLOUDINARY_SECRET:-}" ]; then
        warn "Cloudinary credentials not configured, skipping validation"
        return 1
    fi

    # Query first 20 synced images
    local sample_query='
    SELECT json_agg(json_build_object(
        "id", id,
        "fileName", "fileName",
        "cloudinaryUrl", "cloudinaryUrl",
        "cloudinaryPublicId", "cloudinaryPublicId"
    )) FROM "ImageCache"
    WHERE "cloudinaryUrl" IS NOT NULL
    LIMIT 20
    '

    if [ -n "${DATABASE_URL:-}" ]; then
        psql "$DATABASE_URL" --tuples-only --no-align -c "$sample_query" | jq '.[0:3]' 2>/dev/null || warn "Could not fetch sample images"
    else
        info "Mock validation: Assuming first batch is valid"
    fi
}

##############################################################################
# CLOUDINARY STRUCTURE CHECK
##############################################################################

check_cloudinary_structure() {
    section "🏗️  Cloudinary Folder Structure"

    local folders=$(query_cloudinary_folders)

    if [ $? -eq 0 ] && [ -n "$folders" ]; then
        echo "$folders" | head -10
        echo ""
        echo -e "${YELLOW}Total folders checked: $(echo "$folders" | wc -l)${NC}"
    else
        info "Cloudinary structure check unavailable (credentials not configured)"
    fi
}

##############################################################################
# MONITOR LOOP
##############################################################################

monitor_sync_progress() {
    section "🚀 Starting Image Sync Monitoring"

    INITIAL_COUNT=$(get_initial_count)

    if [ "$INITIAL_COUNT" -eq 0 ]; then
        info "Initial synced count: 0 (full sync starting)"
    else
        success "Initial synced count: $INITIAL_COUNT"
    fi

    START_TIME=$(date +%s)
    SAMPLES=0

    local early_phase_end=$((START_TIME + EARLY_PHASE_MINUTES * 60))
    local monitor_end=$((START_TIME + MONITOR_DURATION_MINUTES * 60))

    while [ $(date +%s) -lt $monitor_end ]; do
        local now=$(date +%s)
        local elapsed=$((now - START_TIME))
        local elapsed_minutes=$((elapsed / 60))

        # Determine check interval
        local check_interval=$CHECK_INTERVAL_EARLY_SECONDS
        if [ $now -gt $early_phase_end ]; then
            check_interval=$CHECK_INTERVAL_LATE_SECONDS
        fi

        echo ""
        echo -e "${BLUE}━━ Check #$((++SAMPLES)) (${elapsed_minutes}m elapsed)${NC}"
        print_current_status
        print_statistics

        # Cloudinary folder check every 30 minutes
        if [ $((SAMPLES % 30)) -eq 0 ]; then
            check_cloudinary_structure
        fi

        # Sleep until next check
        local next_check=$((now + check_interval))
        local sleep_time=$((next_check - $(date +%s)))

        if [ $sleep_time -gt 0 ]; then
            sleep $sleep_time
        fi
    done

    section "✅ Monitoring Complete"
    success "Log saved to: $LOG_FILE"
}

##############################################################################
# MAIN
##############################################################################

main() {
    # Parse arguments
    if [ "${1:-}" = "--manual-check" ]; then
        MANUAL_MODE=true
        section "🔧 Manual Database Check"
        print_current_status
        validate_first_batch
        check_cloudinary_structure
        print_statistics
        return 0
    fi

    # Initial banner
    section "Image Sync Progress Monitor"
    info "Configuration:"
    echo "  Monitor Duration:     ${MONITOR_DURATION_MINUTES}m"
    echo "  Early Phase Interval: ${CHECK_INTERVAL_EARLY_SECONDS}s (first ${EARLY_PHASE_MINUTES}m)"
    echo "  Late Phase Interval:  ${CHECK_INTERVAL_LATE_SECONDS}s"
    echo "  Log File:             $LOG_FILE"
    echo ""

    # Validate environment
    if [ -z "${DATABASE_URL:-}" ]; then
        warn "DATABASE_URL not set. Using simulation mode."
        info "To enable real monitoring, set DATABASE_URL environment variable"
    fi

    # Start monitoring
    monitor_sync_progress
}

main "$@"
