import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/authz';
import {
  getFileComments,
  addFileComment,
  deleteFileComment,
  isAgencyConfigured,
  type LuckyCloudAgency
} from '@/lib/luckycloud';

// GET - Kommentare für eine Datei abrufen
export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const agency = request.nextUrl.searchParams.get('agency') as LuckyCloudAgency;
  const libraryId = request.nextUrl.searchParams.get('libraryId');
  const filePath = request.nextUrl.searchParams.get('path');

  if (!agency || !['eventomaxx', 'vendoweb'].includes(agency)) {
    return NextResponse.json({ error: 'Ungültige Agentur' }, { status: 400 });
  }

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 });
  }

  if (!filePath) {
    return NextResponse.json({ error: 'path ist erforderlich' }, { status: 400 });
  }

  if (!isAgencyConfigured(agency)) {
    return NextResponse.json({
      success: false,
      error: `LuckyCloud ist für "${agency}" nicht konfiguriert`,
    });
  }

  try {
    const comments = await getFileComments(agency, libraryId, filePath);

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('LuckyCloud get comments error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}

// POST - Kommentar hinzufügen
export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const agency = request.nextUrl.searchParams.get('agency') as LuckyCloudAgency;
  const libraryId = request.nextUrl.searchParams.get('libraryId');
  const filePath = request.nextUrl.searchParams.get('path');

  if (!agency || !['eventomaxx', 'vendoweb'].includes(agency)) {
    return NextResponse.json({ error: 'Ungültige Agentur' }, { status: 400 });
  }

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 });
  }

  if (!filePath) {
    return NextResponse.json({ error: 'path ist erforderlich' }, { status: 400 });
  }

  if (!isAgencyConfigured(agency)) {
    return NextResponse.json({
      success: false,
      error: `LuckyCloud ist für "${agency}" nicht konfiguriert`,
    });
  }

  try {
    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== 'string' || comment.trim() === '') {
      return NextResponse.json({ error: 'Kommentar ist erforderlich' }, { status: 400 });
    }

    const newComment = await addFileComment(agency, libraryId, filePath, comment.trim());

    return NextResponse.json({
      success: true,
      comment: newComment,
    });
  } catch (error) {
    console.error('LuckyCloud add comment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}

// DELETE - Kommentar löschen
export async function DELETE(request: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const agency = request.nextUrl.searchParams.get('agency') as LuckyCloudAgency;
  const libraryId = request.nextUrl.searchParams.get('libraryId');
  const commentId = request.nextUrl.searchParams.get('commentId');

  if (!agency || !['eventomaxx', 'vendoweb'].includes(agency)) {
    return NextResponse.json({ error: 'Ungültige Agentur' }, { status: 400 });
  }

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId ist erforderlich' }, { status: 400 });
  }

  if (!commentId) {
    return NextResponse.json({ error: 'commentId ist erforderlich' }, { status: 400 });
  }

  if (!isAgencyConfigured(agency)) {
    return NextResponse.json({
      success: false,
      error: `LuckyCloud ist für "${agency}" nicht konfiguriert`,
    });
  }

  try {
    await deleteFileComment(agency, libraryId, parseInt(commentId));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('LuckyCloud delete comment error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    });
  }
}
