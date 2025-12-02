import { NextRequest, NextResponse } from 'next/server';
import { sendWordsReport } from '@/lib/email';
import {
  authenticateAndFetchWordsByStatus,
  mapWordsByStatusToPdf,
  WordStatusFilter,
} from '@/lib/report-words-utils';
import { generatePDFreport } from '@/lib/pdf-utils';
import { requireAdminForApi } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization first
    await requireAdminForApi();

    const searchParams = request.nextUrl.searchParams;
    const type = (searchParams.get('type') || 'redacted') as WordStatusFilter;

    const result = await authenticateAndFetchWordsByStatus(type);
    if (!result.success) return result.response;

    const pdfReadyWords = mapWordsByStatusToPdf(result.words);
    const pdfBytes = await generatePDFreport(pdfReadyWords, type);
    const pdfBuffer = Buffer.from(pdfBytes);

    const emailResult = await sendWordsReport(
      result.user.email,
      result.user.name || result.user.email,
      pdfBuffer
    );

    if (!emailResult.success) {
      console.error('Failed to send report email:', emailResult.error);
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error || 'Failed to send email',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email: result.user.email,
    });
  } catch (error) {
    console.error('Error generating and sending report:', error);
    return NextResponse.json({ error: 'Failed to generate and send report' }, { status: 500 });
  }
}
