const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create CommunityComment table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CommunityComment" (
        id INTEGER PRIMARY KEY,
        "postId" INTEGER NOT NULL REFERENCES "CommunityPost"(id) ON DELETE CASCADE,
        "userId" INTEGER,
        "parentCommentId" INTEGER REFERENCES "CommunityComment"(id) ON DELETE CASCADE,
        content TEXT,
        "authorName" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Created CommunityComment table');

    // Verify table exists
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'CommunityComment'
    `);

    if (result.rows.length > 0) {
      console.log('Table verified: CommunityComment exists');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

main();
