import os from "os";

/**
 * Returns the local network IP and URL for accessing the system from other devices on the same Wi-Fi/LAN.
 */
export function getLocalNetworkUrl(port: number = 3000): { ip: string; url: string } {
  // If an explicit host IP is configured (e.g. from Docker environment)
  const envIp = process.env.HOST_IP || process.env.NETWORK_IP;
  if (envIp) {
    return {
      ip: envIp,
      url: `http://${envIp}:${port}`,
    };
  }

  const nets = os.networkInterfaces();
  let fallbackIp = "";
  let chosenIp = "";

  for (const name of Object.keys(nets)) {
    const isVirtual = /vethernet|virtual|wsl|docker|hyper-v|loopback|br-|veth/i.test(name);
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254")) {
        // Exclude Docker internal bridge subnets (172.17.x, 172.18.x, 172.19.x)
        const isDockerInternal = /^172\.(17|18|19)\./.test(net.address);
        if (!isVirtual && !isDockerInternal && !chosenIp) {
          chosenIp = net.address;
        }
        if (!fallbackIp && !isDockerInternal) {
          fallbackIp = net.address;
        }
      }
    }
  }

  const finalIp = chosenIp || fallbackIp || "172.20.10.2";
  return {
    ip: finalIp,
    url: `http://${finalIp}:${port}`,
  };
}
