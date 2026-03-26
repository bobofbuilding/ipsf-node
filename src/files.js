import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} rootDir
 * @returns {Promise<Array<{ absolutePath: string, relativePath: string }>>}
 */
export async function collectDirectoryFiles(rootDir) {
  const entries = [];

  async function walk(currentDir) {
    const children = await readdir(currentDir, { withFileTypes: true });

    for (const child of children) {
      const absolutePath = path.join(currentDir, child.name);

      if (child.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!child.isFile()) {
        continue;
      }

      entries.push({
        absolutePath,
        relativePath: path.relative(rootDir, absolutePath).split(path.sep).join("/"),
      });
    }
  }

  const rootStats = await stat(rootDir);
  if (!rootStats.isDirectory()) {
    throw new Error(`Expected a directory: ${rootDir}`);
  }

  await walk(rootDir);
  return entries;
}

/**
 * @param {string} filePath
 * @returns {Promise<Blob>}
 */
export async function readPathAsBlob(filePath) {
  const bytes = await readFile(filePath);
  return new Blob([bytes]);
}
