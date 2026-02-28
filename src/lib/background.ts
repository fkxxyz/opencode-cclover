import { logger } from "./logger";

/**
 * Start background tasks
 */
export function startBackgroundTasks() {
  logger.info("Starting background tasks...");

  // Task: Output "hello world" every minute
  setInterval(() => {
    console.log("hello world");
  }, 60000); // 60000ms = 1 minute

  logger.info("Background tasks started successfully");
}
