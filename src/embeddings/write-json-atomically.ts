import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeJsonAtomically(
  outputPath: string,
  data: unknown,
): Promise<void> {
  const tempPath = `${outputPath}.tmp.${process.pid}`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await rename(tempPath, outputPath);
}
