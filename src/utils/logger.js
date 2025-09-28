import winston from 'winston';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, module }) => {
    const moduleInfo = module ? `[${module}]` : '';
    const coloredLevel = {
      error: chalk.red(level.toUpperCase()),
      warn: chalk.yellow(level.toUpperCase()),
      info: chalk.blue(level.toUpperCase()),
      debug: chalk.gray(level.toUpperCase()),
    }[level] || level.toUpperCase();

    if (stack) {
      return `${chalk.gray(timestamp)} ${coloredLevel} ${moduleInfo} ${message}\n${stack}`;
    }
    return `${chalk.gray(timestamp)} ${coloredLevel} ${moduleInfo} ${message}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    new winston.transports.File({
      filename: join(__dirname, '../../logs/error.log'),
      level: 'error',
      handleExceptions: true,
    }),
    new winston.transports.File({
      filename: join(__dirname, '../../logs/combined.log'),
      handleExceptions: true,
    }),
  ],
});

export default logger;