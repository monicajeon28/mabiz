#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from pathlib import Path
from typing import Dict, List, Any

# 분류 규칙 정의
CATEGORY_KEYWORDS = {
    "탑승/객실": [
        "탑승", "승선", "체크인", "객실", "카드", "미니바", "냉장고", "수건",
        "객실카드", "키카드", "키", "침구", "시설", "객실시설"
    ],
    "식사/음료": [
        "식당", "메뉴", "음료", "뷔페", "정찬", "식사", "조식", "저녁",
        "룸서비스", "룸 서비스", "알러지", "음식", "식음료", "바", "카페",
        "와인", "비어", "커피", "디저트", "스낵"
    ],
    "선상활동": [
        "공연", "풀장", "수영", "스파", "워터슬라이드", "키즈", "아이",
        "피트니스", "체육", "스포츠", "예약", "활동", "엔터테인먼트", "쇼",
        "클럽", "디스코", "시어터", "수상", "갑판"
    ],
    "기항지/투어": [
        "기항지", "도쿄", "고베", "고오베", "코오베", "부산", "투어", "관광",
        "하이라이트", "여행", "관광지", "현지", "항구", "상륙", "상륙투어",
        "도시", "관광명소", "갤러리", "박물관"
    ],
    "기술/편의": [
        "와이파이", "와이파이", "앱", "키오스크", "통신", "인터넷", "wi-fi",
        "네트워크", "신호", "안내데스크", "데스크", "헬프라인", "콜센터",
        "디지털", "전자", "어플리케이션"
    ],
    "하선/귀환": [
        "하선", "하기", "짐", "수하물", "귀환", "피드백", "피크", "하소",
        "종료", "끝", "귀가", "돌아", "떠나", "정박", "떨어지기"
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

def classify_questions():
    """564개 데이터를 분류"""
    input_file = Path("D:/mabiz-crm/docs/고객질문리스트/questions_rag_memory.json")
    output_file = Path("D:/mabiz-crm/docs/고객질문리스트/classified_duringtravel_564.json")

    if not input_file.exists():
        print(f"입력 파일 없음: {input_file}")
        return

    # 입력 파일 로드
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get("questions", [])
    print(f"총 {len(questions)}개 데이터 로드됨")

    # 분류 저장소 초기화
    classified = {
        "phase": "여행중",
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
            "total": len(questions),
            "classified": {},
            "unclassified": 0
        }
    }

    # 분류 진행
    for item in questions:
        q_text = item.get("question", "")
        a_text = item.get("answer", "")
        combined_text = f"{q_text} {a_text}"

        # 카테고리 결정
        category = get_main_category(combined_text)

        # 분류된 항목 추가
        classified["categories"][category].append({
            "id": item.get("id"),
            "question": q_text[:100] + ("..." if len(q_text) > 100 else ""),
            "original_category": item.get("category", ""),
            "assigned_category": category
        })

        if category != "기타":
            classified["stats"]["classified"][category] = classified["stats"]["classified"].get(category, 0) + 1
        else:
            classified["stats"]["unclassified"] += 1

    # 통계 계산
    classified["stats"]["total"] = len(questions)
    classified["stats"]["by_category"] = {
        cat: len(items) for cat, items in classified["categories"].items()
    }

    # 출력 파일 저장
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
    result = classify_questions()
