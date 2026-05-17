#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
import json
import sys
from pathlib import Path
from collections import defaultdict

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def extract_script_data_from_html(html_path):
    """HTML 콜스크립트 파일에서 데이터 추출"""
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    scripts = []
    table_matches = re.findall(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)

    for table_idx, table in enumerate(table_matches):
        # 제목 추출
        title_match = re.search(r'<h[234][^>]*>(.*?)</h[234]>', table)
        title = title_match.group(1).strip() if title_match else f"Table_{table_idx}"
        title = re.sub(r'<[^>]+>', '', title).strip()

        # 테이블 본문 행 추출
        tbody = re.search(r'<tbody[^>]*>(.*?)</tbody>', table, re.DOTALL)
        rows_html = tbody.group(1) if tbody else table

        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', rows_html, re.DOTALL)

        for row_idx, row in enumerate(rows):
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
            cells = [re.sub(r'<[^>]+>', '', cell).strip() for cell in cells]

            if cells and any(c for c in cells):
                scripts.append({
                    'table_id': table_idx,
                    'table_title': title,
                    'row_id': row_idx,
                    'cells': cells,
                    'raw_text': ' | '.join(cells),
                })

    return scripts

def extract_sales_tones(scripts):
    """스크립트에서 판매톤 특징 추출"""
    tones = {}
    tone_keywords = {
        'friendly': ['안녕', '감사', '예', '좋아', '함께', '~~', '^^', '반갑'],
        'professional': ['정책', '규정', '법적', '증명', '따라', '그러므', '이에'],
        'urgent': ['지금', '오늘', '급', '빨리', '당장', '서둘', '내일'],
        'empathetic': ['이해', '공감', '걱정', '도움', '힘들', '어려'],
        'factual': ['데이터', '결과', '통계', '비교', '분석', '구체'],
        'solution': ['해결', '개선', '최적', '효과', '추천', '도움'],
        'casual': ['ㅋ', '진짜', '완전', '너무'],
        'formal': ['존경', '정중', '인사', '경의'],
    }

    for script in scripts:
        raw = script['raw_text'].lower()
        detected = []

        for tone_name, keywords in tone_keywords.items():
            count = sum(1 for kw in keywords if kw.lower() in raw)
            if count > 0:
                detected.append({'tone': tone_name, 'score': count})

        if detected:
            detected.sort(key=lambda x: x['score'], reverse=True)
            primary = detected[0]['tone']
            key = script['raw_text'][:100]
            if key not in tones:
                tones[key] = {
                    'primary_tone': primary,
                    'table_title': script['table_title'],
                    'all_tones': detected
                }

    return tones

def load_and_update_rag(json_path, sales_tones):
    """RAG 메모리 로드 및 sales_tone 추가"""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = data.get('questions', [])
    tone_mapping = {
        'friendly': ['안녕', '감사', '예', '좋아'],
        'professional': ['정책', '규정', '법적'],
        'urgent': ['지금', '오늘', '급', '빨리'],
        'empathetic': ['이해', '공감', '도움'],
        'factual': ['데이터', '결과', '통계'],
        'solution': ['해결', '개선', '추천'],
        'casual': ['ㅋ', '진짜', '완전'],
        'formal': ['존경', '정중'],
    }

    for q in questions:
        q_text = (q.get('question', '') + ' ' + q.get('answer', '')).lower()
        detected = []

        for tone, keywords in tone_mapping.items():
            score = sum(1 for kw in keywords if kw.lower() in q_text)
            if score > 0:
                detected.append({'tone': tone, 'score': score})

        if detected:
            detected.sort(key=lambda x: x['score'], reverse=True)
            q['sales_tone'] = {
                'primary': detected[0]['tone'],
                'secondary': [t['tone'] for t in detected[1:3]],
                'confidence': min(detected[0]['score'] / 3.0, 1.0)
            }
        else:
            q['sales_tone'] = {'primary': 'neutral', 'secondary': [], 'confidence': 0}

    data['questions'] = questions
    return data, questions

def create_training_set(questions):
    """학습 데이터셋 생성"""
    training = {
        'version': '1.0',
        'created': '2026-05-17',
        'tones': ['friendly', 'professional', 'urgent', 'empathetic', 'factual', 'solution', 'casual', 'formal'],
        'samples': []
    }

    for q in questions:
        if q.get('sales_tone', {}).get('primary') != 'neutral':
            sample = {
                'id': q.get('id'),
                'question': q.get('question', '')[:300],
                'answer': q.get('answer', '')[:400],
                'category': q.get('category'),
                'primary_tone': q['sales_tone']['primary'],
                'secondary_tones': q['sales_tone'].get('secondary', []),
                'confidence': round(q['sales_tone'].get('confidence', 0), 2),
            }
            training['samples'].append(sample)

    training['total_samples'] = len(training['samples'])
    return training

def main():
    base = Path(r"D:\mabiz-crm\docs")

    print("\n" + "="*60)
    print("SALES TONE TRAINING DATA PREPARATION")
    print("="*60)

    # Step 1: Extract from HTML
    print("\n[STEP 1] Extract call script data...")
    html_file = base / "렌탈 콜 스크립트" / "docs" / "work_orders" / "크루즈닷_콜스크립트_뷰어.html"

    if html_file.exists():
        scripts = extract_script_data_from_html(str(html_file))
        print(f"  Status: Extracted {len(scripts)} script rows")

        # Stats
        tables = defaultdict(int)
        for s in scripts:
            tables[s['table_title']] += 1

        print("\n  Script distribution by table:")
        for table, count in sorted(tables.items()):
            print(f"    - {table}: {count} rows")
    else:
        print(f"  Error: File not found")
        scripts = []

    # Step 2: Extract tones
    print("\n[STEP 2] Extract sales tones...")
    tones = extract_sales_tones(scripts)
    print(f"  Status: Identified {len(tones)} unique tone patterns")

    # Step 3: Update RAG memory
    print("\n[STEP 3] Update RAG memory...")
    rag_file = base / "고객질문리스트" / "questions_rag_memory.json"

    if rag_file.exists():
        updated_rag, updated_questions = load_and_update_rag(str(rag_file), tones)
        print(f"  Status: Processed {len(updated_questions)} questions")

        # Save updated RAG
        output_rag = base / "고객질문리스트" / "questions_rag_memory_with_tone.json"
        with open(str(output_rag), 'w', encoding='utf-8') as f:
            json.dump(updated_rag, f, ensure_ascii=False, indent=2)
        print(f"  Saved: {output_rag.name}")

        # Tone distribution
        tone_dist = defaultdict(int)
        for q in updated_questions:
            if q.get('sales_tone'):
                tone_dist[q['sales_tone']['primary']] += 1

        print("\n  Tone distribution in questions:")
        for tone, count in sorted(tone_dist.items(), key=lambda x: x[1], reverse=True):
            print(f"    - {tone}: {count} questions")
    else:
        print(f"  Error: RAG file not found")
        updated_questions = []

    # Step 4: Create training dataset
    print("\n[STEP 4] Create training dataset...")
    if updated_questions:
        training = create_training_set(updated_questions)
        output_train = base / "고객질문리스트" / "sales_tone_training.json"
        with open(str(output_train), 'w', encoding='utf-8') as f:
            json.dump(training, f, ensure_ascii=False, indent=2)
        print(f"  Status: Created {training['total_samples']} training samples")
        print(f"  Saved: {output_train.name}")

        # Summary
        print("\n" + "="*60)
        print("SUMMARY")
        print("="*60)
        print(f"Total questions processed: {len(updated_questions)}")
        print(f"Questions with tone: {sum(1 for q in updated_questions if q.get('sales_tone'))}")
        print(f"Training samples: {training['total_samples']}")
        print(f"Tone types: {len(training['tones'])}")
        print("\nOutput files created:")
        print(f"  1. {output_rag.name}")
        print(f"  2. {output_train.name}")
        print("="*60 + "\n")
    else:
        print("  Error: No questions to process")

if __name__ == '__main__':
    main()
