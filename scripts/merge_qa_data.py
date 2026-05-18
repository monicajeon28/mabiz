#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
from datetime import datetime
from pathlib import Path

def normalize_text(text, max_length=None):
    """텍스트 정규화: 개행 제거, 공백 정리"""
    if not text:
        return ""
    # 여러 개 개행을 하나로, 모든 개행을 공백으로 변환
    normalized = text.replace('\n\n', '\n').replace('\n', ' ').strip()

    if max_length and len(normalized) > max_length:
        normalized = normalized[:max_length] + "..."
    return normalized

def validate_travel_phase(phase):
    """여행 단계 검증"""
    valid_phases = ['여행전', '여행중', '여행후']
    return phase if phase in valid_phases else '여행중'

def extract_keywords(text):
    """키워드 자동 추출"""
    if not text:
        return []

    keywords_patterns = {
        '크루즈': ['크루즈', 'MSC', '벨리시마', 'cruise'],
        '지역': ['도쿄', '고베', '부산', '가고시마', '일본', '도요', 'Terminal'],
        '시설': ['객실', '카드', '와이파이', '앱', '어플', '뷔페', '식당', '극장'],
        '음식': ['식사', '음료', '물', '정찬', '조식', '차', '커피', '주류'],
        '절차': ['탑승', '하선', '수속', '예약', '심사'],
    }

    found_keywords = set()
    text_lower = text.lower()

    for category_keywords in keywords_patterns.values():
        for keyword in category_keywords:
            if keyword.lower() in text_lower and len(found_keywords) < 5:
                found_keywords.add(keyword)

    return list(found_keywords)[:5]

def normalize_item(item):
    """개별 항목 정규화"""
    # 메모리 RAG 형식 지원 (sales_tone -> salesTone)
    sales_tone = item.get('salesTone')
    if not sales_tone and 'sales_tone' in item:
        if isinstance(item['sales_tone'], dict):
            sales_tone = item['sales_tone'].get('primary', 'neutral')
        else:
            sales_tone = item['sales_tone']

    keywords = item.get('keywords', [])
    if not keywords or not isinstance(keywords, list):
        keywords = extract_keywords(item.get('question', ''))

    return {
        'id': item.get('id', ''),
        'question': normalize_text(item.get('question', ''), 100),
        'answer': normalize_text(item.get('answer', ''), None),
        'keywords': keywords[:5],  # 최대 5개
        'travelPhase': validate_travel_phase(item.get('travelPhase', '여행중')),
        'type': item.get('type', '기타'),
        'category': item.get('category', '자동분류대기'),
        'source': item.get('source', 'MSC벨리시마'),
        'salesTone': sales_tone or 'neutral'
    }

def calculate_stats(data):
    """통계 계산"""
    if not data:
        return {}

    total = len(data)
    total_keywords = sum(len(item.get('keywords', [])) for item in data)
    total_question_len = sum(len(item.get('question', '')) for item in data)
    total_answer_len = sum(len(item.get('answer', '')) for item in data)

    travel_phase_dist = {
        '여행전': sum(1 for item in data if item.get('travelPhase') == '여행전'),
        '여행중': sum(1 for item in data if item.get('travelPhase') == '여행중'),
        '여행후': sum(1 for item in data if item.get('travelPhase') == '여행후'),
    }

    return {
        'avg_keywords': round(total_keywords / total, 2) if total > 0 else 0,
        'avg_question_length': round(total_question_len / total, 1) if total > 0 else 0,
        'avg_answer_length': round(total_answer_len / total, 1) if total > 0 else 0,
        'travel_phase_distribution': travel_phase_dist,
        'total_items': total
    }

def main():
    """메인 함수"""
    os.chdir('D:\\mabiz-crm')

    # XLSX 파일 목록
    xlsx_files = [
        'docs/고객질문리스트/msc2605_xlsx_problems_38.json',
        'docs/고객질문리스트/msc2605_xlsx_qa_71.json',
        'docs/고객질문리스트/msc2605_xlsx_tips_30.json',
        'docs/고객질문리스트/msc2605_xlsx_suggestions_30.json',
        'docs/고객질문리스트/msc2605_xlsx_notices_23.json',
        'docs/고객질문리스트/msc2605_xlsx_staff_4.json'
    ]

    rag_file = 'src/lib/data/questions_rag_memory_with_tone.json'

    # XLSX 파일 통합
    print('📖 XLSX 파일 읽기 시작...')
    merged_data = []
    xlsx_count = 0

    for file_path in xlsx_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = json.load(f)
                file_name = Path(file_path).name
                print(f"  ✓ {file_name}: {content.get('items', 0)}개")

                for item in content.get('data', []):
                    merged_data.append(normalize_item(item))
                    xlsx_count += 1
        except Exception as e:
            print(f"  ❌ {file_path} 읽기 실패: {e}")

    print(f"✅ XLSX 통합 완료: {xlsx_count}개\n")

    # 메모리 RAG 파일 통합
    print('📖 메모리 RAG 파일 읽기 시작...')
    rag_count = 0

    try:
        with open(rag_file, 'r', encoding='utf-8') as f:
            rag_content = json.load(f)
            print(f"  ✓ 메모리 RAG: {rag_content.get('total', 0)}개")

            for item in rag_content.get('questions', []):
                merged_data.append(normalize_item(item))
                rag_count += 1
    except Exception as e:
        print(f"  ❌ {rag_file} 읽기 실패: {e}")

    print(f"✅ 메모리 RAG 통합 완료: {rag_count}개\n")

    # 통계 계산
    total_count = xlsx_count + rag_count
    stats = calculate_stats(merged_data)

    # 출력 파일 생성
    output = {
        'total': total_count,
        'merged_at': datetime.now().isoformat(),
        'sources': [
            f'XLSX: {xlsx_count}개',
            f'Memory-RAG: {rag_count}개'
        ],
        'statistics': stats,
        'data': merged_data
    }

    output_path = 'docs/고객질문리스트/merged_564_raw.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 통계 출력
    print('📊 통계:')
    print(f"  • 총 항목: {stats['total_items']}개")
    print(f"  • 평균 키워드: {stats['avg_keywords']}개")
    print(f"  • 평균 question 길이: {stats['avg_question_length']}글자")
    print(f"  • 평균 answer 길이: {stats['avg_answer_length']}글자")
    print(f"  • travelPhase 분포:")
    for phase, count in stats['travel_phase_distribution'].items():
        print(f"    - {phase}: {count}개")

    # 파일 크기 확인
    file_size_kb = os.path.getsize(output_path) / 1024
    print(f"\n✅ 통합 완료: {output_path}")
    print(f"   파일 크기: {file_size_kb:.2f} KB")

if __name__ == '__main__':
    main()
