#!/usr/bin/env python3
"""
Q&A 라이브러리 성능 최적화 분석 스크립트
564개 항목의 파일 크기, 구조, 최적화 전략 분석
"""

import json
import os
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple

def calculate_file_size_breakdown():
    """각 JSON 파일의 크기를 분석"""
    base_path = Path(".")
    json_files = list(base_path.glob("*.json"))

    file_stats = []
    total_bytes = 0
    total_items = 0

    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            file_size = json_file.stat().st_size

            # 항목 수 추출
            if isinstance(data, dict):
                if 'total' in data:
                    items_count = data['total']
                elif 'items' in data:
                    items_count = data['items']
                elif 'questions' in data:
                    items_count = len(data['questions'])
                else:
                    items_count = 1
            else:
                items_count = len(data) if isinstance(data, list) else 1

            total_bytes += file_size
            total_items += items_count

            file_stats.append({
                'file': json_file.name,
                'size_bytes': file_size,
                'size_kb': file_size / 1024,
                'items': items_count,
                'bytes_per_item': file_size / items_count if items_count > 0 else 0
            })
        except Exception as e:
            print(f"Error reading {json_file}: {e}", file=sys.stderr)

    return file_stats, total_bytes, total_items

def analyze_data_structure(file_path: str) -> Dict:
    """파일의 데이터 구조를 분석"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 첫 번째 항목 추출
    if isinstance(data, dict):
        if 'questions' in data:
            sample = data['questions'][0] if data['questions'] else {}
        elif 'data' in data:
            sample = data['data'][0] if data['data'] else {}
        elif 'items' in isinstance(data['items'], list):
            sample = data['items'][0] if data['items'] else {}
        else:
            sample = {}
    else:
        sample = data[0] if data else {}

    # 필드 분석
    fields = {
        'total_fields': len(sample.keys()) if isinstance(sample, dict) else 0,
        'field_names': list(sample.keys()) if isinstance(sample, dict) else [],
        'sample_item': sample
    }

    return fields

def estimate_optimizations():
    """최적화 시나리오 3가지 도출"""
    scenarios = [
        {
            'name': '기본 최적화',
            'description': '필수 필드만 유지',
            'changes': [
                '키워드: 10개 → 5개 제한',
                '메타데이터 제거 (source, type, hash, salesTone)',
                'ID 필드 단순화 (sequence만)',
                '날짜 포맷 축약'
            ],
            'estimated_reduction_percent': 35,
            'file_size_improvement': '1.54배'
        },
        {
            'name': '심화 최적화',
            'description': '필드 최소화 + 구조 개선',
            'changes': [
                '기본 최적화 전체',
                '답변 텍스트 요약 (50자 제한)',
                'answer 필드 제거 (Q만 유지)',
                '카테고리 코드화 (숫자)',
                'JSON 배열로 변경 (메타 제거)'
            ],
            'estimated_reduction_percent': 58,
            'file_size_improvement': '2.38배'
        },
        {
            'name': '극대 최적화',
            'description': '압축 + 배열 포맷',
            'changes': [
                '심화 최적화 전체',
                'Gzip 압축 (.json.gz)',
                '이모지 제거',
                '쉼표 띄어쓰기 제거',
                '한글 선택적 압축'
            ],
            'estimated_reduction_percent': 72,
            'file_size_improvement': '3.57배'
        }
    ]
    return scenarios

def calculate_batch_upload_performance():
    """배치 업로드 성능 계산"""
    total_items = 564
    batch_sizes = [20, 50, 100, 200]
    avg_bytes_per_item = 1200  # 평균 추정값

    results = []
    for batch_size in batch_sizes:
        num_batches = (total_items + batch_size - 1) // batch_size
        batch_bytes = batch_size * avg_bytes_per_item
        results.append({
            'batch_size': batch_size,
            'num_batches': num_batches,
            'bytes_per_batch': batch_bytes,
            'kb_per_batch': batch_bytes / 1024
        })

    return results

def main():
    print("분석 시작...")
    print("=" * 80)

    # 1. 파일 크기 분석
    print("\n1. 현재 Q&A 라이브러리 파일 크기 분석")
    print("-" * 80)

    file_stats, total_bytes, total_items = calculate_file_size_breakdown()

    # 정렬
    file_stats.sort(key=lambda x: x['size_bytes'], reverse=True)

    print(f"총 파일 개수: {len(file_stats)}")
    print(f"총 항목 수: {total_items}")
    print(f"총 크기: {total_bytes:,} bytes ({total_bytes/1024:.2f} KB, {total_bytes/1024/1024:.2f} MB)")
    print(f"항목당 평균 크기: {total_bytes/total_items:.0f} bytes")

    print("\n상위 10개 파일:")
    for i, stat in enumerate(file_stats[:10], 1):
        print(f"{i:2}. {stat['file']:40} | {stat['size_kb']:8.2f} KB | {stat['items']:4} 항목 | {stat['bytes_per_item']:.0f} bytes/항목")

    # 2. 카테고리별 분석
    print("\n2. 카테고리별 항목 분포")
    print("-" * 80)

    # 주요 카테고리별 샘플 분석
    categories = {
        '탑승&수속': 50,
        '식사&음료': 45,
        '객실&카드': 40,
        '기항지&투어': 35,
        '선상활동': 30,
        '정책&수수료': 25,
        '기술&앱': 20,
        '기타': 15
    }

    print(f"예상 카테고리 분포:")
    for cat, count in categories.items():
        percent = (count / sum(categories.values())) * 100
        print(f"  {cat:15} | {count:3}개 | {percent:5.1f}%")

    # 3. 최적화 시나리오
    print("\n3. 최적화 시나리오 3가지")
    print("-" * 80)

    scenarios = estimate_optimizations()

    for i, scenario in enumerate(scenarios, 1):
        print(f"\nシナリオ {i}: {scenario['name']}")
        print(f"설명: {scenario['description']}")
        print(f"변경 사항:")
        for change in scenario['changes']:
            print(f"  • {change}")
        print(f"예상 감소율: {scenario['estimated_reduction_percent']}%")
        print(f"성능 개선: {scenario['file_size_improvement']} (로드 시간)")

        # 계산
        reduced_size = total_bytes * (1 - scenario['estimated_reduction_percent']/100)
        print(f"예상 크기: {reduced_size:,.0f} bytes ({reduced_size/1024:.2f} KB)")

    # 4. 배치 업로드 성능
    print("\n4. 배치 업로드 성능 분석")
    print("-" * 80)

    batch_performance = calculate_batch_upload_performance()

    print(f"총 {total_items}개 항목을 배치로 업로드할 경우:")
    print(f"{'배치크기':10} | {'배치수':8} | {'배치크기(KB)':15} | {'네트워크 시간 추정':20}")
    print("-" * 60)

    for perf in batch_performance:
        network_time_ms = perf['kb_per_batch'] / 10  # 1MB/s 기준 추정
        print(f"{perf['batch_size']:10} | {perf['num_batches']:8} | {perf['kb_per_batch']:14.2f} | {network_time_ms:18.0f}ms")

    # 5. 권장사항
    print("\n5. 권장사항")
    print("-" * 80)

    recommendations = {
        'batch_upload_size': 50,
        'cache_ttl_seconds': 300,
        'pagination_default_limit': 20,
        'index_strategy': ['category', 'phase', 'keywords'],
        'compression': 'gzip',
        'compression_level': 9
    }

    print(f"배치 업로드 크기: {recommendations['batch_upload_size']}개")
    print(f"캐시 TTL: {recommendations['cache_ttl_seconds']}초 (5분)")
    print(f"페이지네이션 기본값: limit={recommendations['pagination_default_limit']}")
    print(f"인덱싱 전략: {', '.join(recommendations['index_strategy'])}")
    print(f"압축: {recommendations['compression']} (레벨 {recommendations['compression_level']})")

    # 6. 출력 준비
    print("\n6. 최종 보고서 생성")
    print("-" * 80)

    report = {
        'current_state': {
            'total_items': total_items,
            'total_size_bytes': total_bytes,
            'total_size_kb': total_bytes / 1024,
            'total_size_mb': total_bytes / 1024 / 1024,
            'avg_bytes_per_item': int(total_bytes / total_items),
            'file_count': len(file_stats)
        },
        'file_breakdown': [
            {
                'file': stat['file'],
                'size_bytes': stat['size_bytes'],
                'size_kb': round(stat['size_kb'], 2),
                'items': stat['items'],
                'bytes_per_item': int(stat['bytes_per_item'])
            }
            for stat in file_stats
        ],
        'category_distribution': categories,
        'optimization_scenarios': [
            {
                'name': s['name'],
                'description': s['description'],
                'changes': s['changes'],
                'estimated_size_reduction_percent': s['estimated_reduction_percent'],
                'estimated_size_bytes': int(total_bytes * (1 - s['estimated_reduction_percent']/100)),
                'load_time_improvement': s['file_size_improvement']
            }
            for s in scenarios
        ],
        'recommendations': {
            'batch_upload_size': recommendations['batch_upload_size'],
            'cache_ttl_seconds': recommendations['cache_ttl_seconds'],
            'pagination_default_limit': recommendations['pagination_default_limit'],
            'index_strategy': recommendations['index_strategy'],
            'compression_format': recommendations['compression'],
            'compression_level': recommendations['compression_level'],
            'monitoring_metrics': [
                'Query latency (p50, p95, p99)',
                'Cache hit rate',
                'File access count',
                'Batch upload success rate'
            ]
        },
        'performance_targets': {
            'search_response_time_ms': 100,
            'page_load_time_ms': 500,
            'batch_upload_success_rate_percent': 99.9,
            'cache_hit_rate_percent': 80
        }
    }

    # JSON 저장
    output_path = Path('performance_optimization_report.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n✓ 보고서 저장됨: {output_path.absolute()}")
    print(f"  크기: {output_path.stat().st_size:,} bytes")

    return report

if __name__ == '__main__':
    try:
        report = main()
        print("\n" + "=" * 80)
        print("분석 완료!")
    except Exception as e:
        print(f"오류: {e}", file=sys.stderr)
        sys.exit(1)
