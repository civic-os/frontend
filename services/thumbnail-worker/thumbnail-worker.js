/**
 * Civic OS Thumbnail Worker
 *
 * Listens for file uploads and generates thumbnails asynchronously.
 * - Images: 3 sizes (150px, 400px, 800px)
 * - PDFs: 1 size (400px first page preview)
 *
 * Architecture:
 * PostgreSQL NOTIFY → This Worker → S3 Upload → Update DB
 */

const { Client } = require('pg');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execFileAsync = promisify(execFile);

// Configuration
// Note: pg module natively reads PG* environment variables (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
// If DATABASE_URL is provided, we use that instead
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_BUCKET = process.env.S3_BUCKET || 'civic-os-files';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Thumbnail sizes
const THUMBNAIL_SIZES = {
  small: { width: 150, height: 150, quality: 75 },
  medium: { width: 400, height: 400, quality: 80 },
  large: { width: 800, height: 800, quality: 85 }
};

// Configure S3 client
const s3Config = {
  region: AWS_REGION,
  signatureVersion: 'v4'
};

if (S3_ENDPOINT) {
  s3Config.endpoint = S3_ENDPOINT;
  s3Config.s3ForcePathStyle = true;  // Required for MinIO
}

const s3 = new AWS.S3(s3Config);

/**
 * Generate S3 key for thumbnails
 * Structure: {entity_type}/{entity_id}/{file_id}/thumb-{size}.jpg
 */
function generateThumbnailKey(s3OriginalKey, size) {
  const basePath = s3OriginalKey.replace(/\/original\..*$/, '');
  return `${basePath}/thumb-${size}.jpg`;
}

/**
 * Main Worker Class
 */
class ThumbnailWorker {
  constructor() {
    // pg module automatically reads PG* env vars (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
    // Only pass connectionString if DATABASE_URL is explicitly provided
    const clientConfig = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {};
    this.client = new Client(clientConfig);
    this.isShuttingDown = false;
  }

  async start() {
    try {
      // Connect to PostgreSQL
      await this.client.connect();
      console.log('✅ Connected to PostgreSQL');

      // Listen for file uploads
      await this.client.query('LISTEN file_uploaded');
      console.log('👂 Listening for file uploads...');

      // Handle notifications
      this.client.on('notification', async (msg) => {
        if (this.isShuttingDown) return;

        try {
          const payload = JSON.parse(msg.payload);
          await this.processFile(payload);
        } catch (error) {
          console.error('❌ Error processing notification:', error);
        }
      });

      // Handle connection errors
      this.client.on('error', (err) => {
        console.error('❌ PostgreSQL connection error:', err);
        if (!this.isShuttingDown) {
          process.exit(1);
        }
      });

      // Process any existing pending files (recovery from downtime)
      await this.processBacklog();

      console.log(`🚀 Thumbnail Worker running (bucket: ${S3_BUCKET})`);
    } catch (error) {
      console.error('💥 Failed to start worker:', error);
      process.exit(1);
    }
  }

  /**
   * Process backlog of pending thumbnails
   * Runs on startup to handle files uploaded while worker was down
   */
  async processBacklog() {
    const { rows } = await this.client.query(`
      SELECT id, s3_original_key, file_type, entity_type, entity_id
      FROM metadata.files
      WHERE thumbnail_status = 'pending'
         OR (thumbnail_status = 'failed' AND updated_at < NOW() - INTERVAL '1 hour')
      ORDER BY created_at ASC
      LIMIT 100
    `);

    if (rows.length > 0) {
      console.log(`📦 Processing ${rows.length} files from backlog`);
      for (const row of rows) {
        await this.processFile({
          file_id: row.id,
          s3_key: row.s3_original_key,
          file_type: row.file_type,
          entity_type: row.entity_type,
          entity_id: row.entity_id
        });
      }
    }
  }

  /**
   * Process file based on type
   */
  async processFile({ file_id, s3_key, file_type }) {
    console.log(`🔄 Processing file ${file_id} (${file_type})`);

    // Update status to processing
    await this.updateFileStatus(file_id, 'processing');

    try {
      if (file_type.startsWith('image/')) {
        await this.processImage(file_id, s3_key);
      } else if (file_type === 'application/pdf') {
        await this.processPdf(file_id, s3_key);
      } else {
        // Non-image, non-PDF files don't get thumbnails
        await this.updateFileStatus(file_id, 'not_applicable');
        console.log(`⏭️  Skipped ${file_id} (not an image or PDF)`);
      }
    } catch (error) {
      console.error(`❌ Error processing file ${file_id}:`, error);
      await this.updateFileWithError(file_id, error.message);
    }
  }

  /**
   * Process image file - generate 3 thumbnail sizes
   */
  async processImage(fileId, s3Key) {
    // Download original from S3
    const original = await this.downloadFromS3(s3Key);

    // Generate all thumbnails in parallel
    const thumbnailPromises = Object.entries(THUMBNAIL_SIZES).map(
      async ([size, config]) => {
        const thumbnail = await sharp(original)
          .resize(config.width, config.height, {
            fit: 'cover',
            position: 'center'  // Center crop for consistent 1:1 thumbnails
          })
          .flatten({ background: { r: 255, g: 255, b: 255 } })  // Composite transparent pixels onto white
          .jpeg({ quality: config.quality, progressive: true })
          .toBuffer();

        const thumbnailKey = generateThumbnailKey(s3Key, size);
        await this.uploadToS3(thumbnailKey, thumbnail, 'image/jpeg');

        return { size, key: thumbnailKey };
      }
    );

    const thumbnails = await Promise.all(thumbnailPromises);

    // Update database with all thumbnail keys
    await this.client.query(`
      UPDATE metadata.files
      SET thumbnail_status = $1,
          s3_thumbnail_small_key = $2,
          s3_thumbnail_medium_key = $3,
          s3_thumbnail_large_key = $4,
          updated_at = NOW()
      WHERE id = $5
    `, [
      'completed',
      thumbnails.find(t => t.size === 'small').key,
      thumbnails.find(t => t.size === 'medium').key,
      thumbnails.find(t => t.size === 'large').key,
      fileId
    ]);

    console.log(`✅ Generated 3 thumbnails for image ${fileId}`);
  }

  /**
   * Process PDF file - generate first page thumbnail
   */
  async processPdf(fileId, s3Key) {
    const tempDir = os.tmpdir();
    const tempPdfPath = path.join(tempDir, `${fileId}.pdf`);
    const tempPngPath = path.join(tempDir, fileId);

    try {
      // Download PDF from S3
      const pdfBuffer = await this.downloadFromS3(s3Key);
      fs.writeFileSync(tempPdfPath, pdfBuffer);

      // Convert first page to PNG using pdftoppm (poppler-utils)
      // pdftoppm -png -f 1 -l 1 -scale-to 2048 input.pdf output-prefix
      // This creates output-prefix-1.png for the first page
      await execFileAsync('pdftoppm', [
        '-png',           // Output format
        '-f', '1',        // First page
        '-l', '1',        // Last page
        '-scale-to', '2048',  // Scale to width (high resolution for quality)
        tempPdfPath,      // Input PDF
        tempPngPath       // Output prefix
      ]);

      // Read generated PNG (pdftoppm names it {prefix}-1.png)
      const pngPath = `${tempPngPath}-1.png`;
      if (!fs.existsSync(pngPath)) {
        throw new Error('PDF conversion failed - output file not found');
      }

      const pngBuffer = fs.readFileSync(pngPath);

      // Generate medium thumbnail (400px) using Sharp
      const thumbnail = await sharp(pngBuffer)
        .resize(400, 400, {
          fit: 'inside',  // Preserve aspect ratio
          withoutEnlargement: true
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })  // Composite transparent pixels onto white
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      // Upload to S3
      const thumbnailKey = generateThumbnailKey(s3Key, 'medium');
      await this.uploadToS3(thumbnailKey, thumbnail, 'image/jpeg');

      // Update database (PDFs only get medium thumbnail)
      await this.client.query(`
        UPDATE metadata.files
        SET thumbnail_status = $1,
            s3_thumbnail_medium_key = $2,
            updated_at = NOW()
        WHERE id = $3
      `, ['completed', thumbnailKey, fileId]);

      console.log(`✅ Generated PDF thumbnail for ${fileId}`);

    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        if (fs.existsSync(`${tempPngPath}-1.png`)) fs.unlinkSync(`${tempPngPath}-1.png`);
      } catch (err) {
        console.error('Error cleaning up temp files:', err);
      }
    }
  }

  /**
   * Download file from S3
   */
  async downloadFromS3(key) {
    const response = await s3.getObject({
      Bucket: S3_BUCKET,
      Key: key
    }).promise();

    return response.Body;
  }

  /**
   * Upload file to S3
   */
  async uploadToS3(key, buffer, contentType) {
    await s3.putObject({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000'  // 1 year
    }).promise();
  }

  /**
   * Update file status
   */
  async updateFileStatus(fileId, status) {
    await this.client.query(
      `UPDATE metadata.files SET thumbnail_status = $1, updated_at = NOW() WHERE id = $2`,
      [status, fileId]
    );
  }

  /**
   * Update file with error
   */
  async updateFileWithError(fileId, errorMessage) {
    await this.client.query(
      `UPDATE metadata.files
       SET thumbnail_status = $1,
           thumbnail_error = $2,
           updated_at = NOW()
       WHERE id = $3`,
      ['failed', errorMessage, fileId]
    );
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;

    console.log('\n🛑 Shutting down Thumbnail Worker...');
    this.isShuttingDown = true;

    try {
      await this.client.query('UNLISTEN file_uploaded');
      await this.client.end();
      console.log('✅ PostgreSQL connection closed');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }

    process.exit(0);
  }
}

// Start worker
const worker = new ThumbnailWorker();
worker.start().catch(err => {
  console.error('Failed to start Thumbnail Worker:', err);
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => worker.shutdown());
process.on('SIGINT', () => worker.shutdown());
