const net = require("net");

const server = net.createServer((socket) => {
  const target = net.connect(3000, "127.0.0.1");

  socket.pipe(target);
  target.pipe(socket);

  socket.on("error", () => {});
  target.on("error", () => {});
  socket.on("close", () => target.destroy());
  target.on("close", () => socket.destroy());
});

server.on("error", (err) => {
  console.error("TCP Forwarder error:", err.message);
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Raw TCP forwarder listening on 0.0.0.0:3001 -> 127.0.0.1:3000");
});
