import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// ============================================================
// PERMANENT REDIRECT TO PRODUCTION DOMAIN
// All code remains intact, but server redirects all requests
// to the production site at pollinatecurriculum.com
// ============================================================
app.use((req, res, next) => {
  const redirectUrl = 'https://pollinatecurriculum.com';
  
  // Send 301 Permanent Redirect
  res.status(301);
  res.setHeader('Location', redirectUrl);
  
  // Send nice HTML page for browsers
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Pollinate Curriculum</title>
    <meta http-equiv="refresh" content="0; url=${redirectUrl}" />
    <link rel="canonical" href="${redirectUrl}" />
    <style>
      body {font-family: system-ui, sans-serif; text-align: center; margin-top: 15vh; background: #f1faee; color: #2d6a4f;}
      h1 {font-size: 2.8rem; margin-bottom: 1rem;}
      p {font-size: 1.3rem;}
      a {color: #40916c; font-weight: 600; text-decoration: underline;}
    </style>
  </head>
  <body>
    <h1>✨ Pollinate Curriculum</h1>
    <p>Taking you to the new home...</p>
    <p><a href="${redirectUrl}">Click here if you're not redirected →</a></p>
  </body>
</html>`);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
