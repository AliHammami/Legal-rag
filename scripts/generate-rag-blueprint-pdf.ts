import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');
const MD_PATH = join(DOCS, 'rag-blueprint.md');
const CSS_PATH = join(DOCS, 'rag-blueprint.css');
const PDF_PATH = join(DOCS, 'rag-blueprint.pdf');

async function main(): Promise<void> {
  const [{ marked }, puppeteerModule] = await Promise.all([
    import('marked'),
    import('puppeteer'),
  ]);

  marked.setOptions({ gfm: true, breaks: false });

  let markdown = await readFile(MD_PATH, 'utf-8');
  markdown = markdown.replace(/<link rel="stylesheet" href="rag-blueprint.css">\n?/, '');

  const mermaidBlocks: string[] = [];
  const withPlaceholders = markdown.replace(
    /```mermaid\n([\s\S]*?)```/g,
    (_match, diagram: string) => {
      mermaidBlocks.push(diagram.trim());
      return `\n\n<!--MERMAID_${mermaidBlocks.length - 1}-->\n\n`;
    },
  );

  let bodyHtml = marked.parse(withPlaceholders) as string;
  bodyHtml = bodyHtml.replace(
    /<!--MERMAID_(\d+)-->/g,
    (_match, index: string) =>
      `<div class="mermaid">${mermaidBlocks[Number(index)] ?? ''}</div>`,
  );

  const cssContent = await readFile(CSS_PATH, 'utf-8');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>RAG Blueprint</title>
  <style>${cssContent}</style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
</head>
<body>
${bodyHtml}
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
  document.addEventListener('DOMContentLoaded', async () => {
    await mermaid.run({ querySelector: '.mermaid' });
  });
</script>
</body>
</html>`;

  const htmlPath = join(DOCS, 'rag-blueprint.html');
  await writeFile(htmlPath, html, 'utf-8');

  const puppeteer = puppeteerModule.default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: 'networkidle0',
      timeout: 120_000,
    });

    await page.waitForFunction(
      () => typeof (window as unknown as { mermaid?: unknown }).mermaid !== 'undefined',
      { timeout: 60_000 },
    );

    await page.evaluate(async () => {
      const mermaid = (window as unknown as {
        mermaid?: { run: (opts?: { querySelector: string }) => Promise<void> };
      }).mermaid;
      if (mermaid) {
        await mermaid.run({ querySelector: '.mermaid' });
      }
    });

    await page.waitForFunction(
      () => document.querySelectorAll('.mermaid svg').length >= 5,
      { timeout: 60_000 },
    );

    await page.pdf({
      path: PDF_PATH,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '14mm', right: '16mm', bottom: '18mm', left: '16mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;text-align:center;font-size:9px;color:#666;padding-top:4mm;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });

    console.log(`PDF generated: ${PDF_PATH}`);
    console.log(`HTML intermediate: ${htmlPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error('PDF generation failed:', error);
  process.exitCode = 1;
});
