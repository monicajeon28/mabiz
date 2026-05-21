const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnynywuxapxvythbcagz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueW55d3V4YXB4dnl0aGJjYWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTU0NjczNTUsImV4cCI6MTk3NzE0MzM1NX0.8Ky0nYrK0XF2G8bH3N0Q5W7X8Y9Z0A1B2C3D4E5F6';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  try {
    // 모든 User 조회
    const { data, error } = await supabase
      .from('User')
      .select('id, phone, mallUserId, name, role')
      .or(`phone.ilike.%boss%, phone.ilike.%sales%, mallUserId.ilike.%boss%, mallUserId.ilike.%sales%`);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ boss/sales 계정 없음. 전체 User 데이터:');
      const { data: allUsers } = await supabase
        .from('User')
        .select('id, phone, mallUserId, name, role')
        .limit(10);
      console.log(allUsers);
      return;
    }
    
    console.log('✅ 찾은 계정들:');
    console.log(data);
  } catch (err) {
    console.error('Error:', err);
  }
}

checkUsers();
