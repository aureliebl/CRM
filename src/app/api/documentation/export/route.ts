import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { NextResponse } from "next/server";
import { getActorFromRequest } from "@/lib/server-permissions";
import {
  getDocumentationNodeAccessForActor,
  resolveDocumentationActorScope,
} from "@/lib/documentation-store";
import type { DocumentationBlock } from "@/lib/documentation-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportFormat = "pdf" | "doc";

function sanitizeFileName(input: string) {
  const value = input.trim().replace(/[\\/:*?"<>|]/g, "_");
  return value.length > 0 ? value : "document";
}

function normalizeBlocks(blocks: DocumentationBlock[]) {
  return blocks.slice(0, 500).map((block) => ({ ...block }));
}

function blockToText(block: DocumentationBlock): string[] {
  if (block.type === "image") {
    return ["[Image]"];
  }

  if (block.type === "link") {
    const label = (block.targetLabel || "Lien").trim();
    const target = (block.targetNodeId || "").trim();
    return [target ? `${label} (${target})` : label];
  }

  const text = (block.text || "").trim();
  if (!text) return [""];

  return text.split("\n");
}

async function renderPdfBuffer(title: string, blocks: DocumentationBlock[]) {
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const wrapLine = (text: string, size: number, font: { widthOfTextAtSize: (text: string, size: number) => number }) => {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const drawLines = (lines: string[], fontSize: number, lineGap: number, font: typeof fontRegular) => {
    const lineHeight = fontSize + lineGap;
    for (const line of lines) {
      if (cursorY - lineHeight < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }
      page.drawText(line || " ", {
        x: margin,
        y: cursorY - fontSize,
        size: fontSize,
        font,
      });
      cursorY -= lineHeight;
    }
  };

  drawLines(wrapLine(title, 22, fontBold), 22, 8, fontBold);
  cursorY -= 12;

  for (const block of blocks) {
    const lines = blockToText(block);

    let fontSize = 11;
    let lineGap = 4;
    let font = fontRegular;

    if (block.type === "heading1") {
      fontSize = 19;
      lineGap = 6;
      font = fontBold;
    } else if (block.type === "heading2") {
      fontSize = 16;
      lineGap = 6;
      font = fontBold;
    } else if (block.type === "heading3") {
      fontSize = 14;
      lineGap = 5;
      font = fontBold;
    } else if (block.type === "subtitle") {
      fontSize = 12;
      lineGap = 4;
      font = fontItalic;
    } else if (block.type === "code") {
      fontSize = 10;
      lineGap = 3;
      font = fontMono;
    }

    for (const line of lines) {
      drawLines(wrapLine(line, fontSize, font), fontSize, lineGap, font);
    }

    cursorY -= block.type.startsWith("heading") ? 8 : 5;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function renderDocBuffer(title: string, blocks: DocumentationBlock[]) {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          font: "Helvetica",
          bold: true,
          size: 44,
        }),
      ],
      spacing: { after: 240 },
    })
  );

  for (const block of blocks) {
    const lines = blockToText(block);

    let font = "Helvetica";
    let size = 22;
    let bold = false;
    let italics = false;
    let spacingAfter = 100;

    if (block.type === "heading1") {
      size = 38;
      bold = true;
      spacingAfter = 160;
    } else if (block.type === "heading2") {
      size = 32;
      bold = true;
      spacingAfter = 160;
    } else if (block.type === "heading3") {
      size = 28;
      bold = true;
      spacingAfter = 160;
    } else if (block.type === "subtitle") {
      size = 24;
      italics = true;
      spacingAfter = 100;
    } else if (block.type === "code") {
      font = "Courier";
      size = 20;
      spacingAfter = 100;
    } else if (block.type === "info") {
      size = 22;
      bold = true;
      italics = true;
      spacingAfter = 100;
    }

    for (const line of lines) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              font,
              size,
              bold,
              italics,
            }),
          ],
          spacing: { after: spacingAfter },
        })
      );
    }
  }

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}

export async function POST(req: Request) {
  const actor = await getActorFromRequest(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { nodeId?: string; format?: ExportFormat; content?: DocumentationBlock[] }
    | null;

  const nodeId = String(body?.nodeId ?? "").trim();
  const format = body?.format;
  if (!nodeId || (format !== "pdf" && format !== "doc")) {
    return NextResponse.json({ error: "nodeId and valid format are required" }, { status: 400 });
  }

  const scope = await resolveDocumentationActorScope({
    id: actor.id,
    role: actor.role === "admin" ? "admin" : "operator",
  });

  const access = await getDocumentationNodeAccessForActor(scope, nodeId);
  if (!access?.canRead || access.node.kind !== "page") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const blocks = Array.isArray(body?.content) ? normalizeBlocks(body.content) : access.node.content;
  const title = access.node.title || "Documentation";
  const safeTitle = sanitizeFileName(title);

  try {
    if (format === "pdf") {
      const file = await renderPdfBuffer(title, blocks);
      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
        },
      });
    }

    const file = await renderDocBuffer(title, blocks);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeTitle}.docx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
