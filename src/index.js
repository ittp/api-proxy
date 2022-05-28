const http = require("http");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const fetch = require("node-fetch");

const HTTP_PORT = 8080;
const HTTP_INTERNAL = 3001;

const app = express();

// first async middlware doing something async
const entryMiddleware = async (req, res, next) => {
  const foo = await new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({ da: "da" });
    }, 200);
  });
  req.locals = {
    da: foo.da
  };
  next();
};

const proxy = createProxyMiddleware({
  target: "http://localhost:3001",
  changeOrigin: true,
  selfHandleResponse: true,
  onProxyReq: (proxyReq, req, res) => {
    // just check if headers are good set in previous middleware
    console.log("proxyReq - test entry async is provided:", req.locals.da);
    proxyReq.setHeader("mpth-1", "da");
  },
  onProxyRes: async (proxyRes, req, res) => {
    console.log("onProxyRes");

    const da = await new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({ wei: "wei" });
      }, 200);
    });

    // this is what we want to achieve
    res.setHeader("mpth-2", da.wei);

    proxyRes.pipe(res);
  }
});

// Now see our chain
app.use("/", entryMiddleware, proxy);

// fake proxied endpoint, just local overhere
http
  .createServer(
    express().use("/", (req, res, next) => {
      // testing async header before we do proxy
      console.log("target - async request header:", req.headers["mpth-1"]);

      res.send({ baba: "yaga" });
    })
  )
  .listen(HTTP_INTERNAL, () => {
    console.log(`🚀 dummy service started on ${HTTP_INTERNAL}`);
  });

// proxy server
http.createServer(app).listen(HTTP_PORT, async () => {
  console.log(`🚀 proxy started on ${HTTP_PORT}`);

  // show entry to our proxy server
  const test = await fetch(`http://localhost:${HTTP_PORT}`, {
    method: "GET"
  });

  console.log("test - start:", test.status);
  const json = await test.json();

  // we get the async set response header
  console.log("test - response header:", test.headers.get("mpth-2"));

  // we get the data
  console.log("test - end:", json);
});
