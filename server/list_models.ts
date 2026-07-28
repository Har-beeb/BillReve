import dotenv from "dotenv";

dotenv.config({ path: "d:/My Document/VsCode/Billflow-server/.env" });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found in .env");
    return;
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
      console.error("Error from API:", data.error);
      return;
    }

    console.log("Available models:");
    const models = data.models || [];
    for (const m of models) {
      console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods?.join(", ")})`);
    }
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }
}
listModels();
