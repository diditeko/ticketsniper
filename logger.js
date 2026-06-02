const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'logs', `run_${Date.now()}.log`);

const LEVELS = {
  INFO:    { color: chalk.cyan,    label: 'INFO ' },
  SUCCESS: { color: chalk.green,   label: 'OK   ' },
  WARN:    { color: chalk.yellow,  label: 'WARN ' },
  ERROR:   { color: chalk.red,     label: 'ERROR' },
  FIRE:    { color: chalk.magenta, label: 'FIRE ' },
  STEP:    { color: chalk.blue,    label: 'STEP ' },
};

let _wsBroadcast = null;

function setWebSocketBroadcaster(fn) {
  _wsBroadcast = fn;
}

function log(level, message) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);
  const { color, label } = LEVELS[level] || LEVELS.INFO;
  const line = `[${ts}] [${label}] ${message}`;

  console.log(color(line));

  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) {}

  if (_wsBroadcast) {
    _wsBroadcast({ type: 'log', level, message, ts });
  }
}

module.exports = {
  info:    (msg) => log('INFO', msg),
  success: (msg) => log('SUCCESS', msg),
  warn:    (msg) => log('WARN', msg),
  error:   (msg) => log('ERROR', msg),
  fire:    (msg) => log('FIRE', msg),
  step:    (msg) => log('STEP', msg),
  setWebSocketBroadcaster,
};
