import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'Connection id is required' } },
        { status: 400 }
      );
    }

    await db.roomConnection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting room connection:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete connection' } },
      { status: 500 }
    );
  }
}
