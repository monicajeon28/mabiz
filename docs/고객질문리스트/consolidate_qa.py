#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
세일즈봇 RAG 메모리용 Q&A 통합 스크립트
- 7개 문서 수집
- PII 제거 (개인정보, 특수 정보)
- 중복 제거
- 카테고리 자동 분류
- CSV 내보내기
"""

import openpyxl
import csv
import re
import os
from pathlib import Path
from collections import defaultdict

# ============================================================================
# 카테고리 분류 키워드 정의 (7가지)
# ============================================================================
CATEGORIES = {
    "탑승&수속": [
        "탑승", "탑승권", "승선", "수속", "체크인", "여권", "비자", "짐", "수하물",
        "탑승시간", "탑승장", "탑승료", "승객", "승객명부", "도움", "기동성",
        "휠체어", "유아", "아이", "스롤러", "캐리어", "여행증명서"
    ],
    "식사&음료": [
        "식사", "음료", "식음료", "먹", "마실", "버터", "알코올", "주류", "와인",
        "비어", "샴페인", "스파클링", "칵테일", "카페", "커피", "차", "음식",
        "음식 알러지", "식이", "채식", "할랄", "코셔", "글루텐", "유제품",
        "레스토랑", "카페", "다이닝", "뷔페", "특별식", "저염", "당뇨"
    ],
    "객실&카드": [
        "객실", "선실", "스위트", "발코니", "테라스", "실내", "바다", "전망",
        "침대", "침구", "욕실", "샤워", "욕조", "에어컨", "환기", "냉난방",
        "TV", "라디오", "전화", "미니바", "냉장고", "세이프", "방문", "키카드",
        "타월", "로브", "슬리퍼", "기용품", "요청", "주문", "세탁"
    ],
    "선상활동": [
        "액티비티", "활동", "운동", "수영", "수영장", "풀", "피트니스", "헬스",
        "요가", "스포츠", "스트레칭", "워킹", "조깅", "피트니스센터", "체육관",
        "배구", "테니스", "탁구", "골프", "화살", "클라이밍", "스포츠", "음악",
        "공연", "쇼", "라이브", "영화", "영화관", "바", "클럽", "카지노", "게임"
    ],
    "기항지&투어": [
        "기항", "상륙", "항구", "항만", "투어", "관광", "둘러보기", "상점",
        "쇼핑", "시장", "박물관", "유적지", "명소", "교회", "사원", "성",
        "해변", "섬", "도시", "도심", "관광지", "관광객", "지역", "숙소",
        "버스", "택시", "셔틀", "교통", "환율", "통화", "환전"
    ],
    "정책&수수료": [
        "정책", "규정", "규칙", "요금", "수수료", "가격", "비용", "비용", "결제",
        "결제방법", "신용카드", "체크카드", "현금", "환불", "취소", "보험",
        "보험료", "보험 가입", "취소정책", "변경정책", "환불정책", "수정",
        "승인", "승인료", "선택료", "팁", "쉽", "서비스료", "고객 서비스",
        "불만", "민원", "보상", "할인", "할인율", "프로모션", "특가", "정책",
        "약관", "조건", "제한", "금지"
    ],
    "기술&앱": [
        "앱", "애플리케이션", "모바일", "폰", "휴대폰", "스마트폰", "웹",
        "웹사이트", "온라인", "인터넷", "와이파이", "와이파이", "와이파이",
        "신호", "연결", "로그인", "비밀번호", "계정", "사용자", "아이디",
        "결제", "시스템", "오류", "버그", "기술지원", "콜센터", "지원",
        "고객 서비스", "고객지원", "기술"
    ]
}

# ============================================================================
# PII 제거 (정규표현식)
# ============================================================================
def remove_pii(text):
    """개인식별정보 제거"""
    if not text or not isinstance(text, str):
        return ""

    # 주민등록번호 (123456-1234567)
    text = re.sub(r'\d{6}-\d{7}', '[주민번호]', text)

    # 휴대폰 번호 (010-1234-5678)
    text = re.sub(r'01[0-9]-\d{3,4}-\d{4}', '[핸드폰]', text)

    # 일반 전화번호 (02-1234-5678)
    text = re.sub(r'0\d{1,2}-\d{3,4}-\d{4}', '[전화]', text)

    # 이메일 (example@test.com)
    text = re.sub(r'[\w.-]+@[\w.-]+\.\w+', '[이메일]', text)

    # 신용카드 번호 (1234-5678-1234-5678)
    text = re.sub(r'\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}', '[카드번호]', text)

    # URL (http://, https://)
    text = re.sub(r'https?://[^\s]+', '[링크]', text)

    # 한국 집주소 패턴 (서울시 강남구 역삼동 123-45)
    text = re.sub(r'[가-힣]+[시도|특별시|광역시]\s+[가-힣]+[구|군]\s+[가-힣]+[동|읍|면]\s+\d+-?\d*', '[주소]', text)

    # 특수 문자 정리 (연속된 공백 제거)
    text = re.sub(r'\s+', ' ', text).strip()

    return text

# ============================================================================
# 카테고리 분류 함수
# ============================================================================
def classify_category(question, answer):
    """Q&A 텍스트를 7가지 카테고리 중 하나로 분류"""
    combined_text = (question + " " + answer).lower()

    scores = defaultdict(int)
    for category, keywords in CATEGORIES.items():
        for keyword in keywords:
            if keyword in combined_text:
                scores[category] += 1

    if scores:
        best_category = max(scores, key=scores.get)
        return best_category
    else:
        return "기타"  # 기본값

# ============================================================================
# 파일 읽기 함수
# ============================================================================
def read_text_files():
    """텍스트 파일 읽기 (상담 기록)"""
    qa_list = []

    txt_files = [
        "MSC벨리시마.txt",
        "MSC벨리시마2항차.txt"
    ]

    for fname in txt_files:
        fpath = Path(fname)
        if fpath.exists():
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # 간단한 패턴: 줄바꿈으로 구분된 상담 내용을 문단으로 분할
                    paragraphs = content.split('\n\n')
                    for para in paragraphs:
                        if para.strip() and len(para) > 20:
                            # 첫 100자를 질문, 나머지를 답변으로 간주
                            qa_list.append({
                                'question': para[:100] + '...' if len(para) > 100 else para,
                                'answer': para,
                                'source': fname,
                                'type': '상담기록'
                            })
                print(f"[OK] {fname}: {len(paragraphs)} 단락 수집")
            except Exception as e:
                print(f"[ERR] {fname}: {e}")
        else:
            print(f"[NOT] {fname}: 파일 없음")

    return qa_list

def read_excel_files():
    """엑셀 Q&A 파일 읽기"""
    qa_list = []

    files_config = [
        ("크루즈 QnA.xlsx", None, 0, 1),  # (파일, 시트=None은 첫시트, Q_col, A_col)
        ("[2주차]Q&A 크루즈 100문 100답_타미 2023ver.xlsx", None, 4, 5),
        ("W 로얄 캐리비안 QnA 모음.xlsx", None, 0, 1),
        ("홍콩0921) 고객 질의응답 리스트.xlsx", None, 2, 3),
    ]

    for fname, sheet_name, q_col, a_col in files_config:
        fpath = Path(fname)
        if fpath.exists():
            try:
                wb = openpyxl.load_workbook(fpath, data_only=True)
                # sheet_name이 None이면 첫 시트 사용
                ws = wb[sheet_name] if sheet_name else wb.active

                count = 0
                for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                    if len(row) > max(q_col, a_col):
                        q = row[q_col]
                        a = row[a_col]

                        if q and a:  # Q&A 모두 있을 때만
                            q_str = str(q).strip()
                            a_str = str(a).strip()

                            if len(q_str) > 5 and len(a_str) > 5:  # 최소 길이 체크
                                qa_list.append({
                                    'question': q_str,
                                    'answer': a_str,
                                    'source': fname,
                                    'type': 'Q&A'
                                })
                                count += 1

                print(f"[OK] {fname}: {count}개 Q&A 수집")
            except Exception as e:
                print(f"[ERR] {fname}: {e}")
        else:
            print(f"[NOT] {fname}: 파일 없음")

    return qa_list

# ============================================================================
# 메인 처리
# ============================================================================
def main():
    print("\n" + "="*70)
    print("세일즈봇 RAG 메모리 - Q&A 통합 & 가공")
    print("="*70 + "\n")

    # 1단계: 모든 파일에서 Q&A 수집
    print("[1단계] Q&A 수집 중...\n")
    all_qa = []

    # 텍스트 파일
    all_qa.extend(read_text_files())

    # 엑셀 파일
    all_qa.extend(read_excel_files())

    print(f"\n수집 완료: 총 {len(all_qa)}개 항목\n")

    # 2단계: PII 제거 & 카테고리 분류
    print("[2단계] PII 제거 & 카테고리 분류 중...\n")

    processed_qa = []
    for idx, item in enumerate(all_qa, 1):
        q = remove_pii(item['question'])
        a = remove_pii(item['answer'])

        if q and a:  # PII 제거 후에도 내용이 있으면
            processed_qa.append({
                'id': f"q{idx:04d}",
                'question': q,
                'answer': a,
                'category': classify_category(q, a),
                'source': item['source'],
                'type': item['type']
            })

    print(f"처리 완료: {len(processed_qa)}개 항목\n")

    # 3단계: 중복 제거 (질문 기준)
    print("[3단계] 중복 제거 중...\n")

    seen_questions = set()
    unique_qa = []
    duplicates = 0

    for item in processed_qa:
        q_normalized = item['question'].lower().strip()

        if q_normalized not in seen_questions:
            seen_questions.add(q_normalized)
            unique_qa.append(item)
        else:
            duplicates += 1

    print(f"중복 제거 완료: {duplicates}개 제거, {len(unique_qa)}개 유지\n")

    # 4단계: 카테고리별 분류
    print("[4단계] 카테고리별 분류 통계\n")

    category_count = defaultdict(int)
    for item in unique_qa:
        category_count[item['category']] += 1

    for category in sorted(CATEGORIES.keys()) + ['기타']:
        count = category_count.get(category, 0)
        if count > 0:
            print(f"  {category:15s}: {count:4d}개")

    print()

    # 5단계: CSV 저장
    print("[5단계] CSV 저장 중...\n")

    output_file = "questions_consolidated.csv"

    try:
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'question', 'answer', 'category', 'source', 'type'])
            writer.writeheader()
            writer.writerows(unique_qa)

        print(f"[OK] {output_file}: {len(unique_qa)}개 항목 저장 완료\n")

        # 파일 정보 출력
        file_size = os.path.getsize(output_file) / 1024  # KB
        print(f"파일 크기: {file_size:.1f} KB")
        print(f"(IndexedDB 제약: 5.3 MB 이내)\n")

    except Exception as e:
        print(f"✗ CSV 저장 실패: {e}\n")

    # 6단계: 샘플 출력
    print("="*70)
    print("SAMPLE DATA (first 3)")
    print("="*70)

    for i, item in enumerate(unique_qa[:3], 1):
        q_safe = ''.join(c for c in item['question'][:80] if ord(c) < 128 or ord(c) >= 128)[:60]
        a_safe = ''.join(c for c in item['answer'][:80] if ord(c) < 128 or ord(c) >= 128)[:60]
        print(f"\n[{i}] {item['category']}")
        print(f"    Q: {q_safe}...")
        print(f"    A: {a_safe}...")
        print(f"    Source: {item['source']}")

if __name__ == "__main__":
    main()
