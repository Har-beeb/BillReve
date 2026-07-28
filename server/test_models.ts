import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: "d:/My Document/VsCode/Billflow-server/.env" });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function check() {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-2.0-pro-exp', 'gemini-1.0-pro'];
  for (const m of models) {
    try {
      const response = await ai.models.generateContent({
        model: m,
        contents: "Hello",
      });
      console.log(m, "SUCCESS:", response.text);
    } catch (err: any) {
      console.error(m, "failed:", err.message);
    }
  }
}
check();
