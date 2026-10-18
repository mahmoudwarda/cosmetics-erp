import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { requirePermission } from "@/server/permissions";
export const runtime="nodejs";
const exec=promisify(execFile);
export async function POST(){try{await requirePermission("settings","edit");const dir=path.resolve(process.env.BACKUP_DIR??"./data/backups");await mkdir(dir,{recursive:true});const file=path.join(dir,`cosmetics-${new Date().toISOString().replace(/[:.]/g,"-")}.dump`);const url=new URL(process.env.DATABASE_URL!);const env={...process.env,PGPASSWORD:decodeURIComponent(url.password)};await exec("pg_dump",["-Fc","-h",url.hostname,"-p",url.port||"5432","-U",decodeURIComponent(url.username),"-d",url.pathname.slice(1),"-f",file],{env});const retention=Math.max(1,Number(process.env.BACKUP_RETENTION??30));const files=await Promise.all((await readdir(dir)).filter(f=>f.endsWith(".dump")).map(async f=>({f,t:(await stat(path.join(dir,f))).mtimeMs})));files.sort((a,b)=>b.t-a.t);for(const old of files.slice(retention))await unlink(path.join(dir,old.f));return NextResponse.json({ok:true,file:path.basename(file)});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"BACKUP_FAILED"},{status:500})}}
