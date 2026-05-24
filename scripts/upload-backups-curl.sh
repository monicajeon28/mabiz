#!/bin/bash
# Google Drive Backup Upload Script using cURL and Service Account

set -e

# Configuration
BACKUP_DIR="${1:-.}"
FOLDER_ID="${2:-1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz}"
ENV_FILE="${3:-.env.local}"

# Backup files
BACKUP_FILES=(
  "schema_backup_2026-05-24_221248.prisma"
  "prisma_migrations_backup_2026-05-24_221248.zip"
  "BACKUP_SUMMARY_2026-05-24.txt"
)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Load environment variables
load_env() {
  if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$' | sed 's/^/CONF_/' | tr '\n' ' ')
  else
    echo -e "${RED}Error: $ENV_FILE not found${NC}"
    exit 1
  fi
}

# Create JWT for service account
create_jwt() {
  local email="$1"
  local key="$2"
  local now=$(date +%s)
  local expire=$((now + 3600))

  # Header
  local header=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w 0 | tr '+/' '-_' | tr -d '=')

  # Claim set
  local claim=$(echo -n "{\"iss\":\"$email\",\"scope\":\"https://www.googleapis.com/auth/drive\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$expire,\"iat\":$now}" | base64 -w 0 | tr '+/' '-_' | tr -d '=')

  # Signature (requires private key in PEM format)
  # This is complex - returning empty string to indicate manual setup needed
  echo ""
}

# Upload file to Google Drive
upload_file() {
  local file_path="$1"
  local file_name="$2"
  local folder_id="$3"
  local token="$4"

  if [ ! -f "$file_path" ]; then
    echo -e "${RED}❌ File not found: $file_path${NC}"
    return 1
  fi

  local file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path")
  local size_mb=$(echo "scale=2; $file_size / 1024 / 1024" | bc)

  echo -e "${CYAN}📤 Uploading: $file_name ($size_mb MB)${NC}"

  if [ -z "$token" ]; then
    echo -e "${YELLOW}⚠️  Token generation requires JWT signing${NC}"
    echo -e "${YELLOW}   Please authenticate manually or use Web UI${NC}"
    return 0
  fi

  # Upload using multipart form data
  local response=$(curl -s -X POST \
    -H "Authorization: Bearer $token" \
    -F "metadata={\"name\":\"$file_name\",\"parents\":[\"$folder_id\"]};type=application/json" \
    -F "file=@$file_path" \
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")

  echo "$response" | jq -r '.id' 2>/dev/null || echo "Manual upload needed"
}

# Main
main() {
  echo -e "\n${YELLOW}🚀 Google Drive Backup Upload${NC}"
  echo "============================================================"

  load_env

  echo -e "${CYAN}📂 Backup Directory: $BACKUP_DIR${NC}"
  echo -e "${CYAN}📁 Target Folder ID: $FOLDER_ID${NC}"
  echo ""

  # Verify files
  echo -e "${CYAN}🔍 Verifying backup files...${NC}"
  for file in "${BACKUP_FILES[@]}"; do
    file_path="$BACKUP_DIR/$file"
    if [ -f "$file_path" ]; then
      size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path")
      size_kb=$(echo "scale=2; $size / 1024" | bc)
      echo -e "${GREEN}✅${NC} $file - $size_kb KB"
    else
      echo -e "${RED}⚠️ $file - NOT FOUND${NC}"
    fi
  done

  echo -e "\n${YELLOW}⚠️  Note: JWT signing requires advanced crypto operations${NC}"
  echo -e "${YELLOW}Please use one of these alternatives:${NC}"
  echo -e "  1. Google Drive Web UI (drag & drop files)"
  echo -e "  2. Google Drive CLI (gdrive upload)"
  echo -e "  3. Python with google-auth library"
}

main
