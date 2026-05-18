#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
564개 Q&A 데이터를 "여행전" 4개 소분류로 자동 분류
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

# 카테고리별 키워드 매핑
CATEGORY_KEYWORDS = {
    "예약/구매": [
        "구매", "예약", "가격", "할인", "결제", "취소", "환불", "변경",
        "결제수단", "신용카드", "계약", "계약금", "선금", "남은금액",
        "캐빈", "객실", "등급", "침대", "발코니", "스위트", "선택",
        "패키지", "옵션", "추가", "비용", "요금", "가격표", "선예약"
    ],
    "서류/준비": [
        "여권", "비자", "보험", "짐", "수하물", "복장", "옷", "신발",
        "약품", "의약품", "준비물", "짐 팍킹", "문서", "신분증",
        "미국비자", "ESTA", "서류", "증명서", "여행보험", "건강보험",
        "예방접종", "백신", "짐가방", "짐표", "체크인 수하물"
    ],
    "정보/상담": [
        "항차", "배", "선박", "크루즈", "항로", "항로맵", "경로", "일정",
        "기항지", "항구", "포트", "항해", "출발", "도착", "도시", "여행지",
        "기후", "날씨", "시간", "시간대", "시차", "통화", "환율",
        "정보", "안내", "상담", "확인", "알림", "공지", "중요", "주의",
        "식사", "음식", "뷔페", "식당", "메뉴", "음료", "와인", "술",
        "활동", "투어", "엑스커션", "선상활동", "스포츠", "오락"
    ],
    "앱/기술": [
        "앱", "애플리케이션", "설치", "다운로드", "로그인", "가입",
        "계정", "비밀번호", "사용자명", "ID", "프로필", "사진",
        "와이파이", "인터넷", "와이파이", "로밍", "통신", "데이터",
        "연결", "오류", "버그", "문제", "동작", "작동", "실행",
        "시스템", "기술", "온보드", "배포앱", "모바일", "웹"
    ]
}

# 역상 처리: 여행후 카테고리 키워드 (제외용)
POSTTRAVEL_KEYWORDS = [
    "탑승", "수속", "승선", "하선", "식사", "객실", "서빙", "카드",
    "손님", "승객", "크루", "스태프", "서비스", "모닝콜", "청소",
    "룸서비스", "드라이클리닝", "세탁", "짐", "짐운반", "벨보이",
    "의료", "의사", "간호사", "응급", "병원", "약국",
    "상점", "쇼핑", "면세점", "카지노", "게임",
    "선상", "배위", "갑판", "라운지", "바", "디스코", "공연",
    "사진사", "초상화", "기념사진", "인화",
    "체크아웃", "계산", "청구", "영수증", "정산"
]

def load_json_file(filepath: str) -> Dict[str, Any]:
    """JSON 파일 로드"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return {}

def extract_items_from_data(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """다양한 JSON 구조에서 Q&A 항목 추출"""
    items = []

    # 구조 1: questions 배열
    if "questions" in data and isinstance(data["questions"], list):
        items.extend(data["questions"])

    # 구조 2: items 배열
    if "items" in data and isinstance(data["items"], list):
        items.extend(data["items"])

    # 구조 3: 최상위 배열
    if isinstance(data, list):
        items.extend(data)

    return items

def is_pretravel_topic(item: Dict[str, Any]) -> bool:
    """여행전 관련 주제인지 판단"""
    question = item.get("question", "").lower() or ""
    answer = item.get("answer", "").lower() or ""
    category = item.get("category", "").lower() or ""

    combined = f"{question} {answer} {category}"

    # 여행후 키워드 확인 (제외)
    for keyword in POSTTRAVEL_KEYWORDS:
        if keyword.lower() in combined:
            return False

    return True

def classify_to_subcategory(item: Dict[str, Any]) -> str:
    """4개 소분류 중 1개 선택"""
    question = item.get("question", "").lower() or ""
    answer = item.get("answer", "").lower() or ""
    combined = f"{question} {answer}"

    # 점수 계산
    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in combined)
        scores[category] = score

    # 가장 높은 점수 반환
    if max(scores.values()) > 0:
        return max(scores, key=scores.get)
    else:
        return "기타"

def main():
    docs_dir = Path("docs/고객질문리스트")

    # 모든 JSON 파일 로드
    all_items = []
    json_files = list(docs_dir.glob("*.json"))
    print(f"Found {len(json_files)} JSON files")

    for json_file in json_files:
        print(f"Loading {json_file.name}...")
        data = load_json_file(str(json_file))
        if data:
            items = extract_items_from_data(data)
            print(f"  -> {len(items)} items")
            all_items.extend(items)

    print(f"\nTotal items loaded: {len(all_items)}")

    # 여행전 항목만 필터링
    pretravel_items = [item for item in all_items if is_pretravel_topic(item)]
    print(f"Pre-travel items: {len(pretravel_items)}")

    # 분류
    classified = defaultdict(list)
    unclassified = []

    for item in pretravel_items:
        subcategory = classify_to_subcategory(item)
        if subcategory == "기타":
            unclassified.append(item)
        else:
            classified[subcategory].append(item)

    # 통계
    stats = {
        "예약/구매": len(classified["예약/구매"]),
        "서류/준비": len(classified["서류/준비"]),
        "정보/상담": len(classified["정보/상담"]),
        "앱/기술": len(classified["앱/기술"]),
        "기타": len(unclassified)
    }

    # 결과 작성
    result = {
        "phase": "여행전",
        "total_items": len(pretravel_items),
        "categories": {
            "예약/구매": classified["예약/구매"],
            "서류/준비": classified["서류/준비"],
            "정보/상담": classified["정보/상담"],
            "앱/기술": classified["앱/기술"]
        },
        "unclassified": unclassified,
        "stats": stats
    }

    # 파일 저장
    output_file = docs_dir / "classified_pretravel_final.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nClassification complete!")
    print(f"Output: {output_file}")
    print("\nStatistics:")
    for category, count in stats.items():
        print(f"  {category}: {count}")

if __name__ == "__main__":
    main()
