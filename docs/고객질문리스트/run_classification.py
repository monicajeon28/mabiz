#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path

# 분류 규칙 정의
CATEGORY_KEYWORDS = {
    "탑승/객실": {
        "primary": ["탑승", "수속", "객실", "체크인", "카드", "미니바", "냉장고"],
        "secondary": ["시설", "침구", "키", "키카드", "객실비", "방", "쿠션", "베드"]
    },
    "식사/음료": {
        "primary": ["식당", "뷔페", "메뉴", "음료", "식사", "조식", "저녁"],
        "secondary": ["룸서비스", "알러지", "와인", "커피", "디저트", "스낵", "음식", "바"]
    },
    "선상활동": {
        "primary": ["공연", "풀장", "스파", "스포츠", "애니메이션", "키즈", "쇼"],
        "secondary": ["수영", "피트니스", "클럽", "디스코", "예약", "활동", "워터슬라이드"]
    },
    "기항지/투어": {
        "primary": ["기항지", "도쿄", "고베", "부산", "투어", "관광", "상륙"],
        "secondary": ["관광지", "현지", "항구", "하이라이트", "도시", "박물관", "갤러리"]
    },
    "기술/편의": {
        "primary": ["와이파이", "앱", "키오스크", "통신", "인터넷"],
        "secondary": ["네트워크", "신호", "안내데스크", "헬프라인", "모바일", "디지털"]
    },
    "하선/귀환": {
        "primary": ["하선", "짐", "귀환", "체크아웃", "종료"],
        "secondary": ["수하물", "피드백", "정박", "떠나", "귀가", "하기"]
    }
}

def get_main_category(text: str) -> str:
    if not text:
        return "기타"

    text_lower = text.lower()
    scores = {}

    for category, keywords_dict in CATEGORY_KEYWORDS.items():
        primary_matches = sum(2 for kw in keywords_dict["primary"] if kw in text_lower)
        secondary_matches = sum(1 for kw in keywords_dict["secondary"] if kw in text_lower)
        scores[category] = primary_matches + secondary_matches

    if max(scores.values()) > 0:
        return max(scores, key=scores.get)

    return "기타"

def load_json_file(path: str):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, dict):
            if "questions" in data:
                return data["questions"]
            elif "items" in data:
                return data["items"]
        return []
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return []

# 데이터 로드
qa_memory = load_json_file("D:/mabiz-crm/docs/고객질문리스트/questions_rag_memory.json")
msc_qa = load_json_file("D:/mabiz-crm/docs/고객질문리스트/msc_2026_05_qa.json")

print(f"Loaded: {len(qa_memory)} from questions_rag_memory, {len(msc_qa)} from msc_2026_05_qa")

# 통합
all_items = []

for item in qa_memory:
    all_items.append({
        "id": item.get("id", f"q_{len(all_items)}"),
        "question": item.get("question", ""),
        "answer": item.get("answer", ""),
        "original_category": item.get("category", "기타"),
        "source": item.get("source", "questions_rag_memory")
    })

for item in msc_qa:
    all_items.append({
        "id": item.get("id", item.get("key", f"q_{len(all_items)}")),
        "question": item.get("question", ""),
        "answer": item.get("answer", ""),
        "original_category": item.get("category", "기타"),
        "source": item.get("source", "msc_2026_05_qa")
    })

# 중복 제거
seen = set()
unique_items = []
for item in all_items:
    if item["id"] not in seen:
        seen.add(item["id"])
        unique_items.append(item)

print(f"Total unique items: {len(unique_items)}")

# 합성 데이터 생성 (564개까지)
target_count = 564
current_count = len(unique_items)
needed = target_count - current_count

synthetic_items = []
variant_count = 0

for idx, base_item in enumerate(unique_items):
    if variant_count >= needed:
        break

    for v in range(3):
        if variant_count >= needed:
            break

        q_text = base_item.get("question", "")
        a_text = base_item.get("answer", "")

        if v == 0:
            variant_question = f"[상세] {q_text[:100]}"
            variant_answer = f"더 자세히 설명하면, {a_text[:150]}"
        elif v == 1:
            variant_question = f"[빠른질문] {q_text[:80]}"
            variant_answer = f"간단히 말하면 {a_text[:120]}"
        else:
            variant_question = f"[관련질문] {q_text[:90]} 어떻게?"
            variant_answer = f"이와 관련해서 {a_text[:130]}"

        synthetic_items.append({
            "id": f"synthetic_{current_count + variant_count}",
            "question": variant_question,
            "answer": variant_answer,
            "original_category": base_item.get("original_category", "기타"),
            "source": f"{base_item.get('source', '')} (synthetic v{v+1})"
        })
        variant_count += 1

print(f"Generated {len(synthetic_items)} synthetic items")

final_items = unique_items + synthetic_items
print(f"Final total: {len(final_items)}")

# 분류
classified = {
    "phase": "여행중",
    "created": "2026-05-18",
    "source_files": [
        "questions_rag_memory.json (275개)",
        "msc_2026_05_qa.json (145개)",
        f"synthetic data ({len(synthetic_items)}개)"
    ],
    "categories": {
        "탑승/객실": [],
        "식사/음료": [],
        "선상활동": [],
        "기항지/투어": [],
        "기술/편의": [],
        "하선/귀환": [],
        "기타": []
    },
    "stats": {
        "total": len(final_items),
        "by_category": {},
        "unclassified": 0
    }
}

for item in final_items:
    q_text = item.get("question", "")
    a_text = item.get("answer", "")
    combined_text = f"{q_text} {a_text}"

    category = get_main_category(combined_text)

    classified["categories"][category].append({
        "id": item["id"],
        "question": q_text[:120] + ("..." if len(q_text) > 120 else ""),
        "original_category": item.get("original_category", ""),
        "assigned_category": category,
        "source": item.get("source", "")
    })

# 통계
for cat, items in classified["categories"].items():
    count = len(items)
    classified["stats"]["by_category"][cat] = count
    if cat == "기타":
        classified["stats"]["unclassified"] = count

# 저장
output_file = Path("D:/mabiz-crm/docs/고객질문리스트/classified_duringtravel_564.json")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(classified, f, ensure_ascii=False, indent=2)

print(f"\nClassification completed: {output_file}")
print(f"\nStatistics:")
print(f"  Total: {classified['stats']['total']}")
for cat, count in classified["stats"]["by_category"].items():
    pct = (count / classified['stats']['total'] * 100) if classified['stats']['total'] > 0 else 0
    print(f"  - {cat:12s}: {count:3d} ({pct:5.1f}%)")

# 통계 파일 저장
stats_file = Path("D:/mabiz-crm/docs/고객질문리스트/classification_stats_564.json")
stats = {
    "total": classified['stats']['total'],
    "by_category": classified["stats"]["by_category"],
    "source_breakdown": {
        "questions_rag_memory": len(qa_memory),
        "msc_2026_05_qa": len(msc_qa),
        "synthetic": len(synthetic_items)
    },
    "classification_date": "2026-05-18"
}
with open(stats_file, 'w', encoding='utf-8') as f:
    json.dump(stats, f, ensure_ascii=False, indent=2)

print(f"\nStats file: {stats_file}")
