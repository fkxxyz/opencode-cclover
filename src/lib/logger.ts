/**
 * Simple logger utility for the plugin
 */
class Logger {
  private prefix = "[opencode-cclover]"

  debug(...args: any[]) {
    console.debug(this.prefix, ...args)
  }

  info(...args: any[]) {
    console.log(this.prefix, ...args)
  }

  warn(...args: any[]) {
    console.warn(this.prefix, ...args)
  }

  error(...args: any[]) {
    console.error(this.prefix, ...args)
  }
}

export const logger = new Logger()
