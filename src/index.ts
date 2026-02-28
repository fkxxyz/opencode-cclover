import { Plugin } from "@opencode-ai/plugin";
import { startBackgroundTasks } from "./lib/background";
import { logger } from "./lib/logger";

/**
 * OpenCode Cclover Plugin
 * 
 * A comprehensive plugin that demonstrates background task management.
 */
export const CcloverPlugin: Plugin = async (ctx) => {
  logger.info("Initializing opencode-cclover plugin...");

  // Start background tasks (outputs "hello world" every minute)
  startBackgroundTasks();

  logger.info("Plugin initialized successfully");

  // Return hooks (empty for now, can be extended later)
  return {
    // Future: Add tools, hooks, etc.
  };
};

// Default export
export default CcloverPlugin;
