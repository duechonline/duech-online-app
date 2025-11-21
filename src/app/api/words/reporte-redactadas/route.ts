import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function GET() {
  try {
    // Get words with "redacted" status
    const redactadas = await db.query.words.findMany({
      where: (table, { eq }) => eq(table.status, "redacted"),
      with: {
        notes: true,
      },
      orderBy: (table, { asc }) => [asc(table.lemma)],
    });

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    // Fonts
    const fontTitle = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontText = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // Margins and layout
    const marginLeft = 60;
    const marginRight = 60;
    const marginTop = 50;
    const marginBottom = 60;
    const lineHeight = 16;
    const contentWidth = width - marginLeft - marginRight;

    let y = height - marginTop;

    // Current date string
    const now = new Date();
    const meses = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const dateStr = `${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;

    const drawHeader = (pageNumber: number) => {
      // Title 
      const title = "REPORTE DE PALABRAS REDACTADAS";
      const titleSize = 16;
      const titleWidth = fontTitle.widthOfTextAtSize(title, titleSize);
      const titleX = marginLeft + (contentWidth - titleWidth) / 2;

      page.drawText(title, {
        x: titleX,
        y,
        size: titleSize,
        font: fontTitle,
        color: rgb(0, 0, 0),
      });

      y -= 22;

      // Subtitle with date
      const subtitle = `Al ${dateStr}`;
      const subtitleSize = 11;
      const subtitleWidth = fontText.widthOfTextAtSize(subtitle, subtitleSize);
      const subtitleX = marginLeft + (contentWidth - subtitleWidth) / 2;

      page.drawText(subtitle, {
        x: subtitleX,
        y,
        size: subtitleSize,
        font: fontText,
        color: rgb(0.3, 0.3, 0.3),
      });

      y -= 20;
    };

    const drawFooter = (pageNumber: number) => {
      const footerY = marginBottom - 20;

      // Page number centered in the footer
      const pageLabel = `— ${pageNumber} —`;
      const pageLabelWidth = fontText.widthOfTextAtSize(pageLabel, 9);
      const pageLabelX = marginLeft + (contentWidth - pageLabelWidth) / 2;
      
      page.drawText(pageLabel, {
        x: pageLabelX,
        y: footerY,
        size: 9,
        font: fontText,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Top line above the footer
      page.drawLine({
        start: { x: marginLeft, y },
        end: { x: width - marginRight, y },
        thickness: 0.3,
        color: rgb(0.85, 0.85, 0.85),
      });
      y -= 18;
    };

    let pageNumber = 1;
    drawHeader(pageNumber);
    drawFooter(pageNumber);

    // Helper to ensure enough space on the page, else add new page
    const ensureSpace = (neededLines: number) => {
      if (y - neededLines * lineHeight < marginBottom + 30) {
        page = pdfDoc.addPage();
        y = height - marginTop;
        pageNumber += 1;
        drawHeader(pageNumber);
        drawFooter(pageNumber);
      }
    };

    // Case with no redacted words
    if (redactadas.length === 0) {
      ensureSpace(3);
      y -= 20;
      page.drawText("No se encontraron palabras en estado redactada.", {
        x: marginLeft,
        y,
        size: 12,
        font: fontItalic,
        color: rgb(0.3, 0.3, 0.3),
      });

      const pdfBytes = await pdfDoc.save();
      return new Response(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="reporte_redactadas.pdf"',
        },
      });
    }

    // Subtitle with count
    y -= 2;
    page.drawText(`Total de palabras: ${redactadas.length}`, {
      x: marginLeft,
      y,
      size: 10,
      font: fontText,
      color: rgb(0.3, 0.3, 0.3),
    });

    y -= 30;

    // Numbered list of words + comments
    let index = 1;

    for (const word of redactadas) {
      ensureSpace(5);

      // Number + lemma
      const heading = `${index}. ${word.lemma.toUpperCase()}`;
      page.drawText(heading, {
        x: marginLeft,
        y,
        size: 13,
        font: fontTitle,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight + 4;

      // Editorial notes
      if (word.notes && word.notes.length > 0) {
        ensureSpace(2);
        page.drawText("Comentarios editoriales:", {
          x: marginLeft + 15,
          y,
          size: 10,
          font: fontTitle,
          color: rgb(0.2, 0.2, 0.2),
        });

        y -= lineHeight;

        // List each note
        for (const note of word.notes) {
          const noteText = note.note ?? "";
          const maxCharsPerLine = 85;
          const lines: string[] = [];

          // Split note into lines if too long
          if (noteText.length <= maxCharsPerLine) {
            lines.push(noteText);
          } else {
            let current = noteText;
            while (current.length > maxCharsPerLine) {
              const cutAt = current.lastIndexOf(" ", maxCharsPerLine);
              const idx = cutAt > 0 ? cutAt : maxCharsPerLine;
              lines.push(current.slice(0, idx));
              current = current.slice(idx).trimStart();
            }
            if (current.length > 0) lines.push(current);
          }
          
          // Draw each line with bullet points
          for (let i = 0; i < lines.length; i++) {
            ensureSpace(1);
            const prefix = i === 0 ? "• " : "  ";
            page.drawText(prefix + lines[i], {
              x: marginLeft + 25,
              y,
              size: 10,
              font: fontText,
              color: rgb(0.15, 0.15, 0.15),
            });
            y -= lineHeight - 2;
          }

          y -= 6;
        }
      } else {
        ensureSpace(2);
        page.drawText("Comentarios editoriales:", {
          x: marginLeft + 15,
          y,
          size: 10,
          font: fontTitle,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= lineHeight;
        
        page.drawText("Sin comentarios.", {
          x: marginLeft + 25,
          y,
          size: 10,
          font: fontItalic,
          color: rgb(0.5, 0.5, 0.5),
        });
        y -= lineHeight;
      }

      y -= 10; // Space before next word
      index += 1;
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="reporte_redactadas.pdf"',
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}