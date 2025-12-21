import { S3Client, ListBucketsCommand, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.635.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const endpoint = Deno.env.get('R2_ENDPOINT');
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME');
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');

    // Check all secrets exist
    const secretsCheck = {
      R2_ENDPOINT: endpoint ? '✅ Set' : '❌ Missing',
      R2_ACCESS_KEY_ID: accessKeyId ? '✅ Set' : '❌ Missing',
      R2_SECRET_ACCESS_KEY: secretAccessKey ? '✅ Set' : '❌ Missing',
      R2_BUCKET_NAME: bucketName ? '✅ Set' : '❌ Missing',
      R2_PUBLIC_URL: publicUrl ? '✅ Set' : '❌ Missing',
    };

    // Show partial values for debugging (first/last 4 chars)
    const secretsPreview = {
      endpoint: endpoint ? `${endpoint.substring(0, 30)}...` : 'NOT SET',
      accessKeyId: accessKeyId ? `${accessKeyId.substring(0, 4)}...${accessKeyId.substring(accessKeyId.length - 4)}` : 'NOT SET',
      bucketName: bucketName || 'NOT SET',
      publicUrl: publicUrl || 'NOT SET',
    };

    // Test S3 client connection
    let connectionTest = {
      status: 'testing',
      error: null
    };

    try {
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });

      // Try to list buckets
      await s3Client.send(new ListBucketsCommand({}));
      connectionTest.status = '✅ Connected successfully';
    } catch (error) {
      connectionTest.status = '❌ Connection failed';
      connectionTest.error = error.message;
      connectionTest.code = error.Code || error.name;
    }

    // Test upload small file
    let uploadTest = {
      status: 'testing',
      error: null
    };

    if (connectionTest.status.includes('✅')) {
      try {
        const s3Client = new S3Client({
          region: 'auto',
          endpoint: endpoint,
          credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
          },
        });

        const testContent = 'Test upload from Angel AI';
        const testFileName = `debug-test-${Date.now()}.txt`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: testFileName,
            Body: new TextEncoder().encode(testContent),
            ContentType: 'text/plain',
          })
        );

        uploadTest.status = '✅ Upload test successful';
        uploadTest.testFile = `${publicUrl}/${testFileName}`;
      } catch (error) {
        uploadTest.status = '❌ Upload failed';
        uploadTest.error = error.message;
        uploadTest.code = error.Code || error.name;
      }
    } else {
      uploadTest.status = '⏭️ Skipped (connection failed)';
    }

    return Response.json({
      debug: true,
      timestamp: new Date().toISOString(),
      secretsCheck,
      secretsPreview,
      connectionTest,
      uploadTest,
      recommendations: [
        'R2_ENDPOINT phải có format: https://ACCOUNT_ID.r2.cloudflarestorage.com',
        'R2_PUBLIC_URL phải có format: https://pub-xxx.r2.dev',
        'API Token phải có Admin Read & Write permissions',
        'Bucket phải enable Public Access với R2.dev subdomain'
      ]
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});