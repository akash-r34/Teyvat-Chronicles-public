import { StoryNode, Character } from "../types";

export async function testVertexConnection() {
  try {
    console.log("Requesting server-side Vertex test...");
    const response = await fetch("/api/vertex-test");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error");
    }

    const resultString = `Server Response: ${data.message}\nProject: ${data.project}\nADC: ${data.hasADC}`;
    console.log("Vertex AI Connection Test Result:", resultString);
    return resultString;
  } catch (err: any) {
    console.error("Vertex AI Connection Test Failed:", err);
    return `Vertex Connection Failed: ${err.message}`;
  }
}

export async function testGeminiConnection() {
  try {
    console.log("Requesting server-side Gemini test...");
    const response = await fetch("/api/gemini-test");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Server error");
    }

    const resultString = `Server Response: ${data.message}\nGemini Key Present: ${data.hasKey}`;
    console.log("Gemini API Connection Test Result:", resultString);
    return resultString;
  } catch (err: any) {
    console.error("Gemini API Connection Test Failed:", err);
    return `Gemini Key Connection Failed: ${err.message}`;
  }
}

export interface GenerateAvatarResult {
  avatarUrl: string;
  enhancedDescription?: string;
}

export async function generateAvatar(character: Character): Promise<GenerateAvatarResult> {
  const response = await fetch("/api/generateAvatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to generate avatar");
  }
  return await response.json();
}

export async function generateMangaImage(imagePrompt: string): Promise<string> {
  // We don't expose this directly anymore since it's an internal helper
  return `https://picsum.photos/seed/${encodeURIComponent(imagePrompt)}/1024/576?grayscale&blur=2`;
}

export async function generateStoryTurn(
  history: StoryNode[],
  character: Character,
  userAction: string
): Promise<StoryNode> {
  const response = await fetch("/api/generateStoryTurn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, character, userAction })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to generate story turn");
  }
  return await response.json();
}

export async function getInitialNode(character: Character): Promise<StoryNode> {
  const response = await fetch("/api/getInitialNode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to get initial node");
  }
  return await response.json();
}

