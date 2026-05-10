import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { aiRouter } from "./src/server/aiRouter.ts";
import { sessionRouter } from "./src/server/routes/session.ts";
import { imagesRouter } from "./src/server/routes/images.ts";
import { saveRouter } from "./src/server/routes/save.ts";
import { dbAdminRouter } from "./src/server/routes/dbAdmin.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Normal JSON limit (base64 is mostly gone)
  app.use(express.json({ limit: '1mb' }));

  app.use("/api", aiRouter);
  app.use("/api/session", sessionRouter);
  app.use("/api/images", imagesRouter);
  app.use("/api/saves", saveRouter);
  app.use("/api/db", dbAdminRouter);

  // API Route for Vertex AI Test
  app.get("/api/vertex-test", async (req, res) => {
    try {
      const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_GOOGLE_CLOUD_PROJECT;
      const hasADC = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (!gcpProject) {
        return res.status(400).json({
          error: "Missing GOOGLE_CLOUD_PROJECT environment variable."
        });
      }

      console.log(`Testing Vertex AI for project: ${gcpProject}`);

      const vertexAi = new GoogleGenAI({
        vertexai: true, project: gcpProject, location: 'global'
      });

      let testResults = "";

      // Test the requested model.
      try {
        const response = await vertexAi.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: "Respond with exactly 'Vertex Server OK'" }] }]
        });
        testResults += `✅ gemini-3-flash-preview is working! Responded: ${response.text}\n`;
      } catch (err: any) {
        throw new Error(`Failed on gemini-3-flash-preview: ${err.message}`);
      }

      res.json({
        success: true,
        message: testResults,
        project: gcpProject,
        hasADC: hasADC
      });
    } catch (err: any) {
      console.error("Server-side Vertex Test Failed:", err);

      res.status(500).json({
        error: err.message,
        raw: err.message
      });
    }
  });

  // API Route for Gemini API Key Test
  app.get("/api/gemini-test", async (req, res) => {
    try {
      const apiKey = (process.env.MY_GEMINI_API_KEY || "").trim();

      if (!apiKey) {
        return res.status(400).json({
          error: "Missing MY_GEMINI_API_KEY. Please set it in Settings -> Secrets."
        });
      }

      const geminiAi = new GoogleGenAI({ apiKey });
      let testResults = "";

      try {
        // Use gemini-3-flash-preview as requested
        const response = await geminiAi.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: "Keep this extremely short: Hello" }] }]
        });
        testResults += `✅ Connection successful! Responded: ${response.text}\n`;
      } catch (err: any) {
        console.error("Gemini SDK call failed:", err);
        throw new Error(`API Call Failed: ${err.message}`);
      }

      res.json({
        success: true,
        message: testResults,
        hasKey: true,
        keyDetails: {
          length: apiKey.length,
          prefix: apiKey.substring(0, 4)
        }
      });
    } catch (err: any) {
      console.error("Server-side Gemini Test Failed:", err);
      res.status(500).json({
        error: err.message,
        raw: err.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
