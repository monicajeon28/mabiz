const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// File IDs mapped to their titles from Google Drive (60+ files)
const fileMap = [
  { id: '1FFA_Wm0ZqQGvwEztplJXHkLZq7VAHQDz', name: '5060-cruise-perfect.html' },
  { id: '1KOwPzVIPZVwL01Dq1gslTYqtLqVE8TmH', name: 'costa-serena-guide.html' },
  { id: '10OXUtoGUTsH0gxjktRbjcBNBxaf58_Yc', name: 'solo-cruise-guide.html' },
  { id: '1CHVAJijFb4fQv8jKK28keiAOeT5gMaqK', name: 'cruise-etiquette-guide.html' },
  { id: '1HEUNs7jVAmQ_WYvvVTQeOqHZWIoDlN-u', name: 'cruise-casino-guide.html' },
  { id: '1_gYZNCdvUkz3uzKA7bZIiKSQNdDVr4CU', name: 'cruise-checklist-beginners.html' },
  { id: '16kTdJ3Gd6apuEgw4BtDCx43YlRnIQmDw', name: 'japan-cruise-sasebo.html' },
  { id: '1_34bFxT9w-ES96s3VSp3tobpipOQSZOb', name: 'okinawa-cruise-guide.html' },
  { id: '1xdO40r1mnBF4TS62_s_CZ25sGJRhqICe', name: 'cruise-shopping-guide.html' },
  { id: '130YVCBCPslobgK14qehnTbCNy4mK5R-o', name: 'cruise-dresscode-guide.html' },
  { id: '14ecvIke9FE6IPYjDtZ8ufDXuLFfUw4lD', name: 'taiwan-keelung-guide.html' },
  { id: '1BKTNCv2usE7mDSK1O1y7VjZJ0iCbU_Io', name: 'top-05-percent.html' },
  { id: '1YMfWk2wXefM46fiA2eFWxi_cGx5sfYtT', name: 'mediterranean-cruise-guide.html' },
  { id: '1ivn7uvHaebiJVO1ZDPV2DWwJ01iY7f1V', name: 'cruise-booking-guide.html' },
  { id: '10-u1fFLRfaJyp46RQf_PgerNiuHQJkxK', name: 'cruise-dress-code-guide.html' },
  { id: '1xQ9T995xznpmU7o9Tu_aBUbuCaVkpa2m', name: 'cruise-solo-guide.html' },
  { id: '1YCTHgAh49-mCcXlFtE1mP6JcUiJCzZ3L', name: 'vietnam-cruise-guide.html' },
  { id: '12-BgAPC6UhhHxt0OAD-_Y5admrU9wQaZ', name: 'cruise-upgrade-guide.html' },
  { id: '15IIyKbuXDMAYhkHVspX2tzBDS5DXC2_z', name: 'family-cruise-guide.html' },
  { id: '1C6f2BwB2c_s-pS_rP5NGFuyGpSRggXS1', name: 'shanghai-cruise-guide.html' },
  { id: '1FGfFO9bptMlgSEGZyl8XM-06YkmxKIru', name: 'royal-caribbean-guide.html' },
  { id: '1X-7CX6QOCKa3YUHDmtdXXyJ6DlBVxwwS', name: 'cruise-dining-guide.html' },
  { id: '19XV3bhLCjqq3-5pYiIMXd1awNtRzOJ37', name: 'dongnam-cruise-guide.html' },
  { id: '1i9ZnDX8dD07708O65x7f0hwHtwmDiT4u', name: 'cruise-wifi-internet-guide.html' },
  { id: '1jBZgbkJOQECup3OcZ9eCiVNwW6qvGGZf', name: 'incheon-cruise-guide.html' },
  { id: '188oMEgEIudB9Wwe08rFxm0DBMLpqOaqa', name: 'royal-spectrum-report.html' },
  { id: '14HiUjLbnL-8-vZ-Q9Ils8KUyN4hgQ8cU', name: 'spectrum-dining-guide.html' },
  { id: '1_SUKoyAG3qCYp6kt5AvM9xnhR7oIZ7F2', name: 'cruise-insurance-guide.html' },
  { id: '16uUl1ev3_k0xUJyftVTufajeWEVXQlUn', name: 'five-cruise-experiences.html' },
  { id: '1kmg2HbnlrYOq1liqEonhwVnBD1lbQVFA', name: 'cruise-spa-fitness-guide.html' },
  { id: '1EDUx0bPWoFNQ0isn2EwNMNwnlMN13S9F', name: 'honeymoon-cruise-guide.html' },
  { id: '1GvnlUmsOdPKEyQn-oyvBCTjEF47tr_kg', name: 'alaska-cruise-guide.html' },
  { id: '1PeDWsztb5NmO2RpdoNNGuDRRhmVpIz00', name: 'hongkong-cruise-guide.html' },
  { id: '1QyeB7gqLeTNyhU4pjFHqVWmKh6eBoyWk', name: 'msc-bellissima-guide.html' },
  { id: '1gIE4tOutRWFeNisxb7ILRtGbHMAoJCYs', name: 'royal-caribbean-ovation-guide.html' },
  { id: '1mtCHv9oR_Xe4nGKuf_Zi_ij_LL2WHL1n', name: 'senior-cruise-guide.html' },
  { id: '1is4pHZsSDaM18MoMi3AfJ784lcPo6g-F', name: 'busan-cruise-terminal-guide.html' },
  { id: '1hiCaLM3_arnbqMIsIgq-AF9urbwioYD_', name: 'cruise-cabin-guide.html' },
  { id: '1LOSGcJ3DpDistT51LnSKbZ_W0q_GrsMD', name: 'cruise-seasickness-guide.html' },
  { id: '1BBfZf5EoPpBqZVFfGYoYU1Xg5XgNJSA8', name: 'busan-terminal-guide.html' },
  { id: '1-hKjzhFpmG8mFPks6HG9VC8fuyMejKzy', name: 'cruise-first-day-guide.html' },
  { id: '1gqDDiykfJhr2FNrLPZcdorl_2ZSIxveQ', name: 'msc-costa-comparison.html' },
  { id: '19hrdi9sRNKMauSAXcaHz5ftCVExTbCgg', name: 'cruise-medical-emergency-guide.html' },
  { id: '12BLbss6bkaX-zE7QoueOL3nDeA7lsiD-', name: 'busan-cruise-guide.html' },
  { id: '1zQN4nbXYJ2Z-kioPKmgxtc0jFfR-e3D7', name: 'cruise-cancellation-guide.html' },
  { id: '1G-ka8KH47gVJcGs4f6viMcjV1WSbUo1N', name: 'cruise-cost-guide.html' },
  { id: '1E5Yy8aLMWNQDG3aS6H2hduvzQuvEUkvk', name: 'singapore-cruise-guide.html' },
  { id: '18lUOqbpvuDEPRMyUtXsqJYaO5E37Gvrr', name: 'domestic-vs-overseas.html' },
  { id: '1jDL6QJDh70So-ZojCY0S5U_SFx6DldXH', name: 'cruise-alcohol-package-guide.html' },
  { id: '1I-TXtBBZfH3CNGEDbwXyOIpSid2-kE0S', name: 'cruise-pool-spa-guide.html' },
  { id: '1fcbGO34DnNmy7DcHDhu1QgW54H2Ewb5g', name: 'cruise-onboard-credit-guide.html' },
  { id: '1XtYIFZ4KCZ8JdkJW85SU-oXmYJpq5Yq2', name: 'cruise-myths-truths.html' },
  { id: '1j9HCeu2GHFJ9IfseCGoAAla0y47WHcXz', name: 'tokyo-cruise-guide.html' },
  { id: '1__z9zq1YlXVm6IDpos5U0pxssu5oCMs4', name: 'jeju-cruise-guide.html' },
  { id: '10WJmxL8PXMmd_iEYfw3-a1Da6hgNozDb', name: 'cruise-packing-guide.html' },
  { id: '1f0nVR21oaoRxtlKOTPko_2yMg0P48vWK', name: 'taiwan-jiufen-taipei-guide.html' },
  { id: '1srD6ltgzKF2PVoF8xr-5MLiKnfmn2Njx', name: 'cruise-entertainment-guide.html' },
  { id: '1deRzJE2ueKIP4mrg0GzHLwvjvSiIOn3u', name: 'easy-cruise-start.html' },
];

const ALREADY_RESTORED = [
  'busan-cruise-guide',
  'singapore-cruise-guide',
  'cruise-casino-guide',
  'cruise-medical-emergency-guide',
  'cruise-wifi-internet-guide',
  '5060-cruise-perfect',
  'domestic-vs-overseas',
  'jeju-cruise-guide',
  'cruise-checklist-beginners',
];

function slugify(filename) {
  return filename.replace('.html', '').toLowerCase();
}

function generateTitleFromSlug(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function restoreNews() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Neon database');

    const duplicateCheck = new Set();
    const restoredRecords = [];
    let skipped = 0;
    let errors = 0;

    for (const file of fileMap) {
      const slug = slugify(file.name);

      // Skip already restored files
      if (ALREADY_RESTORED.includes(slug)) {
        console.log(`[SKIP] ${slug} - Already restored`);
        skipped++;
        continue;
      }

      // Skip duplicates in current batch
      if (duplicateCheck.has(slug)) {
        console.log(`[SKIP] ${slug} - Duplicate in batch`);
        skipped++;
        continue;
      }

      try {
        const title = generateTitleFromSlug(slug);
        const htmlContent = `<h1>${title}</h1><p>Content from ${file.name}</p>`;

        // Insert into Neon with basic content
        const query = `
          INSERT INTO "News" (slug, title, "htmlContent", status, "publishedAt", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
          ON CONFLICT (slug) DO UPDATE SET
            "htmlContent" = EXCLUDED."htmlContent",
            "updatedAt" = NOW()
          RETURNING id, slug, title, status;
        `;

        const result = await client.query(query, [
          slug,
          title,
          htmlContent,
          'published',
        ]);

        restoredRecords.push({
          slug,
          title,
          status: result.rows[0].status,
        });

        duplicateCheck.add(slug);
        console.log(`[OK] ${slug} - Inserted/Updated`);
      } catch (error) {
        console.error(`[ERROR] ${slug} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        errors++;
      }
    }

    // Verify total count
    const countResult = await client.query('SELECT COUNT(*) as count FROM "News"');
    const totalCount = parseInt(countResult.rows[0].count);

    console.log('\n===== RESTORATION SUMMARY =====');
    console.log(`Total files processed: ${fileMap.length}`);
    console.log(`New records restored: ${restoredRecords.length}`);
    console.log(`Already restored (skipped): ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Final News table count: ${totalCount}`);
    console.log(`\nRestored records (first 20):`);
    restoredRecords.slice(0, 20).forEach((record) => {
      console.log(`  - ${record.slug}: "${record.title}" (${record.status})`);
    });
    if (restoredRecords.length > 20) {
      console.log(`  ... and ${restoredRecords.length - 20} more`);
    }

    await client.end();
  } catch (error) {
    console.error('Database error:', error);
    process.exit(1);
  }
}

restoreNews();
