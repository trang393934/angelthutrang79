import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.635.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: Deno.env.get('R2_ENDPOINT'),
  credentials: {
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID'),
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY'),
  },
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, file_name, file_type } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'No file URL provided' }, { status: 400 });
    }

    // Log R2 config
    console.log('R2 Config:', {
      endpoint: Deno.env.get('R2_ENDPOINT'),
      bucket: Deno.env.get('R2_BUCKET_NAME'),
      publicUrl: Deno.env.get('R2_PUBLIC_URL'),
      hasAccessKey: !!Deno.env.get('R2_ACCESS_KEY_ID'),
      hasSecretKey: !!Deno.env.get('R2_SECRET_ACCESS_KEY'),
    });

    // Download file from Base44
    console.log('Downloading file from:', file_url);
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileName = `${Date.now()}-${file_name}`;
    console.log('File downloaded, size:', fileBuffer.byteLength, 'bytes');

    // Upload to R2
    console.log('Uploading to R2 as:', fileName);
    const command = new PutObjectCommand({
      Bucket: Deno.env.get('R2_BUCKET_NAME'),
      Key: fileName,
      Body: new Uint8Array(fileBuffer),
      ContentType: file_type,
    });

    const uploadResult = await s3Client.send(command);
    console.log('Upload result:', uploadResult);

    const publicUrl = `${Deno.env.get('R2_PUBLIC_URL')}/${fileName}`;

    return Response.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      size: fileBuffer.byteLength,
      type: file_type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString(),
      stack: error.stack
    }, { status: 500 });
  }
});