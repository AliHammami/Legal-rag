declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type { ExtractedPage } from './types.js';

function pageItemsToText(items: TextItem[]): string {
  let text = '';
  for (const item of items) {
    text += item.str;
    if (item.hasEOL) {
      text += '\n';
    }
  }
  return text;
}

export async function extractPdfPages(pdfPath: string): Promise<ExtractedPage[]> {
  const data = new Uint8Array(await readFile(pdfPath));
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(
      (item): item is TextItem => 'str' in item,
    );
    const text = pageItemsToText(items);

    pages.push({ pageNumber, text });
  }

  return pages;
}
