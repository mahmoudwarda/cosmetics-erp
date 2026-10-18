import { readFile } from "node:fs/promises";
import path from "node:path";

const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.(png|jpe?g|webp)$/i.test(filename)) return new Response("Not found", { status: 404 });
  const directories = [
    path.resolve(process.cwd(), process.env.UPLOADS_DIR || "data/uploads"),
    path.resolve(process.cwd(), "public/uploads"),
  ];
  for (const directory of directories) {
    try {
      const filePath = path.resolve(directory, filename);
      if (path.dirname(filePath) !== directory) continue;
      const data = await readFile(filePath);
      return new Response(new Uint8Array(data), { headers: { "Content-Type": types[path.extname(filename).slice(1).toLowerCase()] ?? "application/octet-stream", "Content-Length": String(data.byteLength), "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff" } });
    } catch { /* Try the existing public/uploads folder for logos uploaded by earlier versions. */ }
  }
  return new Response("Not found", { status: 404 });
}
