/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Simple logger utility for the plugin
 */
class Logger {
  private prefix = "[opencode-cclover]"
  private level: LogLevel = LogLevel.INFO

  /**
   * 设置日志级别
   * @param level 日志级别（字符串或枚举值）
   */
  setLevel(level: string | LogLevel) {
    if (typeof level === "string") {
      const levelMap: Record<string, LogLevel> = {
        error: LogLevel.ERROR,
        warn: LogLevel.WARN,
        info: LogLevel.INFO,
        debug: LogLevel.DEBUG,
      }
      this.level = levelMap[level.toLowerCase()] ?? LogLevel.INFO
    } else {
      this.level = level
    }
  }

  debug(...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(this.prefix, ...args)
    }
  }

  info(...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.log(this.prefix, ...args)
    }
  }

  warn(...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(this.prefix, ...args)
    }
  }

  error(...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(this.prefix, ...args)
    }
  }
}

export const logger = new Logger()

// 从环境变量初始化日志级别
const envLevel = process.env.CCLOVER_LOG_LEVEL
if (envLevel) {
  logger.setLevel(envLevel)
}
