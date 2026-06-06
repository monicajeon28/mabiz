import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { getMabizSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  // DB 스키마 노출 차단 — GLOBAL_ADMIN만 접근 가능
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

    // 각 테이블의 행 수 조회
    const tableStats: Record<string, number> = {};
    for (const table of allTables) {
      const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
      tableStats[table] = parseInt(countResult.rows[0].count ?? 0);
    }

    // News/Community 관련 테이블만 따로 표시
    const newsRelated = allTables.filter(t =>
      t.toLowerCase().includes('news') ||
      t.toLowerCase().includes('community') ||
      t.toLowerCase().includes('newsletter') ||
      t.toLowerCase().includes('dashboard')
    );

    return NextResponse.json({
      allTables: allTables.length,
      tableStats,
      newsRelatedTables: newsRelated,
      newsRelatedStats: Object.fromEntries(
        newsRelated.map(t => [t, tableStats[t]])
      ),
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
