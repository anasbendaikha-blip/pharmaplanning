/**
 * API Route — File Upload
 * POST /api/upload  (multipart/form-data)
 *
 * Upload un fichier dans le bucket Supabase Storage "request-attachments"
 * Retourne { url, fileName }
 *
 * Utilise le service_role pour bypasser le RLS Storage
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validation type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Type de fichier non autorise. Formats acceptes : PDF, JPG, PNG, WEBP, DOC, DOCX' },
        { status: 400 }
      );
    }

    // Validation taille
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux. Taille maximale : 5 Mo' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Generer un nom unique
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${timestamp}_${safeName}`;

    // Upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('request-attachments')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Erreur upload:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Generer une signed URL (valide 7 jours)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('request-attachments')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 jours

    if (signedError) {
      console.error('Erreur signed URL:', signedError);
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      filePath,
      fileName: file.name,
    });
  } catch (err) {
    console.error('Erreur upload:', err);
    return NextResponse.json({ error: 'Erreur serveur lors de l\'upload' }, { status: 500 });
  }
}
