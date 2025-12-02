import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getNoteWithDetails, updateNoteValue, deleteNoteById } from '@/lib/editor-mutations';

function parseCommentId(rawId: string) {
  const parsed = Number.parseInt(rawId, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeLemma(rawLemma: string) {
  try {
    return decodeURIComponent(rawLemma);
  } catch {
    return rawLemma;
  }
}

async function getAuthorizedNote(lemma: string, commentId: number) {
  const note = await getNoteWithDetails(commentId);
  if (!note || note.word?.lemma !== lemma) {
    return null;
  }
  return note;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lemma: string; commentId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 });
    }

    const { lemma, commentId } = await params;
    const normalizedLemma = normalizeLemma(lemma);
    const noteId = parseCommentId(commentId);
    if (!noteId) {
      return NextResponse.json({ error: 'Identificador de comentario inválido.' }, { status: 400 });
    }

    const payload = (await request.json()) as { note?: unknown };
    const noteValue = typeof payload.note === 'string' ? payload.note.trim() : '';
    if (!noteValue) {
      return NextResponse.json({ error: 'El comentario no puede estar vacío.' }, { status: 400 });
    }

    const note = await getAuthorizedNote(normalizedLemma, noteId);
    if (!note) {
      return NextResponse.json({ error: 'Comentario no encontrado.' }, { status: 404 });
    }

    const requesterId = user.id ? Number.parseInt(user.id, 10) : null;
    const role = user.role ?? '';
    const isOwner = requesterId !== null && note.userId === requesterId;
    const canEdit =
      isOwner && (role === 'lexicographer' || role === 'admin' || role === 'superadmin');

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Solo puedes editar tus propios comentarios.' },
        { status: 403 }
      );
    }

    const updated = await updateNoteValue(noteId, noteValue);

    return NextResponse.json({
      success: true,
      data: {
        comment: {
          id: updated.id,
          note: updated.note,
          createdAt: updated.createdAt.toISOString(),
          user: note.user ? { id: note.user.id, username: note.user.username } : null,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error al actualizar el comentario.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lemma: string; commentId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Autenticación requerida.' }, { status: 401 });
    }

    const { lemma, commentId } = await params;
    const normalizedLemma = normalizeLemma(lemma);
    const noteId = parseCommentId(commentId);
    if (!noteId) {
      return NextResponse.json({ error: 'Identificador de comentario inválido.' }, { status: 400 });
    }

    const note = await getAuthorizedNote(normalizedLemma, noteId);
    if (!note) {
      return NextResponse.json({ error: 'Comentario no encontrado.' }, { status: 404 });
    }

    const requesterId = user.id ? Number.parseInt(user.id, 10) : null;
    const isLexicographer = user.role === 'lexicographer';
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const isOwner = requesterId !== null && note.userId === requesterId;

    const canDelete = (isLexicographer && isOwner) || isAdmin;
    if (!canDelete) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar este comentario.' },
        { status: 403 }
      );
    }

    await deleteNoteById(noteId);

    return NextResponse.json({ success: true, data: { id: noteId } });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error al eliminar el comentario.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
