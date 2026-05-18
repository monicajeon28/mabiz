#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MSC Q&A JSON 업로드 스크립트
145개 항목을 API를 통해 CRM에 업로드 (50개씩 배치)
"""

import json
import requests
import sys
import io
from typing import List, Dict, Any

# Windows 터미널 UTF-8 인코딩 설정
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def load_json_file(filepath: str) -> Dict[str, Any]:
    """JSON 파일 로드"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # questions 필드를 items로 변환 (필요시)
    if 'questions' in data and 'items' not in data:
        data['items'] = data.pop('questions')
    return data


def upload_batch(items: List[Dict[str, Any]], api_url: str, batch_num: int) -> bool:
    """배치 업로드 (50개씩)"""
    try:
        # salesTone을 API 형식으로 변환
        for item in items:
            if isinstance(item.get('salesTone'), str):
                item['salesTone'] = {
                    'primary': item['salesTone'],
                    'secondary': [],
                    'confidence': 0.8
                }

        payload = {
            "data": items,
            "mode": "upsert"
        }

        print("[Batch{}] Uploading {} items...".format(batch_num, len(items)), end=" ")

        response = requests.post(
            api_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        if response.status_code in [200, 201]:
            data = response.json()
            print("[OK] {} items upserted".format(data.get('count', len(items))))
            return True
        else:
            print("[ERROR] HTTP {}".format(response.status_code))
            print("  Response: {}".format(response.text[:200]))
            return False

    except requests.exceptions.ConnectionError:
        print("[ERROR] Connection failed - Server not running?")
        return False
    except requests.exceptions.Timeout:
        print("[ERROR] Request timeout")
        return False
    except Exception as e:
        print("[ERROR] {}".format(str(e)))
        return False


def main():
    input_file = "docs/고객질문리스트/questions_rag_msc_2026_05.json"
    api_url = "http://localhost:3000/api/tools/bot-guide-answers"
    batch_size = 50

    print("=" * 70)
    print("MSC Q&A Upload Script")
    print("=" * 70)
    print("Input: {}".format(input_file))
    print("API: {}".format(api_url))
    print("Batch size: {}".format(batch_size))
    print()

    try:
        # JSON 파일 로드
        print("[*] Loading JSON file...")
        data = load_json_file(input_file)
        items = data.get('items', [])

        print("[OK] Loaded {} items".format(len(items)))
        print()

        # 배치별로 업로드
        total_uploaded = 0
        successful_batches = 0
        failed_batches = 0

        for i in range(0, len(items), batch_size):
            batch = items[i:i+batch_size]
            batch_num = i // batch_size + 1

            success = upload_batch(batch, api_url, batch_num)

            if success:
                successful_batches += 1
                total_uploaded += len(batch)
            else:
                failed_batches += 1

        print()
        print("=" * 70)
        print("Upload Summary")
        print("=" * 70)
        print("[*] Total items: {}".format(len(items)))
        print("[*] Total uploaded: {}".format(total_uploaded))
        print("[*] Successful batches: {}".format(successful_batches))
        print("[*] Failed batches: {}".format(failed_batches))
        print()

        if failed_batches == 0:
            print("[DONE] All batches uploaded successfully!")
            print()
            print("Verification commands:")
            print("  curl \"http://localhost:3000/api/tools/bot-guide-answers?q=waifi&limit=1\" 2>/dev/null | python -m json.tool | head -20")
            print("  curl \"http://localhost:3000/api/tools/bot-guide-answers?q=ship&limit=1\" 2>/dev/null | python -m json.tool | head -20")
            return 0
        else:
            print("[WARNING] {} batches failed".format(failed_batches))
            print("Please check the server and retry.")
            return 1

    except FileNotFoundError:
        print("[ERROR] File not found: {}".format(input_file))
        return 1
    except json.JSONDecodeError as e:
        print("[ERROR] Invalid JSON: {}".format(e))
        return 1
    except Exception as e:
        print("[ERROR] {}".format(str(e)))
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
