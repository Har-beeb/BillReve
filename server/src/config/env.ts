import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL").optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  EMAIL_SENDER_TRANSACTIONAL: z.string().optional(),
  EMAIL_SENDER_ADVERTISEMENT: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  VITE_SUPABASE_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:");
  process.exit(1);
}

export const env = parsedEnv.data;
