import type { NotificationConfig } from "@src/dca.types";

export interface NotificationOptions {
  title: string;
  message: string;
  tags?: string[];
  priority?: number;
  click?: string;
  actions?: Array<{
    action: string;
    label: string;
    url?: string;
  }>;
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  async sendNotification(options: NotificationOptions): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain',
        'Title': options.title,
      };

      if (options.tags && options.tags.length > 0) {
        headers['Tags'] = options.tags.join(',');
      }

      if (options.priority) {
        headers['Priority'] = options.priority.toString();
      }

      if (options.click) {
        headers['Click'] = options.click;
      }

      if (options.actions && options.actions.length > 0) {
        const actionStrings = options.actions.map(action => {
          let actionStr = `${action.action}: ${action.label}`;
          if (action.url) {
            actionStr += `, ${action.url}`;
          }
          return actionStr;
        });
        headers['Actions'] = actionStrings.join('; ');
      }

      const response = await fetch(`https://ntfy.sh/${this.config.ntfy_topic}`, {
        method: 'POST',
        headers,
        body: options.message,
      });
      
      if (!response.ok) {
        throw new Error(`ntfy.sh HTTP ${response.status}: ${await response.text()}`);
      }
      
      console.log(`[notify] Notification sent: ${options.title}`);
    } catch (err) {
      console.error("ntfy.sh error:", err);
      throw err;
    }
  }

  // Convenience methods for common notification types
  async sendSuccess(title: string, message: string, tags: string[] = []): Promise<void> {
    await this.sendNotification({
      title: `✅ ${title}`,
      message,
      tags: [...tags, "success"],
    });
  }

  async sendWarning(title: string, message: string, tags: string[] = []): Promise<void> {
    await this.sendNotification({
      title: `⚠️ ${title}`,
      message,
      tags: [...tags, "warning"],
    });
  }

  async sendError(title: string, message: string, tags: string[] = []): Promise<void> {
    await this.sendNotification({
      title: `❌ ${title}`,
      message,
      tags: [...tags, "error"],
    });
  }

  async sendInfo(title: string, message: string, tags: string[] = []): Promise<void> {
    await this.sendNotification({
      title: `ℹ️ ${title}`,
      message,
      tags: [...tags, "info"],
    });
  }
}

// Factory function to create notification service
export function createNotificationService(config: NotificationConfig): NotificationService {
  return new NotificationService(config);
}
