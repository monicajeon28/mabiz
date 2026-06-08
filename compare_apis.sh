#!/bin/bash

declare -A routes_map
while IFS= read -r route; do
  routes_map["$route"]=1
done < api_routes_list.txt

missing_count=0
while IFS= read -r api_call; do
  # 정확한 매치
  if [[ -n "${routes_map[$api_call]}" ]]; then
    continue
  fi
  
  # 동적 라우트 매칭 ([id] 형태)
  found=0
  for route in "${!routes_map[@]}"; do
    # 정확한 prefix가 없으면 계속
    prefix="${route%%/\[*}"
    if [[ "$api_call" == "$prefix" ]]; then
      # 경로가 정확히 일치
      found=1
      break
    fi
    
    # 동적 라우트 패턴 매칭: /api/contacts/[id] -> /api/contacts/123
    if echo "$route" | grep -qE '\[.*\]'; then
      # [id] 패턴을 정규표현식으로 변환
      pattern=$(echo "$route" | sed 's/\[.*\]/[^\/]*/g' | sed 's/\//\\//g')
      if echo "$api_call" | grep -qE "^${pattern}$"; then
        found=1
        break
      fi
    fi
  done
  
  if [[ $found -eq 0 ]]; then
    echo "$api_call"
    ((missing_count++))
  fi
done < api_calls_list.txt

echo ""
echo "누락된 경로 총 $missing_count개"
