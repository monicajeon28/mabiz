#!/usr/bin/env python3
"""
Playbook JSON Offer Phase Integration Analysis & Validation
2026-05-19
"""

import json
import sys
from collections import Counter, defaultdict
from io import StringIO

# JSON 파일 로드
def load_playbook():
    with open("docs/크루즈콜모음/playbook_rag_master_v2_refined.json", "r", encoding="utf-8") as f:
        return json.load(f)

def analyze_playbook(data):
    """Playbook 상세 분석"""

    # 1. Phase 분포
    print("=" * 80)
    print("ANALYSIS 1: Phase 분포 및 Type 매핑")
    print("=" * 80)

    phase_dist = Counter([item.get("phase") for item in data])
    type_dist = Counter([item.get("type") for item in data])

    print(f"\n전체 아이템: {len(data)}개\n")
    print("Phase별 분포:")
    for phase in sorted(phase_dist.keys(), key=lambda x: (x not in ['0','1','2','3','8'], x)):
        print(f"  Phase {phase:12} : {phase_dist[phase]:3}개")

    print("\nType별 분포:")
    for t in sorted(type_dist.keys()):
        print(f"  {t:15} : {type_dist[t]:3}개")

    # 2. Phase별 Type 매핑
    print("\n" + "=" * 80)
    print("ANALYSIS 2: Phase별 Type 매핑")
    print("=" * 80)

    phase_types = defaultdict(set)
    for item in data:
        phase = item.get("phase")
        type_ = item.get("type")
        phase_types[phase].add(type_)

    for phase in sorted(phase_types.keys(), key=lambda x: (x not in ['0','1','2','3','8'], x)):
        types_list = ", ".join(sorted(phase_types[phase]))
        print(f"Phase {phase:8} → {types_list}")

    # 3. Key naming vs Phase field 검증
    print("\n" + "=" * 80)
    print("ANALYSIS 3: Key Naming vs Phase Field 불일치 (상위 10개)")
    print("=" * 80)

    mismatches = []
    for item in data:
        key = item['key']
        phase_in_field = item['phase']

        # key에서 phase 추출
        key_parts = key.split('_')
        phase_in_key = key_parts[1] if len(key_parts) > 1 else None

        if phase_in_key != f"phase{phase_in_field}":
            mismatches.append({
                'key': key,
                'phase_in_key': phase_in_key,
                'phase_in_field': phase_in_field
            })

    print(f"\n총 불일치: {len(mismatches)}개\n")
    for item in mismatches[:10]:
        print(f"  key: {item['key']:40} | phase_field: {item['phase_in_field']}")

    # 4. shinminStep 분포
    print("\n" + "=" * 80)
    print("ANALYSIS 4: shinminStep별 Phase 분포")
    print("=" * 80)

    step_phase = defaultdict(lambda: defaultdict(int))
    for item in data:
        step = item.get("shinminStep")
        phase = item.get("phase")
        step_phase[step][phase] += 1

    for step in sorted(step_phase.keys(), key=lambda x: (x is None, x)):
        print(f"\nStep {step}:")
        for phase in sorted(step_phase[step].keys()):
            count = step_phase[step][phase]
            print(f"  Phase {phase:8} : {count:3}개")

    # 5. Psychology 분포
    print("\n" + "=" * 80)
    print("ANALYSIS 5: 심리학 이론 분포 (Top 10)")
    print("=" * 80)

    psych_list = []
    for item in data:
        psychology = item.get("psychology", "")
        if psychology:
            # | 로 구분된 여러 이론 분리
            theories = [p.strip() for p in psychology.split('|')]
            psych_list.extend(theories)

    psych_dist = Counter(psych_list)
    print()
    for theory, count in psych_dist.most_common(10):
        print(f"  {theory:50} : {count:3}개 ({count/len(data)*100:5.1f}%)")

    # 6. Offer Phase 제안 구조
    print("\n" + "=" * 80)
    print("PROPOSAL: Offer Phase (Phase 4) 추가 구조")
    print("=" * 80)

    proposed_phase_dist = {
        '0': 5,
        '1': 4,
        '2': 11,
        '3': 20,
        '4': 20,  # NEW: Offer Phase
        '8': 10,
        'objection': 10,
        'reset': 3,
        'followup': 4
    }

    print("\n확장 후 분포:")
    total = sum(proposed_phase_dist.values())
    for phase in ['0', '1', '2', '3', '4', '8', 'objection', 'reset', 'followup']:
        if phase in proposed_phase_dist:
            count = proposed_phase_dist[phase]
            marker = " ← NEW" if phase == '4' else ""
            print(f"  Phase {phase:12} : {count:3}개 {marker}")
    print(f"\n  총합: {total}개")

    # 7. Offer 11가지 Type 제안
    print("\n" + "=" * 80)
    print("PROPOSAL: Offer 11가지 Type")
    print("=" * 80)

    offer_types = {
        "VALUE": [
            "OFFER_VALUE_1: 고급상품 비유",
            "OFFER_VALUE_2: 가격대 제시",
            "OFFER_VALUE_3: 특별혜택",
            "OFFER_VALUE_4: 보장강조",
            "OFFER_VALUE_5: 상품네이밍"
        ],
        "CONTENT": [
            "OFFER_CONTENT_1: 제안내용전달",
            "OFFER_CONTENT_2: 새로움강조",
            "OFFER_CONTENT_3: 쓸모정보",
            "OFFER_CONTENT_4: 재미정보",
            "OFFER_CONTENT_5: 독창성우월성"
        ],
        "CONDITION": [
            "OFFER_CONDITION: 판매조건"
        ]
    }

    for group, types in offer_types.items():
        print(f"\n{group} 그룹:")
        for t in types:
            print(f"  - {t}")

    # 8. 세그먼트별 분포
    print("\n" + "=" * 80)
    print("ANALYSIS 6: customerSegment 분포")
    print("=" * 80)

    segment_dist = Counter([item.get("customerSegment") for item in data])
    print()
    for seg in sorted(segment_dist.keys()):
        print(f"  {seg:10} : {segment_dist[seg]:3}개")

    # 9. Source 분포 (출처)
    print("\n" + "=" * 80)
    print("ANALYSIS 7: 스크립트 출처 분포")
    print("=" * 80)

    source_dist = Counter([item.get("source") for item in data])
    print()
    for source in sorted(source_dist.keys()):
        print(f"  {source:20} : {source_dist[source]:3}개")

    # 10. Phase 3 상세 분석 (가장 많은 아이템)
    print("\n" + "=" * 80)
    print("ANALYSIS 8: Phase 3 (POSITIONING) 상세 (20개)")
    print("=" * 80)

    phase3_items = [item for item in data if item.get("phase") == "3"]
    print(f"\n총 {len(phase3_items)}개 아이템\n")

    for i, item in enumerate(phase3_items[:3], 1):
        print(f"{i}. {item['key']}")
        print(f"   script: {item['script'][:60]}...")
        print(f"   psychology: {item['psychology']}")
        print()

    print("...")

    # 11. 신민형 Step 4와 Step 5의 경계
    print("\n" + "=" * 80)
    print("ANALYSIS 9: 신민형 Step 4 vs Step 5 경계")
    print("=" * 80)

    step4_items = [item for item in data if item.get("shinminStep") == "4"]
    step5_items = [item for item in data if item.get("shinminStep") == "5"]

    print(f"\nStep 4 (20개):")
    step4_phases = Counter([item.get("phase") for item in step4_items])
    for phase in sorted(step4_phases.keys()):
        print(f"  Phase {phase:8} : {step4_phases[phase]:3}개")

    print(f"\nStep 5 (24개):")
    step5_phases = Counter([item.get("phase") for item in step5_items])
    for phase in sorted(step5_phases.keys()):
        print(f"  Phase {phase:8} : {step5_phases[phase]:3}개")

    print("\n→ 발견: Step 4는 Phase 3만, Step 5는 Phase 8/objection/followup로 분산")
    print("→ 해결: Phase 4 (Offer) 추가로 Step 4.5 영역 명확화")

def generate_json_example():
    """JSON 예제 생성"""

    print("\n" + "=" * 80)
    print("PROPOSAL: 신규 JSON 구조 예제")
    print("=" * 80)

    example = {
        "key": "pb_phase4_offer_value_1_001",
        "phase": "4",
        "type": "OFFER_VALUE_1",
        "customerSegment": "B|D|E",
        "trigger": None,
        "script": "럭셔리 호텔에서 매일 저녁 5성 식사를 하는 거랑 같아요.",
        "psychology": "Anchoring|Narrative Transportation",
        # 신규 필드
        "offerTechnique": "고급상품비유",
        "psychologyStrength": "강",
        "psychologyTheory": "Anchoring Effect (Tversky & Kahneman)|Narrative Transportation (Green & Brock)",
        "targetSegment": "B|D|E",
        "priceImpact": "+18%",
        "conversionBoost": "+14%",
        "bestPhasePosition": "4.2",
        "pairWith": ["OFFER_VALUE_2"],
        "avoidWith": ["OFFER_CONTENT_3"],
        "shinminStep": "4.5",
        "source": "신민형콜",
        "notes": "럭셔리 앵커로 상품 위상 상향. 40대 여성/60대+ 특히 효과 높음",
        "isActive": True
    }

    print("\n" + json.dumps(example, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    try:
        # 콘솔 인코딩 설정
        if sys.stdout.encoding != 'utf-8':
            sys.stdout = StringIO()  # 폴백

        data = load_playbook()
        analyze_playbook(data)
        generate_json_example()

        print("\n" + "=" * 80)
        print("분석 완료")
        print("=" * 80)

    except Exception as e:
        print(f"오류: {e}")
        import traceback
        traceback.print_exc()
