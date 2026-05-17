#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
세일즈봇용 상품 정보 연동 - 질문과 상품 자동 매핑
"""

import json
import re
import csv
from pathlib import Path
from typing import List, Dict, Tuple

# 상품 키워드 매핑 (질문 → 상품 ID/카테고리)
PRODUCT_KEYWORDS = {
    # TIP 관련
    '팁': {'product_id': 320, 'category': 'TIP', 'relevance': 0.95},
    '선상팁': {'product_id': 320, 'category': 'TIP', 'relevance': 0.95},
    '선팁': {'product_id': 320, 'category': 'TIP', 'relevance': 0.90},
    'tip': {'product_id': 320, 'category': 'TIP', 'relevance': 0.85},

    # 객실 관련
    '객실': {'product_id': None, 'category': 'Room', 'relevance': 0.95},
    '방': {'product_id': None, 'category': 'Room', 'relevance': 0.70},
    '캐빈': {'product_id': None, 'category': 'Cabin', 'relevance': 0.95},
    'cabin': {'product_id': None, 'category': 'Cabin', 'relevance': 0.85},
    '침실': {'product_id': None, 'category': 'Room', 'relevance': 0.80},

    # 식사 & 음료
    '식사': {'product_id': None, 'category': 'Dining', 'relevance': 0.90},
    '음료': {'product_id': None, 'category': 'Beverage', 'relevance': 0.90},
    '냉장고': {'product_id': None, 'category': 'Beverage', 'relevance': 0.75},
    '뷔페': {'product_id': None, 'category': 'Dining', 'relevance': 0.85},
    '정찬': {'product_id': None, 'category': 'Dining', 'relevance': 0.85},
    '레스토랑': {'product_id': None, 'category': 'Dining', 'relevance': 0.85},
    '카페': {'product_id': None, 'category': 'Beverage', 'relevance': 0.75},

    # 활동 & 엔터테인먼트
    '공연': {'product_id': None, 'category': 'Activity', 'relevance': 0.85},
    '쉽투어': {'product_id': None, 'category': 'Activity', 'relevance': 0.90},
    '활동': {'product_id': None, 'category': 'Activity', 'relevance': 0.80},
    '투어': {'product_id': None, 'category': 'Activity', 'relevance': 0.85},
    '스파': {'product_id': None, 'category': 'Activity', 'relevance': 0.80},
    '사우나': {'product_id': None, 'category': 'Activity', 'relevance': 0.75},

    # 탑승 & 수속
    '탑승': {'product_id': None, 'category': 'Boarding', 'relevance': 0.85},
    '수속': {'product_id': None, 'category': 'Boarding', 'relevance': 0.85},
    '체크인': {'product_id': None, 'category': 'Boarding', 'relevance': 0.85},
    '짐': {'product_id': None, 'category': 'Boarding', 'relevance': 0.75},
    '여권': {'product_id': None, 'category': 'Document', 'relevance': 0.85},
    '티켓': {'product_id': None, 'category': 'Document', 'relevance': 0.80},

    # 기항지 & 투어
    '기항지': {'product_id': None, 'category': 'Port', 'relevance': 0.85},
    '항구': {'product_id': None, 'category': 'Port', 'relevance': 0.80},
    '도쿄': {'product_id': None, 'category': 'Destination', 'relevance': 0.85},
    '세부': {'product_id': None, 'category': 'Destination', 'relevance': 0.85},
    '홍콩': {'product_id': None, 'category': 'Destination', 'relevance': 0.85},

    # 카드 & 결제
    '카드': {'product_id': None, 'category': 'Card', 'relevance': 0.80},
    '신용카드': {'product_id': None, 'category': 'Card', 'relevance': 0.80},
    '객실카드': {'product_id': None, 'category': 'Card', 'relevance': 0.90},
    '크루즈카드': {'product_id': None, 'category': 'Card', 'relevance': 0.90},

    # 정책 & 수수료
    '정책': {'product_id': None, 'category': 'Policy', 'relevance': 0.75},
    '수수료': {'product_id': None, 'category': 'Policy', 'relevance': 0.80},
    '요금': {'product_id': None, 'category': 'Policy', 'relevance': 0.75},
}

def load_questions() -> List[Dict]:
    """questions_rag_memory.json 로드"""
    with open('questions_rag_memory.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['questions']

def extract_keywords(text: str) -> List[str]:
    """질문에서 키워드 추출"""
    text_lower = text.lower()
    keywords = []

    for keyword in PRODUCT_KEYWORDS.keys():
        if keyword in text_lower:
            keywords.append(keyword)

    return keywords

def match_products(question: Dict) -> List[Tuple[str, float, str]]:
    """
    질문과 관련된 상품 매치
    반환: [(product_id, relevance_score, category), ...]
    """
    question_text = question.get('question', '') + ' ' + question.get('answer', '')
    matched_products = []
    keywords = extract_keywords(question_text)

    # 이미 매치된 상품/카테고리 추적
    matched_categories = set()
    max_relevance_per_category = {}

    for keyword in keywords:
        if keyword in PRODUCT_KEYWORDS:
            product_info = PRODUCT_KEYWORDS[keyword]
            category = product_info['category']

            # 카테고리 중복 제거 (같은 카테고리는 최고 관련도만 보관)
            if category not in matched_categories:
                matched_categories.add(category)
                max_relevance_per_category[category] = product_info['relevance']
            else:
                max_relevance_per_category[category] = max(
                    max_relevance_per_category[category],
                    product_info['relevance']
                )

    # 결과 정리
    for category, relevance in max_relevance_per_category.items():
        # 상품 ID 찾기
        product_id = None
        for keyword in keywords:
            if PRODUCT_KEYWORDS[keyword]['category'] == category and PRODUCT_KEYWORDS[keyword]['product_id']:
                product_id = PRODUCT_KEYWORDS[keyword]['product_id']
                break

        matched_products.append((str(product_id) if product_id else category, relevance, category))

    return matched_products

def generate_csv_report():
    """CSV 보고서 생성"""
    questions = load_questions()

    rows = []
    rows.append(['question_id', 'question_text', 'category', 'product_ids', 'max_relevance', 'keywords_matched'])

    for q in questions:
        question_id = q['question_id'] if 'question_id' in q else q.get('id', '')
        question_text = q.get('question', '')[:100]
        q_category = q.get('category', '')

        matches = match_products(q)

        if matches:
            # 질문당 최대 관련도 점수
            max_relevance = max([m[1] for m in matches])
            # 매칭된 상품/카테고리
            product_refs = ', '.join([m[0] for m in matches])
            # 매칭된 카테고리
            matched_categories = ', '.join([m[2] for m in matches])

            rows.append([
                question_id,
                question_text.replace('"', '""'),
                q_category,
                product_refs,
                f"{max_relevance:.2f}",
                matched_categories
            ])
        else:
            rows.append([
                question_id,
                question_text.replace('"', '""'),
                q_category,
                "",
                "0.00",
                ""
            ])

    # CSV 작성
    with open('product_mapping.csv', 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    print(f"[DONE] product_mapping.csv generated ({len(questions)} questions)")
    print(f"   Location: {Path('product_mapping.csv').absolute()}")

    # Statistics
    matched_count = sum(1 for row in rows[1:] if row[3])
    print(f"[STATS] Matched questions: {matched_count}/{len(questions)} ({matched_count*100//len(questions)}%)")

def generate_json_report():
    """JSON 형식 상세 보고서"""
    questions = load_questions()

    report = {
        'generated_at': str(Path('questions_rag_memory.json').stat().st_mtime),
        'total_questions': len(questions),
        'mappings': []
    }

    for q in questions:
        question_id = q.get('id', '')
        matches = match_products(q)

        if matches:
            report['mappings'].append({
                'question_id': question_id,
                'question': q.get('question', '')[:100],
                'category': q.get('category', ''),
                'products': [
                    {
                        'product_id': m[0],
                        'relevance': round(m[1], 2),
                        'category': m[2]
                    } for m in matches
                ]
            })

    report['matched_count'] = len(report['mappings'])

    with open('product_mapping.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"[DONE] product_mapping.json generated")

if __name__ == '__main__':
    print("[START] Sales Bot Product Mapping Analysis\n")

    try:
        generate_csv_report()
        print()
        generate_json_report()
        print("\n[COMPLETE] All mapping tasks completed!")

    except FileNotFoundError as e:
        print(f"[ERROR] File not found: {e}")
    except Exception as e:
        print(f"[ERROR] Error occurred: {e}")
        import traceback
        traceback.print_exc()
