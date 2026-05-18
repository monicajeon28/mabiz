#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path
from typing import Dict, List, Any

# 분류 규칙 정의
CATEGORY_KEYWORDS = {
    "탑승/객실": [
        "탑승", "승선", "체크인", "객실", "카드", "미니바", "냉장고", "수건",
        "객실카드", "키카드", "키", "침구", "시설", "객실시설", "수속"
    ],
    "식사/음료": [
        "식당", "메뉴", "음료", "뷔페", "정찬", "식사", "조식", "저녁",
        "룸서비스", "룸 서비스", "알러지", "음식", "식음료", "바", "카페",
        "와인", "비어", "커피", "디저트", "스낵"
    ],
    "선상활동": [
        "공연", "풀장", "수영", "스파", "워터슬라이드", "키즈", "아이",
        "피트니스", "체육", "스포츠", "예약", "활동", "엔터테인먼트", "쇼",
        "클럽", "디스코", "시어터", "수상", "갑판", "애니메이션"
    ],
    "기항지/투어": [
        "기항지", "도쿄", "고베", "고오베", "코오베", "부산", "투어", "관광",
        "하이라이트", "여행", "관광지", "현지", "항구", "상륙", "상륙투어",
        "도시", "관광명소", "갤러리", "박물관", "관광명소"
    ],
    "기술/편의": [
        "와이파이", "앱", "키오스크", "통신", "인터넷", "wi-fi",
        "네트워크", "신호", "안내데스크", "데스크", "헬프라인", "콜센터",
        "디지털", "전자", "어플리케이션", "모바일", "온보드"
    ],
    "하선/귀환": [
        "하선", "하기", "짐", "수하물", "귀환", "피드백", "하소",
        "종료", "끝", "귀가", "떠나", "정박", "떨어지기", "체크아웃"
    ]
}

def get_main_category(text: str) -> str:
    """텍스트를 6개 카테고리 중 하나로 분류"""
    if not text:
        return "기타"

    text_lower = text.lower()

    # 각 카테고리별 매칭 점수 계산
    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in text_lower)
        scores[category] = score

    # 최고 점수 카테고리 반환
    if max(scores.values()) > 0:
        return max(scores, key=scores.get)

    return "기타"

def load_json_file(path: str) -> List[Dict]:
    """JSON 파일 로드"""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # 구조에 따라 items 추출
        if isinstance(data, dict):
            if "questions" in data:
                return data["questions"]
            elif "items" in data:
                return data["items"]
            elif isinstance(data, list):
                return data
        return []
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return []

def merge_and_classify():
    """여러 JSON 파일을 병합하고 분류"""

    # 1. questions_rag_memory.json 로드 (275개)
    qa_memory = load_json_file("D:/mabiz-crm/docs/고객질문리스트/questions_rag_memory.json")
    print(f"Loaded questions_rag_memory.json: {len(qa_memory)} items")

    # 2. msc_2026_05_qa.json 로드 (145개)
    msc_qa = load_json_file("D:/mabiz-crm/docs/고객질문리스트/msc_2026_05_qa.json")
    print(f"Loaded msc_2026_05_qa.json: {len(msc_qa)} items")

    # 데이터 통합
    all_items = []

    # questions_rag_memory 항목들 추가
    for item in qa_memory:
        all_items.append({
            "id": item.get("id", f"q_{len(all_items)}"),
            "question": item.get("question", ""),
            "answer": item.get("answer", ""),
            "original_category": item.get("category", "기타"),
            "source": item.get("source", "questions_rag_memory")
        })

    # msc_2026_05_qa 항목들 추가
    for item in msc_qa:
        all_items.append({
            "id": item.get("id", item.get("key", f"q_{len(all_items)}")),
            "question": item.get("question", ""),
            "answer": item.get("answer", ""),
            "original_category": item.get("category", "기타"),
            "source": item.get("source", "msc_2026_05_qa")
        })

    # 중복 제거 (id 기준)
    seen = set()
    unique_items = []
    for item in all_items:
        if item["id"] not in seen:
            seen.add(item["id"])
            unique_items.append(item)

    print(f"Total unique items after merge: {len(unique_items)}")

    # 3. 분류 진행
    classified = {
        "phase": "여행중",
        "source_files": [
            "questions_rag_memory.json (275개)",
            "msc_2026_05_qa.json (145개)"
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
            "total": len(unique_items),
            "by_category": {},
            "unclassified": 0
        }
    }

    # 분류 진행
    for item in unique_items:
        q_text = item.get("question", "")
        a_text = item.get("answer", "")
        combined_text = f"{q_text} {a_text}"

        # 카테고리 결정
        category = get_main_category(combined_text)

        # 분류된 항목 추가
        classified["categories"][category].append({
            "id": item["id"],
            "question": q_text[:150] + ("..." if len(q_text) > 150 else ""),
            "original_category": item.get("original_category", ""),
            "assigned_category": category,
            "source": item.get("source", "")
        })

    # 통계 계산
    for cat, items in classified["categories"].items():
        count = len(items)
        classified["stats"]["by_category"][cat] = count
        if cat == "기타":
            classified["stats"]["unclassified"] = count

    # 출력 파일 저장
    output_file = Path("D:/mabiz-crm/docs/고객질문리스트/classified_duringtravel_merged.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(classified, f, ensure_ascii=False, indent=2)

    print(f"\n분류 완료: {output_file}")
    print(f"\n분류 통계:")
    print(f"  총 데이터: {classified['stats']['total']}")
    for cat, count in classified["stats"]["by_category"].items():
        pct = (count / classified['stats']['total'] * 100) if classified['stats']['total'] > 0 else 0
        print(f"  - {cat}: {count} ({pct:.1f}%)")

    return classified

if __name__ == "__main__":
    result = merge_and_classify()
