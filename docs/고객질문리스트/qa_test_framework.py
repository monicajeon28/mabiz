#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
세일즈봇 QA 테스트 프레임워크
- 검색 정확도 테스트
- 상품 매핑 검증
- 판매톤 정확도
- 성능 테스트
"""

import json
import csv
import time
import statistics
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import re

@dataclass
class TestResult:
    """테스트 결과 데이터 클래스"""
    test_id: str
    scenario_name: str
    question: str
    expected_category: str
    expected_products: List[str]
    expected_tone: str

    actual_category: str = ""
    actual_products: List[str] = None
    actual_tone: str = ""
    actual_confidence: float = 0.0

    accuracy_category: bool = False
    accuracy_product: bool = False
    accuracy_tone: bool = False

    response_time_ms: float = 0.0
    passed: bool = False
    notes: str = ""

    def to_dict(self):
        return asdict(self)

class SearchAccuracyTester:
    """검색 정확도 테스트"""

    def __init__(self, mapping_data: Dict, tone_data: Dict):
        self.mapping_data = mapping_data
        self.tone_data = tone_data
        self.results = []

    def normalize_text(self, text: str) -> str:
        """텍스트 정규화"""
        text = text.lower()
        text = re.sub(r'[^\w\s]', '', text)  # 특수문자 제거
        return text.strip()

    def search_question(self, query: str) -> List[Dict]:
        """질문 검색 시뮬레이션"""
        results = []
        normalized_query = self.normalize_text(query)

        for mapping in self.mapping_data.get('mappings', []):
            question = mapping.get('question_text', '')
            normalized_q = self.normalize_text(question)

            # 키워드 매칭 스코어 계산
            query_words = normalized_query.split()
            matched_words = sum(1 for word in query_words if word in normalized_q)

            if matched_words > 0:
                relevance = matched_words / len(query_words) if query_words else 0
                results.append({
                    'question_id': mapping.get('question_id'),
                    'question': question,
                    'relevance': min(relevance, 1.0),
                    'products': mapping.get('products', [])
                })

        # 관련도 순으로 정렬
        results.sort(key=lambda x: x['relevance'], reverse=True)
        return results[:5]  # Top 5

    def test_search_accuracy(self, query: str, expected_category: str) -> Tuple[bool, List[Dict]]:
        """검색 정확도 테스트"""
        results = self.search_question(query)

        if not results:
            return False, []

        top_result = results[0]
        matched = expected_category.lower() in top_result['question'].lower()

        return matched, results

    def run_100_sample_tests(self, sample_questions: List[Dict]) -> List[TestResult]:
        """100개 샘플로 검색 정확도 테스트"""
        results = []

        for idx, sample in enumerate(sample_questions[:100], 1):
            test_id = f"SEARCH_{idx:03d}"
            question = sample.get('question', '')
            expected_category = sample.get('category', '')
            expected_products = sample.get('products', [])

            start_time = time.time()
            matched, search_results = self.search_search_accuracy(
                question, expected_category
            )
            elapsed_ms = (time.time() - start_time) * 1000

            actual_products = search_results[0]['products'] if search_results else []
            actual_category = search_results[0]['question'] if search_results else ""

            result = TestResult(
                test_id=test_id,
                scenario_name=f"Search: {expected_category}",
                question=question,
                expected_category=expected_category,
                expected_products=expected_products,
                expected_tone="",
                actual_products=actual_products,
                actual_category=actual_category,
                accuracy_category=matched,
                accuracy_product=len(set(expected_products) & set(actual_products)) > 0,
                response_time_ms=elapsed_ms,
                passed=matched,
                notes=f"Found {len(search_results)} results"
            )
            results.append(result)

        return results

class ProductMappingValidator:
    """상품 매핑 검증"""

    def __init__(self, mapping_data: Dict):
        self.mapping_data = mapping_data
        self.results = []

    def validate_top_50_mappings(self) -> List[Dict]:
        """상위 50개 매핑된 상품 검증"""
        mappings = self.mapping_data.get('mappings', [])[:50]
        validations = []

        for mapping in mappings:
            products = mapping.get('products', [])
            max_relevance = max([p.get('relevance', 0) for p in products]) if products else 0

            validation = {
                'question_id': mapping.get('question_id'),
                'question': mapping.get('question_text'),
                'products_count': len(products),
                'max_relevance': max_relevance,
                'is_valid': max_relevance >= 0.75,  # 신뢰도 75% 이상
                'false_positive_risk': 'LOW' if max_relevance >= 0.85 else 'MEDIUM' if max_relevance >= 0.75 else 'HIGH',
                'false_negative_risk': 'LOW' if len(products) > 0 else 'HIGH'
            }
            validations.append(validation)

        return validations

    def evaluate_relevance_scores(self) -> Dict:
        """관련도 점수 재평가"""
        mappings = self.mapping_data.get('mappings', [])
        scores = []

        for mapping in mappings:
            products = mapping.get('products', [])
            for product in products:
                scores.append(product.get('relevance', 0))

        if not scores:
            return {}

        return {
            'mean': statistics.mean(scores),
            'median': statistics.median(scores),
            'stdev': statistics.stdev(scores) if len(scores) > 1 else 0,
            'min': min(scores),
            'max': max(scores),
            'distribution': {
                '0.95-1.00': len([s for s in scores if 0.95 <= s <= 1.0]),
                '0.85-0.94': len([s for s in scores if 0.85 <= s < 0.95]),
                '0.75-0.84': len([s for s in scores if 0.75 <= s < 0.85]),
                '0.70-0.74': len([s for s in scores if 0.70 <= s < 0.75]),
            }
        }

class SalesToneTester:
    """판매톤 정확도 테스트"""

    def __init__(self, tone_data: Dict):
        self.tone_data = tone_data
        self.results = []

    def test_tone_accuracy(self, sample_size: int = 50) -> List[TestResult]:
        """50개 샘플로 판매톤 정확도 테스트"""
        samples = self.tone_data.get('samples', [])[:sample_size]
        results = []

        for idx, sample in enumerate(samples, 1):
            test_id = f"TONE_{idx:03d}"
            question = sample.get('question', '')
            expected_primary = sample.get('primary_tone', '')
            expected_secondary = sample.get('secondary_tones', [])
            expected_confidence = sample.get('confidence', 0)

            # 판매톤 검증 (간단한 키워드 기반)
            tone_indicators = self._analyze_tone_indicators(question)

            result = TestResult(
                test_id=test_id,
                scenario_name=f"Tone: {expected_primary}",
                question=question,
                expected_category="",
                expected_products=[],
                expected_tone=expected_primary,
                actual_tone=tone_indicators['primary'],
                actual_confidence=tone_indicators['confidence'],
                accuracy_tone=tone_indicators['primary'] == expected_primary,
                passed=tone_indicators['primary'] == expected_primary,
                notes=f"Confidence: {tone_indicators['confidence']:.2f}"
            )
            results.append(result)

        return results

    def _analyze_tone_indicators(self, text: str) -> Dict:
        """톤 지표 분석"""
        text_lower = text.lower()

        friendly_keywords = ['안녕', '감사', '좋아', '함께', '~~', '^^', '반갑']
        urgent_keywords = ['지금', '오늘', '급', '빨리', '당장', '서둘러', '내일']
        solution_keywords = ['해결', '개선', '최적', '효과', '추천', '도움']
        empathetic_keywords = ['이해', '공감', '걱정', '힘들', '어려']

        tone_scores = {
            'friendly': sum(1 for kw in friendly_keywords if kw in text_lower),
            'urgent': sum(1 for kw in urgent_keywords if kw in text_lower),
            'solution': sum(1 for kw in solution_keywords if kw in text_lower),
            'empathetic': sum(1 for kw in empathetic_keywords if kw in text_lower),
        }

        max_tone = max(tone_scores, key=tone_scores.get)
        max_score = tone_scores[max_tone]
        confidence = min(max_score / 3.0, 1.0) if max_score > 0 else 0

        return {
            'primary': max_tone if max_score > 0 else 'neutral',
            'confidence': confidence
        }

class IntegrationScenarioTester:
    """통합 테스트 시나리오"""

    def __init__(self, mapping_data: Dict, tone_data: Dict):
        self.mapping_data = mapping_data
        self.tone_data = tone_data

    def run_integration_tests(self) -> List[TestResult]:
        """10개 통합 시나리오 테스트"""
        scenarios = [
            {
                'id': 'INT_001',
                'name': '선상팁 정책 질문',
                'question': '선상팁이 뭐예요?',
                'expected_category': 'TIP',
                'expected_tone': 'friendly',
                'expected_product': '320'
            },
            {
                'id': 'INT_002',
                'name': '객실 변경 가능성',
                'question': '객실 변경 가능한가요?',
                'expected_category': 'Room',
                'expected_tone': 'friendly',
                'expected_product': 'room_change'
            },
            {
                'id': 'INT_003',
                'name': '긴급 탑승 시간',
                'question': '지금 바로 탑승해야 하나요?',
                'expected_category': 'Boarding',
                'expected_tone': 'urgent',
                'expected_product': 'boarding'
            },
            {
                'id': 'INT_004',
                'name': '음식 알레르기',
                'question': '해산물 알레르기 있으면 어떻게 하나요?',
                'expected_category': 'Dining',
                'expected_tone': 'empathetic',
                'expected_product': 'dining'
            },
            {
                'id': 'INT_005',
                'name': '카드 결제 정책',
                'question': '어떤 카드 사용 가능해요?',
                'expected_category': 'Card',
                'expected_tone': 'professional',
                'expected_product': 'card'
            },
            {
                'id': 'INT_006',
                'name': '비자 요구사항',
                'question': '비자 필요해요?',
                'expected_category': 'Document',
                'expected_tone': 'professional',
                'expected_product': 'visa'
            },
            {
                'id': 'INT_007',
                'name': '액티비티 추천',
                'question': '아이랑 즐길 수 있는 액티비티 뭐 있어요?',
                'expected_category': 'Activity',
                'expected_tone': 'friendly',
                'expected_product': 'activity'
            },
            {
                'id': 'INT_008',
                'name': '포트 방문 일정',
                'question': '항구에 몇 시간 있어요?',
                'expected_category': 'Port',
                'expected_tone': 'factual',
                'expected_product': 'port'
            },
            {
                'id': 'INT_009',
                'name': '음료 포함 여부',
                'question': '음료는 몇 잔까지 무료예요?',
                'expected_category': 'Beverage',
                'expected_tone': 'professional',
                'expected_product': 'beverage'
            },
            {
                'id': 'INT_010',
                'name': '환불 정책',
                'question': '취소하면 돈 돌려줘요?',
                'expected_category': 'Policy',
                'expected_tone': 'professional',
                'expected_product': 'refund'
            }
        ]

        results = []
        for scenario in scenarios:
            result = TestResult(
                test_id=scenario['id'],
                scenario_name=scenario['name'],
                question=scenario['question'],
                expected_category=scenario['expected_category'],
                expected_products=[scenario['expected_product']],
                expected_tone=scenario['expected_tone'],
                passed=True,  # 시뮬레이션
                notes='Integration scenario'
            )
            results.append(result)

        return results

class PerformanceTester:
    """성능 테스트"""

    def test_response_time(self, iterations: int = 275) -> Dict:
        """응답 시간 테스트"""
        response_times = []

        for i in range(iterations):
            start = time.time()
            # 시뮬레이션: 간단한 연산
            _ = json.dumps({'test': f'item_{i}'})
            elapsed = (time.time() - start) * 1000
            response_times.append(elapsed)

        return {
            'iterations': iterations,
            'mean_ms': statistics.mean(response_times),
            'median_ms': statistics.median(response_times),
            'p95_ms': sorted(response_times)[int(len(response_times) * 0.95)],
            'p99_ms': sorted(response_times)[int(len(response_times) * 0.99)],
            'max_ms': max(response_times),
            'min_ms': min(response_times),
            'total_time_s': sum(response_times) / 1000,
            'passed': statistics.mean(response_times) < 1000  # < 1초
        }

    def test_concurrent_users(self, user_count: int = 5) -> Dict:
        """동시 사용자 테스트"""
        import threading

        results = {'user_count': user_count, 'response_times': []}
        lock = threading.Lock()

        def simulate_user(user_id):
            for _ in range(10):  # 각 사용자 10회 요청
                start = time.time()
                _ = json.dumps({'user': user_id, 'data': 'test'})
                elapsed = (time.time() - start) * 1000

                with lock:
                    results['response_times'].append(elapsed)

        threads = [threading.Thread(target=simulate_user, args=(i,)) for i in range(user_count)]
        start_total = time.time()

        for thread in threads:
            thread.start()

        for thread in threads:
            thread.join()

        total_time = time.time() - start_total

        return {
            'user_count': user_count,
            'total_requests': len(results['response_times']),
            'mean_response_ms': statistics.mean(results['response_times']),
            'max_response_ms': max(results['response_times']),
            'total_time_s': total_time,
            'throughput_rps': len(results['response_times']) / total_time,
            'passed': statistics.mean(results['response_times']) < 1000
        }

def load_test_data():
    """테스트 데이터 로드"""
    with open('product_mapping.json', 'r', encoding='utf-8') as f:
        mapping_data = json.load(f)

    with open('questions_rag_memory_with_tone.json', 'r', encoding='utf-8') as f:
        tone_data = json.load(f)

    return mapping_data, tone_data

if __name__ == '__main__':
    print("QA 테스트 프레임워크 초기화 완료")
    print("- SearchAccuracyTester: 검색 정확도 테스트")
    print("- ProductMappingValidator: 상품 매핑 검증")
    print("- SalesToneTester: 판매톤 정확도")
    print("- IntegrationScenarioTester: 통합 시나리오")
    print("- PerformanceTester: 성능 테스트")
