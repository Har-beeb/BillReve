import { app } from "./app.js";
import { env } from "./config/env.js";
import { startCronJobs } from "./services/cron.js";

const startServer = async () => {
  try {
    startCronJobs();
    
    app.listen(env.PORT, () => {
      console.log(`🚀 BillFlow Server running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
