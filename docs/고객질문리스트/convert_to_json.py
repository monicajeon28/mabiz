#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
questions_consolidated.csv → IndexedDB용 JSON 변환
- 메모리 최적화 (각 항목 ~500B)
- 벡터 검색용 메타데이터 포함
- 카테고리별 인덱싱
"""

import csv
import json
import hashlib
from pathlib import Path

def csv_to_json(csv_file, json_file):
    """CSV → JSON 변환"""

    questions = []
    category_index = {}

    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            q_id = row['id']
            category = row['category']

            # 각 항목을 JSON으로 변환
            item = {
                'id': q_id,
                'question': row['question'].strip(),
                'answer': row['answer'].strip(),
                'category': category,
                'source': row['source'],
                'type': row['type'],
                # 벡터 검색용 메타데이터
                'keywords': extract_keywords(row['question']),
                'length': len(row['answer']),
                'hash': hashlib.md5(row['question'].encode()).hexdigest()[:8]
            }

            questions.append(item)

            # 카테고리 인덱싱
            if category not in category_index:
                category_index[category] = []
            category_index[category].append(q_id)

    # 최종 JSON 구조
    output = {
        'version': '1.0',
        'updated': '2026-05-16',
        'total': len(questions),
        'categories': list(category_index.keys()),
        'questions': questions,
        'index': {
            'by_category': category_index,
        }
    }

    # 파일 저장
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    return output

def extract_keywords(text):
    """질문에서 주요 키워드 추출 (4글자 이상)"""
    words = text.split()
    keywords = [w for w in words if len(w) >= 4][:5]  # 최대 5개
    return keywords

# 실행
if __name__ == "__main__":
    csv_file = "questions_consolidated.csv"
    json_file = "questions_rag_memory.json"

    print(f"\n변환 중: {csv_file} → {json_file}\n")

    result = csv_to_json(csv_file, json_file)

    # 파일 크기 확인
    file_size = Path(json_file).stat().st_size / 1024 / 1024  # MB
    print(f"완료: {json_file}")
    print(f"  항목: {result['total']}개")
    print(f"  크기: {file_size:.2f} MB")
    print(f"  카테고리: {', '.join(result['categories'])}")
    print(f"\n샘플 (첫 항목):")
    if result['questions']:
        q = result['questions'][0]
        print(f"  ID: {q['id']}")
        print(f"  Q: {q['question'][:60]}...")
        print(f"  A: {q['answer'][:60]}...")
        print(f"  카테고리: {q['category']}")
        print(f"  키워드: {q['keywords']}")
