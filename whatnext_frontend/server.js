const http = require("http");
const fs = require("fs");
const path = require("path");

const START_PORT = Number(process.env.PORT || 5173);
const MAX_PORT_TRIES = 15;
const ROOT = __dirname;
const SOCKET_IO_CLIENT_PATH = path.join(
  ROOT,
  "..",
  "node_modules",
  "socket.io",
  "client-dist",
  "socket.io.min.js",
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(body);
}

function requestHandler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const reqPath = url.pathname === "/" ? "/index.html" : url.pathname;

  if (reqPath === "/socket.io.min.js") {
    fs.readFile(SOCKET_IO_CLIENT_PATH, (err, data) => {
      if (err) {
        send(res, 500, "Socket.IO client library not found");
        return;
      }
      send(res, 200, data, "text/javascript; charset=utf-8");
    });
    return;
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
}

function startServer(port, triesLeft) {
  const server = http.createServer(requestHandler);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && triesLeft > 0) {
      const nextPort = port + 1;
      console.warn(
        `Port ${port} is in use. Retrying on ${nextPort}...`,
      );
      startServer(nextPort, triesLeft - 1);
      return;
    }

    console.error("Failed to start frontend server:", error.message);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`WhatNext frontend running at http://localhost:${port}`);
  });
}

startServer(START_PORT, MAX_PORT_TRIES);
