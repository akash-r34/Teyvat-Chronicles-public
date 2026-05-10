import { GoogleGenAI } from "@google/genai";

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_GOOGLE_CLOUD_PROJECT;
  if (!gcpProject) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT environment variable");
  }
  const ai = new GoogleGenAI({ vertexai: true, project: gcpProject, location: 'global' });

  const model = "text-embedding-004";
    
  // Handle batching if we have multiple texts, though GenAI's SDK handles generateContent well.
  // For embeddings, we map over texts and get embeddings.
  const embeddings = [];
  for (const text of texts) {
      if (!text.trim()) {
        embeddings.push(new Array(768).fill(0));
        continue;
      }
      try {
        const result = await ai.models.embedContent({ 
          model, 
          contents: text,
          config: { outputDimensionality: 768 }
        });
        embeddings.push(result.embeddings?.[0]?.values || new Array(768).fill(0));
      } catch (err) {
        console.error("Embedding generation failed:", err);
        embeddings.push(new Array(768).fill(0));
      }
  }

  return embeddings;
}
