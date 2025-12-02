/**
 * Unit tests for the word export and report API routes.
 *
 * @module __tests__/api/words/export.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as ExportGET } from '@/app/api/words/export/route';
import { GET as ReportGET } from '@/app/api/words/report/route';
import { POST as SendEmailPOST } from '@/app/api/words/export/send-email/route';
import { expectResponse } from '@/__tests__/utils/test-helpers';
import { NextRequest, NextResponse } from 'next/server';
import * as reportUtils from '@/lib/report-words-utils';
import * as apiAuth from '@/lib/api-auth';
import * as pdfUtils from '@/lib/pdf-utils';
import * as email from '@/lib/email';

// Mock dependencies
vi.mock('@/lib/report-words-utils', () => ({
  authenticateAndFetchRedactedWords: vi.fn(),
  authenticateAndFetchWordsByStatus: vi.fn(),
  mapWordsByStatusToPdf: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock('@/lib/pdf-utils', () => ({
  generatePDFreport: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendWordsReport: vi.fn(),
}));

describe('Words Export and Report API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/words/export', () => {
    it('should return 403 if user is not admin or superadmin', async () => {
      vi.mocked(apiAuth.requireAdminForApi).mockRejectedValue(
        NextResponse.json(
          { error: 'Forbidden: Superadmin or admin role required' },
          { status: 403 }
        )
      );

      const response = await ExportGET();
      expect(response.status).toBe(500);
    });

    it('should return 401 if authentication fails', async () => {
      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'admin',
      });
      vi.mocked(reportUtils.authenticateAndFetchRedactedWords).mockResolvedValue({
        success: false,
        response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      });

      const response = await ExportGET();
      const data = await expectResponse<{ error: string }>(response, 401);

      expect(data.error).toBe('Authentication required');
    });

    it('should return exported words successfully for admin', async () => {
      const mockWords = [
        {
          id: 1,
          lemma: 'chilenismo',
          root: 'chile',
          letter: 'c',
          status: 'redacted',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
        {
          id: 2,
          lemma: 'cachai',
          root: 'cachar',
          letter: 'c',
          status: 'redacted',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
      ];

      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'admin',
      });
      vi.mocked(reportUtils.authenticateAndFetchRedactedWords).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: mockWords as never,
      });

      const response = await ExportGET();
      const data = await expectResponse<{
        success: boolean;
        words: typeof mockWords;
        count: number;
      }>(response, 200);

      expect(data.success).toBe(true);
      expect(data.words).toHaveLength(2);
      expect(data.count).toBe(2);
      expect(data.words[0].status).toBe('redacted');
    });

    it('should return empty array when no words exist', async () => {
      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'admin',
      });
      vi.mocked(reportUtils.authenticateAndFetchRedactedWords).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: [],
      });

      const response = await ExportGET();
      const data = await expectResponse<{
        success: boolean;
        words: unknown[];
        count: number;
      }>(response, 200);

      expect(data.success).toBe(true);
      expect(data.words).toHaveLength(0);
      expect(data.count).toBe(0);
    });
  });

  describe('GET /api/words/report', () => {
    it('should return 403 if user is not admin or superadmin', async () => {
      vi.mocked(apiAuth.requireAdminForApi).mockRejectedValue(
        NextResponse.json(
          { error: 'Forbidden: Superadmin or admin role required' },
          { status: 403 }
        ) as never
      );

      const request = new NextRequest('http://localhost:3000/api/words/report?type=redacted');
      const response = await ReportGET(request);
      expect(response.status).toBe(500);
    });

    it('should generate PDF report for redacted words', async () => {
      const mockWords = [
        {
          id: 1,
          lemma: 'chilenismo',
          root: 'chile',
          letter: 'c',
          status: 'redacted',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
      ];

      const mockPdfBytes = new Uint8Array([37, 80, 68, 70]); // PDF header

      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'admin',
      });
      vi.mocked(reportUtils.authenticateAndFetchWordsByStatus).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: mockWords as never,
      });
      vi.mocked(reportUtils.mapWordsByStatusToPdf).mockReturnValue([]);
      vi.mocked(pdfUtils.generatePDFreport).mockResolvedValue(mockPdfBytes);

      const request = new NextRequest('http://localhost:3000/api/words/report?type=redacted');
      const response = await ReportGET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('reporte_redactadas.pdf');
    });

    it('should generate PDF report for reviewedLex words', async () => {
      const mockWords = [
        {
          id: 1,
          lemma: 'fome',
          root: 'fome',
          letter: 'f',
          status: 'reviewedLex',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
      ];

      const mockPdfBytes = new Uint8Array([37, 80, 68, 70]);

      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'superadmin',
      });
      vi.mocked(reportUtils.authenticateAndFetchWordsByStatus).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: mockWords as never,
      });
      vi.mocked(reportUtils.mapWordsByStatusToPdf).mockReturnValue([]);
      vi.mocked(pdfUtils.generatePDFreport).mockResolvedValue(mockPdfBytes);

      const request = new NextRequest('http://localhost:3000/api/words/report?type=reviewedLex');
      const response = await ReportGET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain('reporte_revisadas.pdf');
    });

    it('should generate PDF report for both statuses', async () => {
      const mockWords = [
        {
          id: 1,
          lemma: 'chilenismo',
          root: 'chile',
          letter: 'c',
          status: 'redacted',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
        {
          id: 2,
          lemma: 'fome',
          root: 'fome',
          letter: 'f',
          status: 'reviewedLex',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
      ];

      const mockPdfBytes = new Uint8Array([37, 80, 68, 70]);

      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'superadmin',
      });
      vi.mocked(reportUtils.authenticateAndFetchWordsByStatus).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: mockWords as never,
      });
      vi.mocked(reportUtils.mapWordsByStatusToPdf).mockReturnValue([]);
      vi.mocked(pdfUtils.generatePDFreport).mockResolvedValue(mockPdfBytes);

      const request = new NextRequest('http://localhost:3000/api/words/report?type=both');
      const response = await ReportGET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain('reporte_completo.pdf');
    });

    it('should return 500 on PDF generation error', async () => {
      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'admin',
      });
      vi.mocked(reportUtils.authenticateAndFetchWordsByStatus).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: [],
      });
      vi.mocked(reportUtils.mapWordsByStatusToPdf).mockReturnValue([]);
      vi.mocked(pdfUtils.generatePDFreport).mockRejectedValue(new Error('PDF generation failed'));

      const request = new NextRequest('http://localhost:3000/api/words/report?type=redacted');
      const response = await ReportGET(request);
      const data = await expectResponse<{ error: string }>(response, 500);

      expect(data.error).toBe('Failed to generate report');
    });
  });

  describe('POST /api/words/export/send-email', () => {
    it('should return 403 if user is not admin or superadmin', async () => {
      vi.mocked(apiAuth.requireAdminForApi).mockRejectedValue(
        NextResponse.json(
          { error: 'Forbidden: Superadmin or admin role required' },
          { status: 403 }
        ) as never
      );

      const request = new NextRequest(
        'http://localhost:3000/api/words/export/send-email?type=redacted',
        {
          method: 'POST',
        }
      );
      const response = await SendEmailPOST(request);
      expect(response.status).toBe(500);
    });

    it('should send email with PDF successfully', async () => {
      const mockWords = [
        {
          id: 1,
          lemma: 'chilenismo',
          root: 'chile',
          letter: 'c',
          status: 'redacted',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
      ];

      const mockPdfBytes = new Uint8Array([37, 80, 68, 70]);

      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'admin',
      });
      vi.mocked(reportUtils.authenticateAndFetchWordsByStatus).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: mockWords as never,
      });
      vi.mocked(reportUtils.mapWordsByStatusToPdf).mockReturnValue([]);
      vi.mocked(pdfUtils.generatePDFreport).mockResolvedValue(mockPdfBytes);
      vi.mocked(email.sendWordsReport).mockResolvedValue({
        success: true,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/words/export/send-email?type=redacted',
        {
          method: 'POST',
        }
      );
      const response = await SendEmailPOST(request);
      const data = await expectResponse<{ success: boolean; email: string }>(response, 200);

      expect(data.success).toBe(true);
      expect(data.email).toBe('admin@duech.cl');
      expect(email.sendWordsReport).toHaveBeenCalledWith(
        'admin@duech.cl',
        'Admin',
        expect.any(Buffer)
      );
    });

    it('should return 500 if email sending fails', async () => {
      const mockWords = [
        {
          id: 1,
          lemma: 'chilenismo',
          root: 'chile',
          letter: 'c',
          status: 'redacted',
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: [],
          meanings: [],
        },
      ];

      const mockPdfBytes = new Uint8Array([37, 80, 68, 70]);

      vi.mocked(apiAuth.requireAdminForApi).mockResolvedValue({
        id: '1',
        email: 'admin@duech.cl',
        name: 'Admin',
        role: 'admin',
      });
      vi.mocked(reportUtils.authenticateAndFetchWordsByStatus).mockResolvedValue({
        success: true,
        user: { email: 'admin@duech.cl', name: 'Admin' },
        words: mockWords as never,
      });
      vi.mocked(reportUtils.mapWordsByStatusToPdf).mockReturnValue([]);
      vi.mocked(pdfUtils.generatePDFreport).mockResolvedValue(mockPdfBytes);
      vi.mocked(email.sendWordsReport).mockResolvedValue({
        success: false,
        error: 'SMTP error',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/words/export/send-email?type=redacted',
        {
          method: 'POST',
        }
      );
      const response = await SendEmailPOST(request);
      const data = await expectResponse<{ success: boolean; error: string }>(response, 500);

      expect(data.success).toBe(false);
      expect(data.error).toBe('SMTP error');
    });
  });
});
