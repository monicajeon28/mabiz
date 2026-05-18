#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MSC Q&A JSON을 import-bot-guide-answers.ts 형식으로 변환
"""

import json
from datetime import datetime

def main():
    input_file = "docs/고객질문리스트/msc_2026_05_qa.json"
    output_file = "docs/고객질문리스트/questions_rag_msc_2026_05.json"

    print("[*] Loading MSC Q&A JSON...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    items = data.get('items', [])
    print("[OK] Loaded {} items".format(len(items)))

    # 카테고리 추출
    categories = list(set(item['category'] for item in items))
    categories.sort()

    print("[OK] Found {} categories:".format(len(categories)))
    for cat in categories:
        count = sum(1 for item in items if item['category'] == cat)
        print("    - {}: {} items".format(cat, count))

    # 변환 형식
    output_data = {
        "version": "2026-05-18",
        "updated": datetime.now().isoformat(),
        "total": len(items),
        "categories": categories,
        "questions": []
    }

    # 각 항목 변환
    for item in items:
        question = {
            "id": item['key'],
            "question": item['question'],
            "answer": item['answer'],
            "category": item['category'],
            "source": item['source'],
            "type": item['type'],
            "keywords": item.get('keywords', []),
            "sales_tone": {
                "primary": item.get('salesTone', 'friendly') if isinstance(item.get('salesTone'), str) else item.get('salesTone', {}).get('primary', 'neutral'),
                "secondary": [],
                "confidence": 0.8
            }
        }
        output_data["questions"].append(question)

    # JSON 저장
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print()
    print("=" * 60)
    print("[OK] Converted data saved to: {}".format(output_file))
    print("=" * 60)
    print()
    print("Next steps:")
    print("  npx ts-node scripts/import-bot-guide-answers.ts")
    print()

if __name__ == "__main__":
    main()
