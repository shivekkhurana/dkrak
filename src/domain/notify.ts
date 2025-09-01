import type {
  NotificationConfig,
  NotificationOptions,
} from "@src/domain/notify.types";
import { createLogger } from "@src/logger";

const logger = createLogger("notify");

export async function sendNotification(
  config: NotificationConfig,
  options: NotificationOptions
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "text/plain",
      Title: options.title,
    };

    const response = await fetch(`https://ntfy.sh/${config.ntfy_topic}`, {
      method: "POST",
      headers,
      body: options.message,
    });

    if (!response.ok) {
      throw new Error(
        `ntfy.sh HTTP ${response.status}: ${await response.text()}`
      );
    }

    logger.info({ title: options.title }, "Notification sent");
  } catch (err) {
    logger.error({ error: err }, "ntfy.sh error");
    throw err;
  }
}
