import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const CLOUDFRONT_BASE = "https://d1nt34i9nvab8r.cloudfront.net";

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Proxy for Data
  app.get("/api/data/*", async (req, res) => {
    const targetPath = req.params[0];
    const targetUrl = `${CLOUDFRONT_BASE}/data/${targetPath}`;
    
    console.log(`[Proxy Data] ${req.method} ${req.url} -> ${targetUrl}`);
    
    try {
      const response = await axios.get(targetUrl, {
        responseType: "json",
      });
      res.json(response.data);
    } catch (error: any) {
      console.error(`[Proxy Data Error] ${targetUrl}:`, error.message);
      const status = error.response?.status || 500;
      res.status(status).send(error.message);
    }
  });

  // Proxy for Images
  app.get("/api/images/*", async (req, res) => {
    const targetPath = req.params[0];
    const targetUrl = `${CLOUDFRONT_BASE}/images/${targetPath}`;
    
    console.log(`[Proxy Images] ${req.method} ${req.url} -> ${targetUrl}`);

    try {
      const response = await axios.get(targetUrl, {
        responseType: "arraybuffer",
      });
      
      const contentType = response.headers["content-type"];
      if (typeof contentType === "string") {
        res.setHeader("Content-Type", contentType);
      }
      
      res.send(response.data);
    } catch (error: any) {
      console.error(`[Proxy Images Error] ${targetUrl}:`, error.message);
      const status = error.response?.status || 500;
      res.status(status).send(error.message);
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
