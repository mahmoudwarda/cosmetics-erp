import os from "os";
import fs from "fs";
import path from "path";

export interface NetworkInterfaceDetail {
  name: string;
  ip: string;
  type: "hotspot" | "wifi" | "lan";
}

export interface NetworkInfo {
  ip: string;
  url: string;
  port: number;
  isHotspot: boolean;
  networkType: "hotspot" | "wifi" | "lan" | "localhost";
  interfaceName?: string;
  allInterfaces: NetworkInterfaceDetail[];
}

function getHostIpFilePath(): string {
  // Check common data directory paths (local vs inside docker)
  const candidates = [
    path.join(process.cwd(), "data", "network", "host_ip.txt"),
    path.join(process.cwd(), "data", "host_ip.txt"),
    "/app/data/network/host_ip.txt",
    "/app/data/host_ip.txt",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Default to standard path
  return path.join(process.cwd(), "data", "network", "host_ip.txt");
}

function isValidIPv4(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const num = Number(p);
    return !isNaN(num) && num >= 0 && num <= 255 && p === String(num);
  });
}

function isDockerOrVirtualIp(ip: string, ifaceName: string): boolean {
  // Docker bridge default subnets
  if (ip.startsWith("172.17.") || ip.startsWith("172.18.") || ip.startsWith("172.19.")) {
    return true;
  }
  // Docker Desktop VM internal hypervisor subnet
  if (ip.startsWith("192.168.65.")) {
    return true;
  }
  // Link-local / loopback
  if (ip.startsWith("127.") || ip.startsWith("169.254.")) {
    return true;
  }
  // Virtual interface names
  if (/vethernet|virtual|wsl|docker|hyper-v|loopback/i.test(ifaceName)) {
    return true;
  }
  return false;
}

function classifyNetworkType(ip: string, ifaceName: string): { type: "hotspot" | "wifi" | "lan"; isHotspot: boolean } {
  // iOS Personal Hotspot standard subnet: 172.20.10.x
  // Android portable hotspot standard subnet: 192.168.43.x
  if (ip.startsWith("172.20.10.") || ip.startsWith("192.168.43.") || /hotspot|tether|pdp_ip|ap[0-9]/i.test(ifaceName)) {
    return { type: "hotspot", isHotspot: true };
  }
  // Wi-Fi interfaces (Mac en0/en1 when wireless, wlan, wl, Wi-Fi)
  if (/wi-fi|wifi|wlan|wireless|en0/i.test(ifaceName)) {
    return { type: "wifi", isHotspot: false };
  }
  return { type: "lan", isHotspot: false };
}

/**
 * Returns dynamic network information, detecting active Wi-Fi, Mobile Hotspot, or LAN.
 */
export function getLocalNetworkInfo(port: number = 3000, clientHostHeader?: string | null): NetworkInfo {
  const allInterfaces: NetworkInterfaceDetail[] = [];

  // 1. Scan OS network interfaces
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        if (!isDockerOrVirtualIp(net.address, name)) {
          const { type } = classifyNetworkType(net.address, name);
          allInterfaces.push({
            name,
            ip: net.address,
            type,
          });
        }
      }
    }
  }

  // 2. Check if a client Host header was provided (e.g. from an HTTP request)
  if (clientHostHeader) {
    // Strip port if present
    const cleanHost = clientHostHeader.split(":")[0].trim();
    if (isValidIPv4(cleanHost) && cleanHost !== "127.0.0.1" && !cleanHost.startsWith("172.18.")) {
      const { type, isHotspot } = classifyNetworkType(cleanHost, "client-request");
      return {
        ip: cleanHost,
        url: `http://${cleanHost}:${port}`,
        port,
        isHotspot,
        networkType: type,
        interfaceName: "direct-connection",
        allInterfaces,
      };
    }
  }

  // 3. Check persistent host IP file (written by host sync script or user)
  const hostIpPath = getHostIpFilePath();
  if (fs.existsSync(hostIpPath)) {
    try {
      const savedIp = fs.readFileSync(hostIpPath, "utf-8").trim();
      if (isValidIPv4(savedIp) && savedIp !== "127.0.0.1" && !savedIp.startsWith("172.18.")) {
        const { type, isHotspot } = classifyNetworkType(savedIp, "saved-host-ip");
        return {
          ip: savedIp,
          url: `http://${savedIp}:${port}`,
          port,
          isHotspot,
          networkType: type,
          interfaceName: "sync-file",
          allInterfaces,
        };
      }
    } catch {
      // Ignore read errors
    }
  }

  // 4. Check environment variable HOST_IP
  const envIp = process.env.HOST_IP?.trim();
  if (envIp && isValidIPv4(envIp)) {
    const { type, isHotspot } = classifyNetworkType(envIp, "env-var");
    return {
      ip: envIp,
      url: `http://${envIp}:${port}`,
      port,
      isHotspot,
      networkType: type,
      interfaceName: "env",
      allInterfaces,
    };
  }

  // 5. Pick from scanned interfaces: prefer Hotspot -> Wi-Fi -> LAN
  const hotspotIface = allInterfaces.find((i) => i.type === "hotspot");
  const wifiIface = allInterfaces.find((i) => i.type === "wifi");
  const chosen = hotspotIface || wifiIface || allInterfaces[0];

  if (chosen) {
    const { type, isHotspot } = classifyNetworkType(chosen.ip, chosen.name);
    return {
      ip: chosen.ip,
      url: `http://${chosen.ip}:${port}`,
      port,
      isHotspot,
      networkType: type,
      interfaceName: chosen.name,
      allInterfaces,
    };
  }

  // Fallback to localhost if no external interface detected
  return {
    ip: "127.0.0.1",
    url: `http://127.0.0.1:${port}`,
    port,
    isHotspot: false,
    networkType: "localhost",
    interfaceName: "lo",
    allInterfaces,
  };
}

/**
 * Saves a custom or updated host IP so that all subsequent requests use it.
 */
export function saveLocalNetworkIp(ip: string): boolean {
  if (!isValidIPv4(ip)) return false;
  try {
    const filePath = getHostIpFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, ip.trim(), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Backward compatible helper for existing server components
 */
export function getLocalNetworkUrl(port: number = 3000): { ip: string; url: string } {
  const info = getLocalNetworkInfo(port);
  return {
    ip: info.ip,
    url: info.url,
  };
}
