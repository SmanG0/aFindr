import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check price/news alerts every 2 minutes
crons.interval("check-alerts", { minutes: 2 }, internal.alertChecker.run);

// Rebuild user memory profiles every 6 hours
crons.interval("rebuild-memory", { hours: 6 }, internal.memory.rebuildAllProfiles);

export default crons;
