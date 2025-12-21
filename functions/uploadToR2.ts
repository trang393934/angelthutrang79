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

    // Download file from Base44
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error('Failed to download file');
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileName = `${Date.now()}-${file_name}`;

    // Upload to R2
    await s3Client.send(
      new PutObjectCommand({
        Bucket: Deno.env.get('R2_BUCKET_NAME'),
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: file_type,
      })
    );

    const publicUrl = `${Deno.env.get('R2_PUBLIC_URL')}/${fileName}`;

    return Response.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      size: fileBuffer.byteLength,
      type: file_type,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});