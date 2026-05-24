const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Load .env.local - handle both cjs and absolute paths
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Cannot find .env.local at ${envPath}`);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  });

  return env;
}

const env = loadEnvLocal();
// Manually assign to process.env
Object.keys(env).forEach(key => {
  process.env[key] = env[key];
});

// Configuration
const BACKUP_FOLDER_ID = process.env.GOOGLE_DRIVE_DB_BACKUP_FOLDER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');

// Backup files to upload
const BACKUP_FILES = [
  'schema_backup_2026-05-24_221248.prisma',
  'prisma_migrations_backup_2026-05-24_221248.zip',
  'BACKUP_SUMMARY_2026-05-24.txt'
];

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// MIME type mapping
const MIME_TYPES = {
  '.prisma': 'text/plain',
  '.zip': 'application/zip',
  '.txt': 'text/plain'
};

// Initialize Google Drive API
function getAuthClient() {
  return new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
}

// Upload file to Google Drive
async function uploadFile(auth, filePath, fileName) {
  try {
    const drive = google.drive({ version: 'v3', auth });
    const fileSize = fs.statSync(filePath).size;

    console.log(`\n📤 Uploading: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    const fileExtension = path.extname(fileName);
    const mimeType = MIME_TYPES[fileExtension] || 'application/octet-stream';

    const fileMetadata = {
      name: fileName,
      parents: [BACKUP_FOLDER_ID],
      description: `Backup file created on ${new Date().toISOString()}`
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };

    const startTime = Date.now();

    const response = await drive.files.create(
      {
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, webViewLink, createdTime'
      },
      {
        // Progress callback
        onUploadProgress: (evt) => {
          const progress = Math.round((evt.bytesProcessed / fileSize) * 100);
          process.stdout.write(`\r   Progress: ${progress}%`);
        }
      }
    );

    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const uploadedSize = (response.data.size / 1024 / 1024).toFixed(2);

    console.log(`\n   ✅ Uploaded successfully`);
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Size: ${uploadedSize} MB`);
    console.log(`   Time: ${uploadTime}s`);
    console.log(`   Link: ${response.data.webViewLink}`);

    return {
      fileName: fileName,
      fileId: response.data.id,
      size: response.data.size,
      link: response.data.webViewLink,
      createdTime: response.data.createdTime,
      uploadTime: uploadTime
    };
  } catch (error) {
    console.error(`\n   ❌ Upload failed: ${error.message}`);
    throw error;
  }
}

// Main upload process
async function uploadBackups() {
  console.log('🚀 Google Drive Backup Upload Process Started\n');
  console.log(`📁 Backup Folder ID: ${BACKUP_FOLDER_ID}`);
  console.log(`📂 Local Backup Directory: ${BACKUP_DIR}\n`);

  try {
    const auth = getAuthClient();
    const uploadResults = [];
    let successCount = 0;
    let failureCount = 0;

    // Verify backup folder exists
    console.log('🔍 Verifying backup files...');
    const missingFiles = [];

    for (const fileName of BACKUP_FILES) {
      const filePath = path.join(BACKUP_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(fileName);
        console.log(`   ⚠️  ${fileName} - NOT FOUND`);
      } else {
        const size = fs.statSync(filePath).size;
        console.log(`   ✅ ${fileName} - ${(size / 1024).toFixed(2)} KB`);
      }
    }

    if (missingFiles.length > 0) {
      console.error(`\n❌ Some backup files are missing. Aborting.`);
      process.exit(1);
    }

    console.log('\n');

    // Upload files
    for (const fileName of BACKUP_FILES) {
      try {
        const filePath = path.join(BACKUP_DIR, fileName);
        const result = await uploadFile(auth, filePath, fileName);
        uploadResults.push(result);
        successCount++;
      } catch (error) {
        failureCount++;
        uploadResults.push({
          fileName: fileName,
          error: error.message,
          status: 'FAILED'
        });
      }
    }

    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('📊 UPLOAD REPORT');
    console.log('='.repeat(60));
    console.log(`Total Files: ${BACKUP_FILES.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`Folder ID: ${BACKUP_FOLDER_ID}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    // Save detailed report
    const reportPath = path.join(BACKUP_DIR, `UPLOAD_REPORT_${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(uploadResults, null, 2));
    console.log(`\n📝 Detailed report saved: ${reportPath}`);

    // Create summary with download links
    console.log('\n📋 Uploaded Files Summary:\n');
    uploadResults.forEach((result, index) => {
      if (result.error) {
        console.log(`${index + 1}. ❌ ${result.fileName}`);
        console.log(`   Error: ${result.error}\n`);
      } else {
        console.log(`${index + 1}. ✅ ${result.fileName}`);
        console.log(`   ID: ${result.fileId}`);
        console.log(`   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Upload Time: ${result.uploadTime}s`);
        console.log(`   View: ${result.link}\n`);
      }
    });

    if (failureCount === 0) {
      console.log('✅ All backups uploaded successfully!\n');
      process.exit(0);
    } else {
      console.log(`⚠️  ${failureCount} file(s) failed to upload.\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  }
}

// Run upload
uploadBackups();
