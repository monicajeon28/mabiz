import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { getMabizSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const ctx = await getMabizSession();
  if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const client = new Client({
    connectionString: process.env.SUPABASE_BACKUP_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // 모든 public 테이블 조회
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const allTables = result.rows.map(r => r.tablename);

    // 각 테이블의 행 수와 크기 조회
    const tableInfo: Array<{ name: string; rows: number; size: string }> = [];

    for (const table of allTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const count = parseInt(countResult.rows[0].count ?? 0);

        const sizeResult = await client.query(`
          SELECT pg_size_pretty(pg_total_relation_size('${table}')) as size
        `);
        const size = sizeResult.rows[0].size || '0 bytes';

        if (count > 0) {
          tableInfo.push({ name: table, rows: count, size });
        }
      } catch (e) {
        // Skip errors
      }
    }

    // 데이터가 있는 테이블만 정렬 (내림차순)
    tableInfo.sort((a, b) => b.rows - a.rows);

    // News/Community 찾기
    const newsRelated = tableInfo.filter(t =>
      t.name.toLowerCase().includes('news') ||
      t.name.toLowerCase().includes('community')
    );

    return NextResponse.json({
      totalTables: allTables.length,
      tablesWithData: tableInfo.length,
      allTablesBySize: tableInfo,
      newsRelatedData: newsRelated,
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}
