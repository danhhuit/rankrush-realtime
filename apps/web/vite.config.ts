import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { networkInterfaces } from "node:os";

function findLanIp() {
  try {
    return Object.entries(networkInterfaces())
      .filter(
        ([name]) =>
          !/loopback|virtual|vmware|vethernet|wsl|docker|hyper-v/i.test(name),
      )
      .flatMap(([, entries]) => entries || [])
      .find(
        (entry) =>
          entry.family === "IPv4" &&
          !entry.internal &&
          /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address),
      )?.address;
  } catch {
    return undefined;
  }
}

const lanIp = findLanIp();

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_LAN_IP": JSON.stringify(lanIp || ""),
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/socket.io": { target: "http://localhost:4000", ws: true },
    },
  },
});
