import os from "os";

/**
 * Returns the local network IP and URL for accessing the system from other devices on the same Wi-Fi/LAN.
 */
export function getLocalNetworkUrl(port: number = 3001): { ip: string; url: string } {
  const nets = os.networkInterfaces();
  let fallbackIp = "";
  let chosenIp = "";

  for (const name of Object.keys(nets)) {
    const isVirtual = /vethernet|virtual|wsl|docker|hyper-v|loopback/i.test(name);
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254")) {
        if (!isVirtual && !chosenIp) {
          chosenIp = net.address;
        }
        if (!fallbackIp) {
          fallbackIp = net.address;
        }
      }
    }
  }

  const finalIp = chosenIp || fallbackIp || "127.0.0.1";
  return {
    ip: finalIp,
    url: `http://${finalIp}:${port}`,
  };
}
