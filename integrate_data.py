#!/usr/bin/env python3
import json
import os
from datetime import datetime

def normalize_text(text, max_len=None):
    if not text: return ""
    text = text.replace('\n\n', '\n').replace('\n', ' ').strip()
    return text[:max_len] + "..." if max_len and len(text) > max_len else text

def get_travel_phase(p):
    return p if p in ['여행전', '여행중', '여행후'] else '여행중'

def get_keywords(item):
    k = item.get('keywords', [])
    return k if k else ['크루즈'] if '크루즈' in str(item.get('question', '')) else []

def normalize_item(item):
    st = item.get('salesTone')
    if not st and 'sales_tone' in item:
        st = item['sales_tone'].get('primary') if isinstance(item['sales_tone'], dict) else item['sales_tone']
    return {
        'id': item.get('id', ''),
        'question': normalize_text(item.get('question', ''), 100),
        'answer': normalize_text(item.get('answer', ''), None),
        'keywords': get_keywords(item)[:5],
        'travelPhase': get_travel_phase(item.get('travelPhase', '여행중')),
        'type': item.get('type', '기타'),
        'category': item.get('category', '자동분류대기'),
        'source': item.get('source', 'MSC'),
        'salesTone': st or 'neutral'
    }

os.chdir('D:\\mabiz-crm')

data = []
xlsx_cnt = 0
for f in [
    'docs/고객질문리스트/msc2605_xlsx_problems_38.json',
    'docs/고객질문리스트/msc2605_xlsx_qa_71.json',
    'docs/고객질문리스트/msc2605_xlsx_tips_30.json',
    'docs/고객질문리스트/msc2605_xlsx_suggestions_30.json',
    'docs/고객질문리스트/msc2605_xlsx_notices_23.json',
    'docs/고객질문리스트/msc2605_xlsx_staff_4.json'
]:
    try:
        with open(f) as fp:
            c = json.load(fp)
            for item in c.get('data', []):
                data.append(normalize_item(item))
                xlsx_cnt += 1
    except Exception as e:
        print(f"Error: {f} - {e}")

try:
    with open('src/lib/data/questions_rag_memory_with_tone.json') as fp:
        c = json.load(fp)
        for item in c.get('questions', []):
            data.append(normalize_item(item))
except Exception as e:
    print(f"Error RAG: {e}")

stats = {
    'total_items': len(data),
    'avg_keywords': round(sum(len(i.get('keywords', [])) for i in data) / len(data), 2) if data else 0,
    'avg_question_length': round(sum(len(i.get('question', '')) for i in data) / len(data), 1) if data else 0,
    'avg_answer_length': round(sum(len(i.get('answer', '')) for i in data) / len(data), 1) if data else 0,
    'travel_phase_distribution': {
        '여행전': sum(1 for i in data if i.get('travelPhase') == '여행전'),
        '여행중': sum(1 for i in data if i.get('travelPhase') == '여행중'),
        '여행후': sum(1 for i in data if i.get('travelPhase') == '여행후')
    }
}

out = {
    'total': len(data),
    'merged_at': datetime.now().isoformat(),
    'sources': [f'XLSX: {xlsx_cnt}개', f'Memory-RAG: {len(data) - xlsx_cnt}개'],
    'statistics': stats,
    'data': data
}

with open('docs/고객질문리스트/merged_564_raw.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"✅ 완료: {len(data)}개 항목")
print(f"📊 XLSX: {xlsx_cnt}, RAG: {len(data) - xlsx_cnt}")
print(f"📈 avg keywords: {stats['avg_keywords']}, avg Q: {stats['avg_question_length']}, avg A: {stats['avg_answer_length']}")
