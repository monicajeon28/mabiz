#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PostgreSQL에 직접 데이터를 insert하는 스크립트
"""

import json
import psycopg2
from psycopg2.extras import execute_batch
import sys
import io

# Windows 터미널 UTF-8 인코딩 설정
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 환경 변수에서 DATABASE_URL 읽기
import os
db_url = "postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"

def main():
    input_file = "src/lib/data/questions_rag_memory_with_tone.json"

    print("=" * 70)
    print("Direct PostgreSQL Insert Script")
    print("=" * 70)
    print()

    # 데이터 로드
    print("[*] Loading data from {}...".format(input_file))
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    items = data.get('questions', [])
    print("[OK] Loaded {} items".format(len(items)))
    print()

    # DB 연결
    print("[*] Connecting to PostgreSQL...")
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        print("[OK] Connected")
    except Exception as e:
        print("[ERROR] Connection failed: {}".format(str(e)))
        return 1

    try:
        # upsert 쿼리 (key가 unique이므로)
        upsert_query = """
            INSERT INTO "BotGuideAnswer" (
                key, question, answer, category, type, source,
                "salesTone", keywords, "isActive", "createdAt", "updatedAt"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET
                question = EXCLUDED.question,
                answer = EXCLUDED.answer,
                category = EXCLUDED.category,
                type = EXCLUDED.type,
                source = EXCLUDED.source,
                "salesTone" = EXCLUDED."salesTone",
                keywords = EXCLUDED.keywords,
                "isActive" = EXCLUDED."isActive",
                "updatedAt" = NOW()
        """

        # 배치 준비
        batch_data = []
        for item in items:
            # salesTone JSON 처리
            sales_tone = item.get('sales_tone')
            if isinstance(sales_tone, str):
                sales_tone = {'primary': sales_tone, 'secondary': [], 'confidence': 0.8}
            else:
                sales_tone = sales_tone or {'primary': 'neutral', 'secondary': [], 'confidence': 0}

            batch_data.append((
                item['id'],
                item.get('question', ''),
                item.get('answer', ''),
                item.get('category', '기타'),
                item.get('type', 'qa'),
                item.get('source', 'ai-generated'),
                json.dumps(sales_tone, ensure_ascii=False),
                json.dumps(item.get('keywords', []), ensure_ascii=False),
                True
            ))

        # 배치 insert
        print("[*] Inserting {} items in batch...".format(len(batch_data)))
        execute_batch(cursor, upsert_query, batch_data, page_size=100)
        conn.commit()

        print("[OK] All {} items inserted/updated".format(len(batch_data)))
        print()

        # 통계 조회
        cursor.execute("SELECT COUNT(*), COUNT(DISTINCT category) FROM \"BotGuideAnswer\" WHERE \"isActive\" = true")
        total, categories = cursor.fetchone()
        print("=" * 70)
        print("Statistics")
        print("=" * 70)
        print("[*] Total active items: {}".format(total))
        print("[*] Total categories: {}".format(categories))
        print()

        # 카테고리별 통계
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM "BotGuideAnswer"
            WHERE "isActive" = true
            GROUP BY category
            ORDER BY count DESC
        """)
        print("[*] Category distribution:")
        for cat, count in cursor.fetchall():
            print("    - {}: {} items".format(cat, count))

        print()
        print("=" * 70)
        print("[DONE] Insert completed successfully!")
        print("=" * 70)

    except Exception as e:
        print("[ERROR] Insert failed: {}".format(str(e)))
        import traceback
        traceback.print_exc()
        return 1
    finally:
        cursor.close()
        conn.close()

    return 0

if __name__ == "__main__":
    exit(main())
