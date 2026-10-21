import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { requirePermission } from "@/server/permissions";

export const runtime = "nodejs";

const exec = promisify(execFile);
const backupNamePattern = /^cosmetics-\d{4}-\d{2}-\d{2}T.*\.dump$/;

export async function POST() {
  let backupFile: string | undefined;
  try {
    await requirePermission("settings", "edit");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL_MISSING");

    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (!databaseName) throw new Error("DATABASE_NAME_MISSING");

    const directory = path.resolve(process.env.BACKUP_DIR ?? "./data/backups");
    await mkdir(directory, { recursive: true });
    backupFile = path.join(directory, `cosmetics-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.dump`);
    const environment = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };

    await exec("pg_dump", [
      "-Fc",
      "-h", url.hostname,
      "-p", url.port || "5432",
      "-U", decodeURIComponent(url.username),
      "-d", databaseName,
      "-f", backupFile,
    ], { env: environment, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });

    const configuredRetention = Number(process.env.BACKUP_RETENTION ?? 30);
    const retention = Number.isFinite(configuredRetention)
      ? Math.min(365, Math.max(1, Math.trunc(configuredRetention)))
      : 30;
    const files = await Promise.all((await readdir(directory))
      .filter((file) => backupNamePattern.test(file))
      .map(async (file) => ({ file, modifiedAt: (await stat(path.join(directory, file))).mtimeMs })));
    files.sort((a, b) => b.modifiedAt - a.modifiedAt);
    for (const old of files.slice(retention)) {
      if (path.join(directory, old.file) !== backupFile) await unlink(path.join(directory, old.file));
    }

    return NextResponse.json({ ok: true, file: path.basename(backupFile) });
  } catch (error) {
    if (backupFile) await unlink(backupFile).catch(() => undefined);
    const message = error instanceof Error ? error.message : "BACKUP_FAILED";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    console.error("Database backup failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "BACKUP_FAILED" }, { status: 500 });
  }
}
