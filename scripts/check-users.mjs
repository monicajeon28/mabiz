import pg from 'pg';
const { Client } = pg;

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL) {
  console.error('❌ DATABASE_URL 미설정');
  process.exit(1);
}

const client = new Client({ connectionString: NEON_URL });

async function checkUsers() {
  try {
    await client.connect();
    console.log('✅ Neon 연결 성공\n');

    // 1. admin1 조회
    console.log('🔍 admin1 사용자 조회:');
    const admin1Result = await client.query(
      `SELECT id, phone, name, role, "mallUserId", password, "isLocked" FROM "User"
       WHERE "mallUserId" = 'admin1' OR phone = 'admin1' OR name LIKE '%admin1%'`
    );
    if (admin1Result.rows.length > 0) {
      admin1Result.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Phone: ${row.phone}, Role: ${row.role}, MallUserId: ${row.mallUserId}, Locked: ${row.isLocked}`);
        console.log(`  Name: ${row.name}`);
        console.log(`  Password Hash: ${row.password.substring(0, 20)}...`);
      });
    } else {
      console.log('  ❌ admin1 찾을 수 없음');
    }

    // 2. boss1 조회
    console.log('\n🔍 boss1 사용자 조회:');
    const boss1Result = await client.query(
      `SELECT id, phone, name, role, "mallUserId", password, "isLocked" FROM "User"
       WHERE "mallUserId" = 'boss1' OR phone = 'boss1' OR phone LIKE '%boss%'`
    );
    if (boss1Result.rows.length > 0) {
      boss1Result.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Phone: ${row.phone}, Role: ${row.role}, MallUserId: ${row.mallUserId}, Locked: ${row.isLocked}`);
        console.log(`  Name: ${row.name}`);
        console.log(`  Password Hash: ${row.password.substring(0, 20)}...`);
      });
    } else {
      console.log('  ❌ boss1 찾을 수 없음');
    }

    // 3. sales1 조회
    console.log('\n🔍 sales1 사용자 조회:');
    const sales1Result = await client.query(
      `SELECT id, phone, name, role, "mallUserId", password, "isLocked" FROM "User"
       WHERE "mallUserId" = 'sales1' OR phone = 'sales1' OR phone LIKE '%sales%'`
    );
    if (sales1Result.rows.length > 0) {
      sales1Result.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Phone: ${row.phone}, Role: ${row.role}, MallUserId: ${row.mallUserId}, Locked: ${row.isLocked}`);
        console.log(`  Name: ${row.name}`);
        console.log(`  Password Hash: ${row.password.substring(0, 20)}...`);
      });
    } else {
      console.log('  ❌ sales1 찾을 수 없음');
    }

    // 4. GlobalAdmin 테이블 조회
    console.log('\n🔍 GlobalAdmin 테이블:');
    const adminResult = await client.query(
      `SELECT id, phone, name FROM "GlobalAdmin" LIMIT 5`
    );
    if (adminResult.rows.length > 0) {
      adminResult.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Phone: ${row.phone}, Name: ${row.name}`);
      });
    } else {
      console.log('  ❌ GlobalAdmin 레코드 없음');
    }

    // 5. MabizSession 조회 (최근 10개)
    console.log('\n🔍 MabizSession (최근 10개):');
    const sessionResult = await client.query(
      `SELECT id, "adminId", "mallUserId", "memberId", role, "createdAt" FROM "MabizSession"
       ORDER BY "createdAt" DESC LIMIT 10`
    );
    if (sessionResult.rows.length > 0) {
      sessionResult.rows.forEach(row => {
        console.log(`  ${new Date(row.createdAt).toLocaleString('ko-KR')}: Role=${row.role}, AdminID=${row.adminId}, MallUserID=${row.mallUserId}, MemberID=${row.memberId}`);
      });
    }

  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkUsers();
