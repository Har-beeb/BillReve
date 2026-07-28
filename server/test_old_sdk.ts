import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: "d:/My Document/VsCode/Billflow-server/.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

async function check() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent("Hello");
    console.log("old sdk SUCCESS:", response.response.text());
  } catch (err: any) {
    console.error("old sdk failed:", err.message);
  }
}
check();
