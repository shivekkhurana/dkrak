import pino from "pino";

// Create logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
});

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};
