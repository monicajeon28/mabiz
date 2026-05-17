#!/bin/bash
# Load 275 Q&A items into the database via API

echo "🚀 Loading 275 Q&A items..."

curl -X POST http://localhost:3000/api/tools/bot-guide-answers \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "upsert",
    "confirm": true
  }' \
  | jq '.'

echo ""
echo "✅ Complete! Visit http://localhost:3000/tools to see Q&A Library"
