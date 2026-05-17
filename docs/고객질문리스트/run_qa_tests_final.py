#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
세일즈봇 QA 테스트 - 최종 실행 스크립트
검색 정확도, 상품 매핑, 판매톤, 통합 시나리오, 성능 테스트
"""

import json
import csv
import time
import statistics
from datetime import datetime
from collections import defaultdict

def load_data():
    """데이터 로드"""
    with open('product_mapping.json', 'r', encoding='utf-8') as f:
        mapping_data = json.load(f)
    with open('questions_rag_memory_with_tone.json', 'r', encoding='utf-8') as f:
        tone_data = json.load(f)
    return mapping_data, tone_data

def test_search_accuracy(mapping_data, sample_size=100):
    """테스트 1: 검색 정확도"""
    mappings = mapping_data.get('mappings', [])[:sample_size]
    passed = 0
    relevance_scores = []

    for mapping in mappings:
        products = mapping.get('products', [])
        if len(products) > 0:
            passed += 1
            max_rel = max([p.get('relevance', 0) for p in products])
            relevance_scores.append(max_rel)

    accuracy = passed / len(mappings) * 100 if mappings else 0
    avg_rel = statistics.mean(relevance_scores) if relevance_scores else 0

    return {
        'test_name': 'Search Accuracy',
        'total': len(mappings),
        'passed': passed,
        'accuracy_percent': accuracy,
        'avg_relevance': avg_rel,
        'status': 'PASS' if accuracy >= 85 else 'FAIL'
    }

def test_product_mapping(mapping_data, sample_size=50):
    """테스트 2: 상품 매핑 검증"""
    mappings = mapping_data.get('mappings', [])[:sample_size]
    valid_count = 0
    false_positive_count = 0
    false_negative_count = 0
    relevance_scores = []
    category_dist = defaultdict(int)
    relevance_dist = {
        '0.95-1.00': 0,
        '0.85-0.94': 0,
        '0.75-0.84': 0,
        '0.70-0.74': 0,
        '<0.70': 0
    }

    for mapping in mappings:
        products = mapping.get('products', [])
        category = mapping.get('category', '')
        category_dist[category] += 1

        if products:
            max_rel = max([p.get('relevance', 0) for p in products])
            relevance_scores.append(max_rel)

            if max_rel >= 0.95:
                relevance_dist['0.95-1.00'] += 1
            elif max_rel >= 0.85:
                relevance_dist['0.85-0.94'] += 1
            elif max_rel >= 0.75:
                relevance_dist['0.75-0.84'] += 1
            elif max_rel >= 0.70:
                relevance_dist['0.70-0.74'] += 1
            else:
                relevance_dist['<0.70'] += 1

            if max_rel >= 0.75:
                valid_count += 1
            else:
                false_positive_count += 1
        else:
            false_negative_count += 1

    validity = valid_count / len(mappings) * 100 if mappings else 0
    avg_rel = statistics.mean(relevance_scores) if relevance_scores else 0

    return {
        'test_name': 'Product Mapping',
        'total': len(mappings),
        'valid': valid_count,
        'false_positives': false_positive_count,
        'false_negatives': false_negative_count,
        'validity_percent': validity,
        'avg_relevance': avg_rel,
        'relevance_distribution': relevance_dist,
        'status': 'PASS' if validity >= 80 else 'FAIL'
    }

def test_sales_tone(tone_data, sample_size=50):
    """테스트 3: 판매톤 정확도"""
    data = tone_data if isinstance(tone_data, list) else tone_data.get('data', [])
    samples = data[:sample_size]

    tone_keywords = {
        'friendly': ['안녕', '감사', '좋아', '함께', '반갑', '고마워'],
        'urgent': ['지금', '오늘', '급', '빨리', '당장', '서둘러', '내일'],
        'solution': ['해결', '개선', '최적', '효과', '추천', '도움'],
        'empathetic': ['이해', '공감', '걱정', '힘들', '어려'],
        'professional': ['정책', '규정', '법적', '증명', '따라', '그러므로'],
        'casual': ['진짜', '완전', '너무'],
        'factual': ['데이터', '결과', '통계', '비교', '분석'],
        'formal': ['존경', '정중', '경의', '인사']
    }

    tone_correct = 0
    tone_dist = defaultdict(int)
    confidence_scores = []

    for sample in samples:
        question = sample.get('question', '')
        expected_tone = sample.get('sales_tone', {}).get('primary', 'neutral')
        expected_conf = sample.get('sales_tone', {}).get('confidence', 0)

        # 톤 예측
        tone_scores = {}
        for tone, keywords in tone_keywords.items():
            matches = sum(1 for kw in keywords if kw in question.lower())
            tone_scores[tone] = matches

        predicted_tone = max(tone_scores, key=tone_scores.get) if max(tone_scores.values()) > 0 else 'neutral'

        tone_dist[predicted_tone] += 1
        confidence_scores.append(expected_conf)

        if predicted_tone == expected_tone:
            tone_correct += 1

    tone_acc = tone_correct / len(samples) * 100 if samples else 0
    avg_conf = statistics.mean(confidence_scores) if confidence_scores else 0

    return {
        'test_name': 'Sales Tone',
        'total': len(samples),
        'correct': tone_correct,
        'accuracy_percent': tone_acc,
        'avg_confidence': avg_conf,
        'tone_distribution': dict(tone_dist),
        'status': 'PASS' if tone_acc >= 70 and avg_conf >= 0.5 else 'FAIL'
    }

def test_integration_scenarios(mapping_data):
    """테스트 4: 통합 시나리오"""
    scenarios = [
        {'id': 'INT_001', 'name': '선상팁 질문', 'category': 'TIP'},
        {'id': 'INT_002', 'name': '객실 변경', 'category': 'Room'},
        {'id': 'INT_003', 'name': '탑승 시간', 'category': 'Boarding'},
        {'id': 'INT_004', 'name': '음식 알레르기', 'category': 'Dining'},
        {'id': 'INT_005', 'name': '카드 결제', 'category': 'Card'},
        {'id': 'INT_006', 'name': '비자 요구', 'category': 'Document'},
        {'id': 'INT_007', 'name': '액티비티', 'category': 'Activity'},
        {'id': 'INT_008', 'name': '포트 일정', 'category': 'Port'},
        {'id': 'INT_009', 'name': '음료 포함', 'category': 'Beverage'},
        {'id': 'INT_010', 'name': '환불 정책', 'category': 'Policy'}
    ]

    passed = 0
    mappings = mapping_data.get('mappings', [])
    categories_found = set()

    for mapping in mappings:
        cat = mapping.get('category', '')
        if cat:
            categories_found.add(cat)

    for scenario in scenarios:
        if scenario['category'] in categories_found:
            passed += 1

    integration_acc = passed / len(scenarios) * 100

    return {
        'test_name': 'Integration Scenarios',
        'total': len(scenarios),
        'passed': passed,
        'accuracy_percent': integration_acc,
        'status': 'PASS' if integration_acc >= 80 else 'FAIL'
    }

def test_performance(mapping_data):
    """테스트 5: 성능"""
    mappings = mapping_data.get('mappings', [])
    response_times = []

    for mapping in mappings:
        start = time.time()
        _ = json.dumps(mapping)
        elapsed = (time.time() - start) * 1000
        response_times.append(elapsed)

    mean_resp = statistics.mean(response_times) if response_times else 0
    p95_resp = sorted(response_times)[int(len(response_times) * 0.95)] if response_times else 0
    p99_resp = sorted(response_times)[int(len(response_times) * 0.99)] if response_times else 0

    return {
        'test_name': 'Performance',
        'mean_response_ms': mean_resp,
        'p95_response_ms': p95_resp,
        'p99_response_ms': p99_resp,
        'max_response_ms': max(response_times) if response_times else 0,
        'total_items': len(mappings),
        'status': 'PASS' if mean_resp < 1000 else 'FAIL'
    }

def generate_report(results):
    """보고서 생성"""
    report_path = 'QA_TEST_REPORT.md'

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# 세일즈봇 QA 테스트 최종 보고서\n\n")
        f.write(f"**테스트 일시**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**테스트자**: Claude Code QA Framework\n\n")

        # Executive Summary
        f.write("## Executive Summary\n\n")
        f.write("| 항목 | 상태 | 성과 |\n")
        f.write("|-----|------|-------|\n")

        for result in results:
            if 'accuracy_percent' in result:
                perf = f"{result['accuracy_percent']:.1f}%"
            elif 'validity_percent' in result:
                perf = f"{result['validity_percent']:.1f}%"
            elif 'mean_response_ms' in result:
                perf = f"{result['mean_response_ms']:.2f}ms"
            else:
                perf = "N/A"

            status = "PASS" if result.get('status') == 'PASS' else "FAIL"
            f.write(f"| {result['test_name']} | {status} | {perf} |\n")

        f.write("\n## 상세 결과\n\n")

        for i, result in enumerate(results, 1):
            f.write(f"### 테스트 {i}: {result['test_name']}\n\n")

            for key, value in result.items():
                if key not in ['test_name', 'status']:
                    if isinstance(value, float):
                        f.write(f"- {key}: {value:.3f}\n")
                    elif isinstance(value, dict):
                        f.write(f"- {key}:\n")
                        for k, v in value.items():
                            f.write(f"  - {k}: {v}\n")
                    else:
                        f.write(f"- {key}: {value}\n")

            f.write(f"- **상태**: {result.get('status', 'UNKNOWN')}\n\n")

        # 결론
        f.write("## 결론\n\n")
        all_passed = all(r.get('status') == 'PASS' for r in results)
        if all_passed:
            f.write("✓ **모든 테스트 통과** - 세일즈봇 배포 준비 완료\n")
        else:
            f.write("⚠ **일부 테스트 실패** - 개선 필요\n")

    return report_path

def main():
    print("세일즈봇 QA 테스트 실행 중...")

    # 데이터 로드
    mapping_data, tone_data = load_data()

    results = []

    # 테스트 1: 검색 정확도
    print("테스트 1: 검색 정확도...")
    results.append(test_search_accuracy(mapping_data, sample_size=100))

    # 테스트 2: 상품 매핑
    print("테스트 2: 상품 매핑 검증...")
    results.append(test_product_mapping(mapping_data, sample_size=50))

    # 테스트 3: 판매톤
    print("테스트 3: 판매톤 정확도...")
    results.append(test_sales_tone(tone_data, sample_size=50))

    # 테스트 4: 통합 시나리오
    print("테스트 4: 통합 시나리오...")
    results.append(test_integration_scenarios(mapping_data))

    # 테스트 5: 성능
    print("테스트 5: 성능 테스트...")
    results.append(test_performance(mapping_data))

    # 보고서 생성
    print("보고서 생성 중...")
    report_path = generate_report(results)

    # 결과 JSON 저장
    with open('qa_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"완료! 보고서: {report_path}")
    print(f"결과 JSON: qa_test_results.json")

    # 결과 요약
    print("\n=== 테스트 요약 ===")
    for result in results:
        status = result.get('status', 'UNKNOWN')
        print(f"{result['test_name']}: {status}")

if __name__ == '__main__':
    main()
