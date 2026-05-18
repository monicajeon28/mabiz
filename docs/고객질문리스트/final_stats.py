#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
최종 통계 확인
"""

import psycopg2
import sys
import io

if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

db_url = 'postgresql://neondb_owner:npg_lAI4jQLnG1KN@ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# 전체 통계
cursor.execute('SELECT COUNT(*), COUNT(DISTINCT category) FROM "BotGuideAnswer" WHERE "isActive" = true')
total, categories = cursor.fetchone()

print('=' * 70)
print('Final Statistics')
print('=' * 70)
print('Total active items: {}'.format(total))
print('Total categories: {}'.format(categories))
print()

# 카테고리별 상세
cursor.execute('''
    SELECT category, COUNT(*) as count
    FROM "BotGuideAnswer"
    WHERE "isActive" = true
    GROUP BY category
    ORDER BY count DESC
''')

print('Category distribution:')
for cat, count in cursor.fetchall():
    print('  - {}: {} items'.format(cat, count))

print()

# 소스별 통계
cursor.execute('''
    SELECT source, COUNT(*) as count
    FROM "BotGuideAnswer"
    WHERE "isActive" = true
    GROUP BY source
    ORDER BY count DESC
''')

print('Source distribution:')
for source, count in cursor.fetchall():
    print('  - {}: {} items'.format(source[:40], count))

cursor.close()
conn.close()

print()
print('=' * 70)
print('[SUCCESS] Complete Cruise Bot Q&A Loading!')
print('=' * 70)
