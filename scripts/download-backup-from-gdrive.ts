import fs from 'fs';
import path from 'path';
import https from 'https';

/**
 * Download Backup_2026-05-25 xlsx files from Google Drive
 *
 * This script downloads the 16 xlsx files from the Google Drive Backup_2026-05-25 folder
 * and saves them to backups/neon-restore-2026-05-25/
 *
 * Usage:
 *   npx ts-node scripts/download-backup-from-gdrive.ts
 */

interface FileInfo {
  name: string;
  fileId: string;
  fileName: string;
}

const FILES_TO_DOWNLOAD: FileInfo[] = [
  { name: 'User', fileId: '10JPH9r0gQw0RE8k9cdEFwGNvvA57ZmRn', fileName: 'User_2026-05-25_15-00-47.xlsx' },
  { name: 'Trip', fileId: '1d4lAmEkndld0JZYc1A-RQCTdepoPIMBf', fileName: 'Trip_2026-05-25_15-00-49.xlsx' },
  { name: 'Reservation', fileId: '1S8a_Iu9y9kqOuVDAPObN6rOeSfEyHENL', fileName: 'Reservation_2026-05-25_15-00-50.xlsx' },
  { name: 'Traveler', fileId: '1tWBOOr2t8j1cemoCUxQgiCVhFm__omsG', fileName: 'Traveler_2026-05-25_15-00-52.xlsx' },
  { name: 'AffiliateProfile', fileId: '1dbpXJ-tFzJlLAZcduCFPPuV-lx9BsrNn', fileName: 'AffiliateProfile_2026-05-25_15-00-53.xlsx' },
  { name: 'AffiliateSale', fileId: '1EJsuKLTib75d_kTQKmZDQFlVs36I0ICI', fileName: 'AffiliateSale_2026-05-25_15-00-55.xlsx' },
  { name: 'AffiliateLead', fileId: '1XRtJiijkaheQt-3PUZ5-vMFPoqsfFNLO', fileName: 'AffiliateLead_2026-05-25_15-00-57.xlsx' },
  { name: 'AffiliateProduct', fileId: '1IqyI2Z9n90LJJY0u24q3nxyTCFsYFP0N', fileName: 'AffiliateProduct_2026-05-25_15-00-58.xlsx' },
  { name: 'AffiliateLedger', fileId: '1EKW9RNx5rhUpglS9Ycn74StJnuWOnm6B', fileName: 'AffiliateLedger_2026-05-25_15-01-00.xlsx' },
  { name: 'AdminActionLog', fileId: '1TTqXG4Ytkgo6Fxm81KZmcYIRe2TpiJM-', fileName: 'AdminActionLog_2026-05-25_15-01-03.xlsx' },
  { name: 'CruiseProduct', fileId: '1S2bc_oJbxKXSwteTFYTZW5m_G_giMybR', fileName: 'CruiseProduct_2026-05-25_15-01-05.xlsx' },
  { name: 'ProductPricePeriod', fileId: '1PGVdnuBeL63OUxJSLaeaPwa7LJNeuUgF', fileName: 'ProductPricePeriod_2026-05-25_15-01-06.xlsx' },
  { name: 'ProductCabinPrice', fileId: '1JcOG7mX1Psdgmo696bnC49-knDcGU9wE', fileName: 'ProductCabinPrice_2026-05-25_15-01-08.xlsx' },
  { name: 'ProductImage', fileId: '1_BFs3XdoJTrorWAeNtC-SC9CoNqIpCJ4', fileName: 'ProductImage_2026-05-25_15-01-10.xlsx' },
  { name: 'PassportSubmission', fileId: '1QEqZ-TBTzTyNrKJSd9hDHTjvMScs_k0q', fileName: 'PassportSubmission_2026-05-25_15-01-02.xlsx' },
];

class GoogleDriveDownloader {
  private backupDir: string;

  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups', 'neon-restore-2026-05-25');
    this.ensureBackupDir();
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`[SETUP] Created backup directory: ${this.backupDir}`);
    }
  }

  private downloadFile(fileId: string, fileName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const filePath = path.join(this.backupDir, fileName);

      // Check if file already exists
      if (fs.existsSync(filePath)) {
        console.log(`[DOWNLOAD] ✓ Already exists: ${fileName}`);
        resolve(true);
        return;
      }

      try {
        // Google Drive export URL for direct download
        const url = `https://drive.google.com/uc?export=download&id=${fileId}`;

        const file = fs.createWriteStream(filePath);

        https
          .get(url, (response) => {
            // Handle redirect
            if (response.statusCode === 302 || response.statusCode === 301) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                https.get(redirectUrl, (redirectResponse) => {
                  redirectResponse.pipe(file);
                  file.on('finish', () => {
                    file.close();
                    console.log(`[DOWNLOAD] ✓ Downloaded: ${fileName}`);
                    resolve(true);
                  });
                });
              }
            } else {
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                console.log(`[DOWNLOAD] ✓ Downloaded: ${fileName}`);
                resolve(true);
              });
            }
          })
          .on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete the file on error
            console.error(`[DOWNLOAD] ✗ Error downloading ${fileName}:`, err.message);
            resolve(false);
          });
      } catch (error: any) {
        console.error(`[DOWNLOAD] ✗ Error with ${fileName}:`, error.message);
        resolve(false);
      }
    });
  }

  async downloadAll(): Promise<void> {
    console.log('================================================');
    console.log('Google Drive Backup Downloader');
    console.log('================================================\n');

    console.log(`[SETUP] Target directory: ${this.backupDir}\n`);

    let successCount = 0;
    let skipCount = 0;

    for (const file of FILES_TO_DOWNLOAD) {
      const filePath = path.join(this.backupDir, file.fileName);
      if (fs.existsSync(filePath)) {
        console.log(`[CHECK] ℹ️  Already exists: ${file.fileName}`);
        skipCount++;
        continue;
      }

      console.log(`[DOWNLOAD] Downloading ${file.name}...`);
      const success = await this.downloadFile(file.fileId, file.fileName);
      if (success) successCount++;
    }

    console.log(`\n================================================`);
    console.log(`Download Summary`);
    console.log(`================================================`);
    console.log(`Downloaded: ${successCount}/${FILES_TO_DOWNLOAD.length} new files`);
    console.log(`Already existed: ${skipCount}/${FILES_TO_DOWNLOAD.length} files`);
    console.log(`\nFiles location: ${this.backupDir}\n`);
  }
}

async function main() {
  try {
    const downloader = new GoogleDriveDownloader();
    await downloader.downloadAll();
    console.log('[SUCCESS] Download complete\n');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Fatal error:', error);
    process.exit(1);
  }
}

main();
