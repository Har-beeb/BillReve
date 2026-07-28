import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: "d:/My Document/VsCode/Billflow-server/.env" });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function check() {
  const models = ['gemini-1.5-flash-001', 'gemini-1.5-flash-002', 'gemini-1.5-pro-002'];
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
