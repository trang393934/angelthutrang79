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

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = `${Date.now()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: Deno.env.get('R2_BUCKET_NAME'),
        Key: fileName,
        Body: new Uint8Array(fileBuffer),
        ContentType: file.type,
      })
    );

    const publicUrl = `${Deno.env.get('R2_PUBLIC_URL')}/${fileName}`;

    return Response.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});