#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
세일즈봇 판매톤 데이터 추출 및 매칭 스크립트
- HTML 콜 스크립트에서 판매톤 추출
- questions_rag_memory.json에 sales_tone 필드 추가
- 새로운 training 데이터셋 생성
"""

import re
import json
import sys
import os
from pathlib import Path
from collections import defaultdict

# Windows 콘솔 인코딩 문제 해결
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ============================================================================
# 1. 콜스크립트 HTML 파일 분석
# ============================================================================

def extract_script_data_from_html(html_path):
    """HTML 콜스크립트 파일에서 데이터 추출"""
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    scripts = []

    # 테이블 추출 (각 테이블이 하나의 스크립트 카테고리)
    table_matches = re.findall(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)

    for table_idx, table in enumerate(table_matches):
        # 테이블 제목 추출
        title_match = re.search(r'<h[234][^>]*>(.*?)</h[234]>', table)
        title = title_match.group(1).strip() if title_match else f"Table_{table_idx}"
        title = re.sub(r'<[^>]+>', '', title).strip()

        # 테이블 헤더 추출
        header_row = re.search(r'<thead[^>]*>(.*?)</thead>', table, re.DOTALL)
        if header_row:
            headers = re.findall(r'<th[^>]*>(.*?)</th>', header_row.group(1), re.DOTALL)
            headers = [re.sub(r'<[^>]+>', '', h).strip() for h in headers]
        else:
            headers = []

        # 본문 행 추출
        tbody = re.search(r'<tbody[^>]*>(.*?)</tbody>', table, re.DOTALL)
        if tbody:
            rows_html = tbody.group(1)
        else:
            rows_html = table

        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', rows_html, re.DOTALL)

        for row_idx, row in enumerate(rows):
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
            cells = [re.sub(r'<[^>]+>', '', cell).strip() for cell in cells]

            if cells:
                scripts.append({
                    'table_id': table_idx,
                    'table_title': title,
                    'row_id': row_idx,
                    'cells': cells,
                    'raw_text': ' | '.join(cells),
                    'headers': headers if headers else [f'col_{i}' for i in range(len(cells))]
                })

    return scripts

def extract_sales_tones(scripts):
    """추출된 스크립트에서 판매톤(tone) 특징 추출"""
    tones = {}

    tone_keywords = {
        'friendly': ['안녕하세요', '예', '네', '좋아요', '~~', '^^', 'ㅎㅎ', '감사', '기뻐'],
        'professional': ['따라서', '그러므로', '이에', '증명하', '법적', '정책', '규정'],
        'urgent': ['지금', '오늘', '당장', '빨리', '급', '서둘러', '서두', '내일'],
        'empathetic': ['이해', '공감', '걱정', '힘들', '어려', '도와', '함께'],
        'factual': ['데이터', '통계', '결과', '분석', '비교', '차이', '구체적'],
        'solution_oriented': ['해결', '개선', '최적', '효과', '성능', '도움', '추천'],
        'casual': ['ㅋㅋ', '헐', 'ㄹㅇ', '진짜', '완전', '너무', 'ㅇㅈ'],
        'formal': ['존경', '존중', '정중', '인사', '경의', '최고', '귀중'],
    }

    for script in scripts:
        raw = script['raw_text'].lower()
        detected_tones = []

        for tone_name, keywords in tone_keywords.items():
            count = sum(1 for kw in keywords if kw.lower() in raw)
            if count > 0:
                detected_tones.append({
                    'tone': tone_name,
                    'score': count,
                    'keyword_matches': [kw for kw in keywords if kw.lower() in raw]
                })

        if detected_tones:
            detected_tones.sort(key=lambda x: x['score'], reverse=True)
            tones[script['raw_text'][:100]] = {
                'primary_tone': detected_tones[0]['tone'],
                'all_tones': detected_tones,
                'table_id': script['table_id'],
                'table_title': script['table_title']
            }

    return tones

# ============================================================================
# 2. 기존 questions_rag_memory.json 로드 및 sales_tone 추가
# ============================================================================

def load_rag_memory(json_path):
    """기존 RAG 메모리 로드"""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def add_sales_tone_to_questions(questions, sales_tones):
    """질문 데이터에 sales_tone 필드 추가"""

    # 질문-톤 매칭을 위한 키워드 맵
    tone_mapping = {
        'friendly': ['안녕', '감사', '예', '좋아', '함께'],
        'professional': ['정책', '규정', '법적', '증명'],
        'urgent': ['지금', '오늘', '급', '빨리'],
        'empathetic': ['이해', '공감', '걱정', '도움'],
        'factual': ['데이터', '결과', '통계', '비교'],
        'solution_oriented': ['해결', '개선', '도움', '추천'],
        'casual': ['ㅋㅋ', '진짜', '완전'],
        'formal': ['존경', '정중', '인사']
    }

    for question in questions:
        q_text = (question.get('question', '') + ' ' + question.get('answer', '')).lower()

        # 톤 감지
        detected = []
        for tone, keywords in tone_mapping.items():
            score = sum(1 for kw in keywords if kw.lower() in q_text)
            if score > 0:
                detected.append({'tone': tone, 'score': score})

        if detected:
            detected.sort(key=lambda x: x['score'], reverse=True)
            question['sales_tone'] = {
                'primary': detected[0]['tone'],
                'secondary': [t['tone'] for t in detected[1:3]],
                'scores': {t['tone']: t['score'] for t in detected},
                'confidence': min(detected[0]['score'] / 5.0, 1.0)
            }
        else:
            question['sales_tone'] = {
                'primary': 'neutral',
                'secondary': [],
                'scores': {},
                'confidence': 0
            }

    return questions

# ============================================================================
# 3. 판매톤 학습 데이터셋 생성
# ============================================================================

def create_training_dataset(questions_with_tone):
    """판매톤 학습 데이터셋 생성"""

    training_data = {
        'version': '1.0',
        'created': '2026-05-16',
        'total_samples': len([q for q in questions_with_tone if q.get('sales_tone')]),
        'tones': ['friendly', 'professional', 'urgent', 'empathetic', 'factual', 'solution_oriented', 'casual', 'formal'],
        'samples': []
    }

    for q in questions_with_tone:
        if q.get('sales_tone', {}).get('primary') != 'neutral':
            sample = {
                'id': q.get('id'),
                'question': q.get('question', '')[:200],
                'answer': q.get('answer', '')[:300],
                'category': q.get('category'),
                'primary_tone': q['sales_tone']['primary'],
                'secondary_tones': q['sales_tone'].get('secondary', []),
                'tone_scores': q['sales_tone'].get('scores', {}),
                'confidence': q['sales_tone'].get('confidence', 0),
                'source': q.get('source'),
                'type': q.get('type')
            }
            training_data['samples'].append(sample)

    return training_data

# ============================================================================
# 4. 메인 실행
# ============================================================================

def main():
    base_path = Path(r"D:\mabiz-crm\docs")

    print("=" * 80)
    print("Sales Tone Training Data Preparation")
    print("=" * 80)

    # Step 1: 콜스크립트 HTML 분석
    print("\n[Step 1] Analyzing Call Script HTML...")
    html_path = base_path / "렌탈 콜 스크립트" / "docs" / "work_orders" / "크루즈닷_콜스크립트_뷰어.html"

    if html_path.exists():
        scripts = extract_script_data_from_html(str(html_path))
        print(f"  OK: Extracted {len(scripts)} script rows")

        # 테이블별 통계
        table_stats = defaultdict(int)
        for script in scripts:
            table_stats[script['table_title']] += 1

        print("\n  테이블별 스크립트 행 수:")
        for table_title, count in sorted(table_stats.items()):
            print(f"    - {table_title}: {count}행")
    else:
        print(f"  ✗ 파일을 찾을 수 없음: {html_path}")
        scripts = []

    # Step 2: 판매톤 추출
    print("\n[Step 2] 판매톤 특징 추출...")
    sales_tones = extract_sales_tones(scripts)
    print(f"  ✓ {len(sales_tones)}개 고유 판매톤 패턴 식별")

    if sales_tones:
        tone_counts = defaultdict(int)
        for tone_data in sales_tones.values():
            tone_counts[tone_data['primary_tone']] += 1
        print("\n  주요 톤 분포:")
        for tone, count in sorted(tone_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"    - {tone}: {count}개")

    # Step 3: 기존 RAG 메모리 로드 및 업데이트
    print("\n[Step 3] 기존 RAG 메모리 업데이트...")
    rag_path = base_path / "고객질문리스트" / "questions_rag_memory.json"

    if rag_path.exists():
        rag_data = load_rag_memory(str(rag_path))
        questions = rag_data.get('questions', [])
        print(f"  ✓ {len(questions)}개 질문 로드")

        # sales_tone 추가
        updated_questions = add_sales_tone_to_questions(questions, sales_tones)

        # 통계
        tone_dist = defaultdict(int)
        for q in updated_questions:
            if q.get('sales_tone'):
                tone_dist[q['sales_tone']['primary']] += 1

        print("\n  추가된 sales_tone 분포:")
        for tone, count in sorted(tone_dist.items(), key=lambda x: x[1], reverse=True):
            print(f"    - {tone}: {count}개")

        # 업데이트된 RAG 데이터 저장
        rag_data['questions'] = updated_questions
        updated_rag_path = base_path / "고객질문리스트" / "questions_rag_memory_with_tone.json"
        with open(str(updated_rag_path), 'w', encoding='utf-8') as f:
            json.dump(rag_data, f, ensure_ascii=False, indent=2)
        print(f"  ✓ 업데이트된 파일 저장: questions_rag_memory_with_tone.json")
    else:
        print(f"  ✗ RAG 메모리 파일을 찾을 수 없음: {rag_path}")
        updated_questions = []

    # Step 4: 판매톤 학습 데이터셋 생성
    print("\n[Step 4] 판매톤 학습 데이터셋 생성...")
    training_data = create_training_dataset(updated_questions)
    print(f"  ✓ {training_data['total_samples']}개 학습 샘플 준비")

    # 저장
    training_path = base_path / "고객질문리스트" / "sales_tone_training.json"
    with open(str(training_path), 'w', encoding='utf-8') as f:
        json.dump(training_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ 학습 데이터셋 저장: sales_tone_training.json")

    # Step 5: 요약 리포트 생성
    print("\n[Step 5] 요약 리포트 생성...")
    report = {
        'timestamp': '2026-05-16',
        'summary': {
            'total_questions_processed': len(updated_questions),
            'questions_with_tone': sum(1 for q in updated_questions if q.get('sales_tone')),
            'total_training_samples': training_data['total_samples'],
            'unique_tones': len(training_data['tones']),
            'tones': training_data['tones']
        },
        'tone_distribution': dict(tone_dist),
        'script_statistics': {
            'total_script_rows': len(scripts),
            'table_breakdown': dict(table_stats) if table_stats else {}
        },
        'output_files': [
            'questions_rag_memory_with_tone.json - RAG 메모리 + sales_tone 필드',
            'sales_tone_training.json - 판매톤 학습 데이터셋'
        ]
    }

    report_path = base_path / "고객질문리스트" / "sales_tone_report.json"
    with open(str(report_path), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"  ✓ 리포트 저장: sales_tone_report.json")

    # 최종 출력
    print("\n" + "=" * 80)
    print("완료! 생성된 파일:")
    print("=" * 80)
    print(f"1. questions_rag_memory_with_tone.json ({rag_path.parent})")
    print(f"2. sales_tone_training.json ({training_path.parent})")
    print(f"3. sales_tone_report.json ({report_path.parent})")
    print("\n요약:")
    print(f"  - 처리된 질문: {report['summary']['total_questions_processed']}개")
    print(f"  - 판매톤 추가: {report['summary']['questions_with_tone']}개")
    print(f"  - 학습 샘플: {report['summary']['total_training_samples']}개")
    print(f"  - 식별된 톤: {', '.join(report['summary']['tones'])}")
    print("=" * 80)

if __name__ == '__main__':
    main()
