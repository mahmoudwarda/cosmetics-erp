import { NextRequest, NextResponse } from "next/server";
import { getLocalNetworkInfo, saveLocalNetworkIp } from "@/server/network";

export async function GET(request: NextRequest) {
  try {
    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const port = 3000;
    const info = getLocalNetworkInfo(port, hostHeader);
    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to detect network info", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip = typeof body?.ip === "string" ? body.ip.trim() : "";
    if (!ip) {
      return NextResponse.json({ error: "IP address is required" }, { status: 400 });
    }

    const saved = saveLocalNetworkIp(ip);
    if (!saved) {
      return NextResponse.json({ error: "Invalid IPv4 address or write error" }, { status: 400 });
    }

    const info = getLocalNetworkInfo(3000);
    return NextResponse.json({ success: true, ...info });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save network IP", details: String(error) },
      { status: 500 }
    );
  }
}
