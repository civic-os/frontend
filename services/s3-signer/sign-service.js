/**
 * Civic OS S3 Signing Service
 *
 * Listens for PostgreSQL NOTIFY events and generates presigned S3 upload URLs.
 * Maintains PostgreSQL/PostgREST as exclusive communication hub for Angular.
 *
 * Architecture:
 * Angular → PostgREST → PostgreSQL → NOTIFY → This Service → Update DB
 */

const { Client } = require('pg');
const AWS = require('aws-sdk');

// Configuration
// Note: pg module natively reads PG* environment variables (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
// If DATABASE_URL is provided, we use that instead
const S3_ENDPOINT = process.env.S3_ENDPOINT;  // Internal endpoint for S3 client operations
const S3_PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT;  // Public endpoint for browser-accessible URLs
const S3_BUCKET = process.env.S3_BUCKET || 'civic-os-files';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const PORT = process.env.PORT || 3001;

// Configure S3 client for operations (uses internal endpoint)
const s3Config = {
  region: AWS_REGION,
  signatureVersion: 'v4'
};

// MinIO/local development support
if (S3_ENDPOINT) {
  s3Config.endpoint = S3_ENDPOINT;
  s3Config.s3ForcePathStyle = true;  // Required for MinIO
}

const s3 = new AWS.S3(s3Config);

// Configure S3 client for presigned URL generation (uses public endpoint)
// This ensures presigned URLs are accessible from browsers
const s3SignerConfig = {
  region: AWS_REGION,
  signatureVersion: 'v4'
};

if (S3_PUBLIC_ENDPOINT) {
  s3SignerConfig.endpoint = S3_PUBLIC_ENDPOINT;
  s3SignerConfig.s3ForcePathStyle = true;
} else if (S3_ENDPOINT) {
  s3SignerConfig.endpoint = S3_ENDPOINT;
  s3SignerConfig.s3ForcePathStyle = true;
}

const s3Signer = new AWS.S3(s3SignerConfig);

/**
 * Generate S3 key for file storage
 * Structure: {entity_type}/{entity_id}/{file_id}/original.{ext}
 *
 * @param {string} fileId - UUIDv7 file identifier
 * @param {string} fileName - Original filename
 * @param {string} entityType - Entity type (e.g., 'issues')
 * @param {string} entityId - Entity UUID
 * @param {string} variant - 'original' | 'small' | 'medium' | 'large'
 * @returns {string} S3 object key
 */
function generateS3Key(fileId, fileName, entityType, entityId, variant = 'original') {
  const basePath = `${entityType}/${entityId}/${fileId}`;

  if (variant === 'original') {
    // Preserve original extension
    const ext = fileName.split('.').pop().toLowerCase();
    return `${basePath}/original.${ext}`;
  } else {
    // Thumbnails always saved as JPEG
    return `${basePath}/thumb-${variant}.jpg`;
  }
}

/**
 * Main Service Class
 */
class S3SignerService {
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
      // Log connection attempt for debugging
      const connInfo = process.env.DATABASE_URL
        ? `DATABASE_URL (host from URL)`
        : `PG* env vars (PGHOST=${process.env.PGHOST}, PGDATABASE=${process.env.PGDATABASE})`;
      console.log(`🔌 Attempting PostgreSQL connection via ${connInfo}...`);

      // Connect to PostgreSQL
      await this.client.connect();
      console.log('✅ Connected to PostgreSQL');

      // Listen for upload URL requests
      await this.client.query('LISTEN upload_url_request');
      console.log('👂 Listening for upload URL requests...');

      // Handle notifications
      this.client.on('notification', async (msg) => {
        if (this.isShuttingDown) return;

        try {
          const payload = JSON.parse(msg.payload);
          await this.processRequest(payload);
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

      console.log(`🚀 S3 Signer Service running (bucket: ${S3_BUCKET})`);
    } catch (error) {
      console.error('💥 Failed to start service:', error);
      process.exit(1);
    }
  }

  /**
   * Process upload URL request
   * Generates presigned URL and updates file_upload_requests table
   */
  async processRequest({ requestId, fileName, fileType, entityType, entityId }) {
    console.log(`🔄 Processing request ${requestId} for ${fileName}`);

    try {
      // Generate file ID using database's uuid_generate_v7() function
      const result = await this.client.query('SELECT uuid_generate_v7() as id');
      const fileId = result.rows[0].id;

      // Generate S3 key
      const s3Key = generateS3Key(fileId, fileName, entityType, entityId, 'original');

      // Generate presigned URL (valid for 1 hour)
      // Use s3Signer which is configured with the public endpoint
      const presignedUrl = await s3Signer.getSignedUrlPromise('putObject', {
        Bucket: S3_BUCKET,
        Key: s3Key,
        ContentType: fileType,
        Expires: 3600  // 1 hour
      });

      // Update PostgreSQL with the URL and file ID
      await this.client.query(
        `UPDATE metadata.file_upload_requests
         SET status = $1, presigned_url = $2, s3_key = $3, file_id = $4
         WHERE id = $5`,
        ['completed', presignedUrl, s3Key, fileId, requestId]
      );

      console.log(`✅ Generated URL for request ${requestId} (file: ${fileId})`);

    } catch (error) {
      console.error(`❌ Error processing request ${requestId}:`, error);

      // Update with error
      await this.client.query(
        `UPDATE metadata.file_upload_requests
         SET status = $1, error_message = $2
         WHERE id = $3`,
        ['failed', error.message, requestId]
      ).catch(err => {
        console.error('Failed to update error status:', err);
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;

    console.log('\n🛑 Shutting down S3 Signer Service...');
    this.isShuttingDown = true;

    try {
      await this.client.query('UNLISTEN upload_url_request');
      await this.client.end();
      console.log('✅ PostgreSQL connection closed');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }

    process.exit(0);
  }
}

// Start service
const service = new S3SignerService();
service.start().catch(err => {
  console.error('Failed to start S3 Signer Service:', err);
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => service.shutdown());
process.on('SIGINT', () => service.shutdown());
