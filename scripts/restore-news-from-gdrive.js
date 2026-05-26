const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// File IDs mapped to their titles from Google Drive
const fileMap = [
  { id: '1FFA_Wm0ZqQGvwEztplJXHkLZq7VAHQDz', title: '5060-cruise-perfect.html' },
  { id: '1KOwPzVIPZVwL01Dq1gslTYqtLqVE8TmH', title: 'costa-serena-guide.html' },
  { id: '10OXUtoGUTsH0gxjktRbjcBNBxaf58_Yc', title: 'solo-cruise-guide.html' },
  { id: '1CHVAJijFb4fQv8jKK28keiAOeT5gMaqK', title: 'cruise-etiquette-guide.html' },
  { id: '1HEUNs7jVAmQ_WYvvVTQeOqHZWIoDlN-u', title: 'cruise-casino-guide.html' },
  { id: '1_gYZNCdvUkz3uzKA7bZIiKSQNdDVr4CU', title: 'cruise-checklist-beginners.html' },
  { id: '16kTdJ3Gd6apuEgw4BtDCx43YlRnIQmDw', title: 'japan-cruise-sasebo.html' },
  { id: '1_34bFxT9w-ES96s3VSp3tobpipOQSZOb', title: 'okinawa-cruise-guide.html' },
  { id: '1xdO40r1mnBF4TS62_s_CZ25sGJRhqICe', title: 'cruise-shopping-guide.html' },
  { id: '130YVCBCPslobgK14qehnTbCNy4mK5R-o', title: 'cruise-dresscode-guide.html' },
  { id: '14ecvIke9FE6IPYjDtZ8ufDXuLFfUw4lD', title: 'taiwan-keelung-guide.html' },
  { id: '1BKTNCv2usE7mDSK1O1y7VjZJ0iCbU_Io', title: 'top-05-percent.html' },
  { id: '1YMfWk2wXefM46fiA2eFWxi_cGx5sfYtT', title: 'mediterranean-cruise-guide.html' },
  { id: '1ivn7uvHaebiJVO1ZDPV2DWwJ01iY7f1V', title: 'cruise-booking-guide.html' },
  { id: '10-u1fFLRfaJyp46RQf_PgerNiuHQJkxK', title: 'cruise-dress-code-guide.html' },
  { id: '1xQ9T995xznpmU7o9Tu_aBUbuCaVkpa2m', title: 'cruise-solo-guide.html' },
  { id: '1YCTHgAh49-mCcXlFtE1mP6JcUiJCzZ3L', title: 'vietnam-cruise-guide.html' },
  { id: '12-BgAPC6UhhHxt0OAD-_Y5admrU9wQaZ', title: 'cruise-upgrade-guide.html' },
  { id: '15IIyKbuXDMAYhkHVspX2tzBDS5DXC2_z', title: 'family-cruise-guide.html' },
  { id: '1C6f2BwB2c_s-pS_rP5NGFuyGpSRggXS1', title: 'shanghai-cruise-guide.html' },
  { id: '1FGfFO9bptMlgSEGZyl8XM-06YkmxKIru', title: 'royal-caribbean-guide.html' },
  { id: '1X-7CX6QOCKa3YUHDmtdXXyJ6DlBVxwwS', title: 'cruise-dining-guide.html' },
  { id: '19XV3bhLCjqq3-5pYiIMXd1awNtRzOJ37', title: 'dongnam-cruise-guide.html' },
  { id: '1i9ZnDX8dD07708O65x7f0hwHtwmDiT4u', title: 'cruise-wifi-internet-guide.html' },
  { id: '1jBZgbkJOQECup3OcZ9eCiVNwW6qvGGZf', title: 'incheon-cruise-guide.html' },
  { id: '188oMEgEIudB9Wwe08rFxm0DBMLpqOaqa', title: 'royal-spectrum-report.html' },
  { id: '14HiUjLbnL-8-vZ-Q9Ils8KUyN4hgQ8cU', title: 'spectrum-dining-guide.html' },
  { id: '1_SUKoyAG3qCYp6kt5AvM9xnhR7oIZ7F2', title: 'cruise-insurance-guide.html' },
  { id: '16uUl1ev3_k0xUJyftVTufajeWEVXQlUn', title: 'five-cruise-experiences.html' },
  { id: '1kmg2HbnlrYOq1liqEonhwVnBD1lbQVFA', title: 'cruise-spa-fitness-guide.html' },
  { id: '1EDUx0bPWoFNQ0isn2EwNMNwnlMN13S9F', title: 'honeymoon-cruise-guide.html' },
  { id: '1GvnlUmsOdPKEyQn-oyvBCTjEF47tr_kg', title: 'alaska-cruise-guide.html' },
  { id: '1PeDWsztb5NmO2RpdoNNGuDRRhmVpIz00', title: 'hongkong-cruise-guide.html' },
  { id: '1QyeB7gqLeTNyhU4pjFHqVWmKh6eBoyWk', title: 'msc-bellissima-guide.html' },
  { id: '1gIE4tOutRWFeNisxb7ILRtGbHMAoJCYs', title: 'royal-caribbean-ovation-guide.html' },
  { id: '1mtCHv9oR_Xe4nGKuf_Zi_ij_LL2WHL1n', title: 'senior-cruise-guide.html' },
  { id: '1is4pHZsSDaM18MoMi3AfJ784lcPo6g-F', title: 'busan-cruise-terminal-guide.html' },
  { id: '1hiCaLM3_arnbqMIsIgq-AF9urbwioYD_', title: 'cruise-cabin-guide.html' },
  { id: '1LOSGcJ3DpDistT51LnSKbZ_W0q_GrsMD', title: 'cruise-seasickness-guide.html' },
  { id: '1BBfZf5EoPpBqZVFfGYoYU1Xg5XgNJSA8', title: 'busan-terminal-guide.html' },
  { id: '1-hKjzhFpmG8mFPks6HG9VC8fuyMejKzy', title: 'cruise-first-day-guide.html' },
  { id: '1gqDDiykfJhr2FNrLPZcdorl_2ZSIxveQ', title: 'msc-costa-comparison.html' },
  { id: '19hrdi9sRNKMauSAXcaHz5ftCVExTbCgg', title: 'cruise-medical-emergency-guide.html' },
  { id: '12BLbss6bkaX-zE7QoueOL3nDeA7lsiD-', title: 'busan-cruise-guide.html' },
  { id: '1zQN4nbXYJ2Z-kioPKmgxtc0jFfR-e3D7', title: 'cruise-cancellation-guide.html' },
  { id: '1G-ka8KH47gVJcGs4f6viMcjV1WSbUo1N', title: 'cruise-cost-guide.html' },
  { id: '1E5Yy8aLMWNQDG3aS6H2hduvzQuvEUkvk', title: 'singapore-cruise-guide.html' },
  { id: '18lUOqbpvuDEPRMyUtXsqJYaO5E37Gvrr', title: 'domestic-vs-overseas.html' },
  { id: '1jDL6QJDh70So-ZojCY0S5U_SFx6DldXH', title: 'cruise-alcohol-package-guide.html' },
  { id: '1I-TXtBBZfH3CNGEDbwXyOIpSid2-kE0S', title: 'cruise-pool-spa-guide.html' },
  { id: '1fcbGO34DnNmy7DcHDhu1QgW54H2Ewb5g', title: 'cruise-onboard-credit-guide.html' },
  { id: '1XtYIFZ4KCZ8JdkJW85SU-oXmYJpq5Yq2', title: 'cruise-myths-truths.html' },
  { id: '1j9HCeu2GHFJ9IfseCGoAAla0y47WHcXz', title: 'tokyo-cruise-guide.html' },
  { id: '1__z9zq1YlXVm6IDpos5U0pxssu5oCMs4', title: 'jeju-cruise-guide.html' },
  { id: '10WJmxL8PXMmd_iEYfw3-a1Da6hgNozDb', title: 'cruise-packing-guide.html' },
  { id: '1f0nVR21oaoRxtlKOTPko_2yMg0P48vWK', title: 'taiwan-jiufen-taipei-guide.html' },
  { id: '1srD6ltgzKF2PVoF8xr-5MLiKnfmn2Njx', title: 'cruise-entertainment-guide.html' },
  { id: '1deRzJE2ueKIP4mrg0GzHLwvjvSiIOn3u', title: 'easy-cruise-start.html' },
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

function extractTitleFromHtml(html) {
  // Try to get title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  // Try to get title from <h1> tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    return h1Match[1].trim();
  }

  // Fallback to filename-based title
  return 'Cruise Guide';
}

function extractContentFromHtml(html) {
  // Try to extract main content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    return bodyMatch[1].trim();
  }

  return html;
}

async function downloadAndRestoreNews() {
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
      const slug = slugify(file.title);

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
        // Download from Google Drive
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
        console.log(`[DOWNLOAD] ${slug} from Google Drive...`);

        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.statusText}`);
        }

        const html = await response.text();
        const title = extractTitleFromHtml(html);
        const content = extractContentFromHtml(html);

        // Insert into Neon
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
          content,
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
    console.log(`\nRestored records:`);
    restoredRecords.forEach((record) => {
      console.log(`  - ${record.slug}: "${record.title}" (${record.status})`);
    });

    await client.end();
  } catch (error) {
    console.error('Database error:', error);
    process.exit(1);
  }
}

downloadAndRestoreNews();
