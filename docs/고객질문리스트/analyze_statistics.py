#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
상품 매핑 통계 분석 - product_mapping.csv/json 기반
"""

import json
import csv
from pathlib import Path
from collections import defaultdict, Counter
from typing import Dict, List, Tuple

def load_csv_mapping() -> List[Dict]:
    """CSV 매핑 데이터 로드"""
    rows = []
    with open('product_mapping.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return rows

def load_questions() -> Dict:
    """원본 질문 데이터 로드"""
    with open('questions_rag_memory.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def analyze_coverage():
    """매핑 커버리지 분석"""
    rows = load_csv_mapping()
    questions = load_questions()

    # 기본 통계
    total = len(rows)
    matched = sum(1 for r in rows if r['product_ids'].strip())
    unmatched = total - matched

    print("[COVERAGE ANALYSIS]")
    print(f"Total Questions: {total}")
    print(f"Matched: {matched} ({100*matched/total:.1f}%)")
    print(f"Unmatched: {unmatched} ({100*unmatched/total:.1f}%)")
    print()

    # 카테고리별 매치율
    category_stats = defaultdict(lambda: {'total': 0, 'matched': 0})
    for row in rows:
        cat = row['category']
        category_stats[cat]['total'] += 1
        if row['product_ids'].strip():
            category_stats[cat]['matched'] += 1

    print("[CATEGORY BREAKDOWN]")
    for cat in sorted(category_stats.keys()):
        stats = category_stats[cat]
        rate = 100 * stats['matched'] / stats['total']
        print(f"  {cat}: {stats['matched']}/{stats['total']} ({rate:.0f}%)")
    print()

def analyze_relevance():
    """관련도 점수 분석"""
    rows = load_csv_mapping()

    # 점수별 분포
    score_ranges = {
        '0.95-1.00': 0,
        '0.85-0.94': 0,
        '0.75-0.84': 0,
        '0.70-0.74': 0,
        '0.00-0.69': 0,
    }

    scores = []
    for row in rows:
        if row['product_ids'].strip():
            score = float(row['max_relevance'])
            scores.append(score)

            if score >= 0.95:
                score_ranges['0.95-1.00'] += 1
            elif score >= 0.85:
                score_ranges['0.85-0.94'] += 1
            elif score >= 0.75:
                score_ranges['0.75-0.84'] += 1
            elif score >= 0.70:
                score_ranges['0.70-0.74'] += 1
            else:
                score_ranges['0.00-0.69'] += 1

    print("[RELEVANCE SCORE DISTRIBUTION]")
    for range_label, count in score_ranges.items():
        pct = 100 * count / len(scores) if scores else 0
        print(f"  {range_label}: {count} ({pct:.1f}%)")

    if scores:
        print(f"  Average: {sum(scores)/len(scores):.2f}")
        print(f"  Median: {sorted(scores)[len(scores)//2]:.2f}")
        print(f"  Min: {min(scores):.2f}")
        print(f"  Max: {max(scores):.2f}")
    print()

def analyze_categories():
    """매핑 카테고리별 통계"""
    with open('product_mapping.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    category_counter = Counter()
    relevance_by_category = defaultdict(list)

    for mapping in data['mappings']:
        for product in mapping['products']:
            category = product['category']
            category_counter[category] += 1
            relevance_by_category[category].append(product['relevance'])

    print("[PRODUCT CATEGORY STATISTICS]")
    for category, count in category_counter.most_common():
        relevances = relevance_by_category[category]
        avg_rel = sum(relevances) / len(relevances)
        print(f"  {category}: {count} matches, avg relevance {avg_rel:.2f}")
    print()

def analyze_products():
    """상품 ID별 분석 (TIP 상품 등)"""
    with open('product_mapping.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    product_ids = Counter()
    for mapping in data['mappings']:
        for product in mapping['products']:
            product_ids[product['product_id']] += 1

    print("[PRODUCT ID DISTRIBUTION]")
    for prod_id, count in product_ids.most_common(10):
        print(f"  Product {prod_id}: {count} references")
    print()

def generate_summary_stats():
    """요약 통계 생성"""
    rows = load_csv_mapping()
    questions = load_questions()

    matched = sum(1 for r in rows if r['product_ids'].strip())
    avg_score = sum(float(r['max_relevance']) for r in rows if r['product_ids'].strip()) / matched

    summary = {
        'total_questions': len(rows),
        'matched_count': matched,
        'unmatched_count': len(rows) - matched,
        'match_rate': f"{100*matched/len(rows):.1f}%",
        'average_relevance': f"{avg_score:.2f}",
        'analysis_date': '2026-05-17',
    }

    with open('mapping_statistics.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("[SUMMARY]")
    for key, value in summary.items():
        print(f"  {key}: {value}")

if __name__ == '__main__':
    print("=== PRODUCT MAPPING STATISTICS ANALYSIS ===\n")

    try:
        analyze_coverage()
        analyze_relevance()
        analyze_categories()
        analyze_products()
        generate_summary_stats()

        print("\n[SUCCESS] Statistics generation complete")
        print("Output files: mapping_statistics.json")

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
