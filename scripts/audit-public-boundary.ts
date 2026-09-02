import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const forbiddenFilename = /(raw|restricted|embedding|provider-response|evidence\.server)/iu;
const forbiddenContent = /(APIFY_TOKEN=|YOUTUBE_API_KEY=|GEMINI_API_KEY=|REDDIT_CLIENT_ID=|REDDIT_CLIENT_SECRET=|BEGIN PRIVATE KEY|sk-[A-Za-z0-9]{12,})/u;

async function filesUnder(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root);
    const output: string[] = [];
    for (const entry of entries) {
      const item = path.join(root, entry);
      if ((await stat(item)).isDirectory()) output.push(...await filesUnder(item));
      else output.push(item);
    }
    return output;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function auditPublicBoundary(roots: readonly string[]): Promise<{ filesChecked: number }> {
  const files = (await Promise.all(roots.map(filesUnder))).flat();
  for (const file of files) {
    if (forbiddenFilename.test(path.basename(file))) throw new Error(`Forbidden public artifact filename: ${file}`);
    const content = await readFile(file);
    if (content.includes(0)) continue;
    if (forbiddenContent.test(content.toString("utf8"))) throw new Error(`Potential secret material in public artifact: ${file}`);
  }
  return { filesChecked: files.length };
}

async function main(): Promise<void> {
  const result = await auditPublicBoundary([path.join(process.cwd(), "public"), path.join(process.cwd(), ".next", "static")]);
  console.log(`Public boundary audit passed for ${result.filesChecked} files.`);
}

if (process.argv[1]?.endsWith("audit-public-boundary.ts")) main().catch((error) => { console.error(error); process.exitCode = 1; });
