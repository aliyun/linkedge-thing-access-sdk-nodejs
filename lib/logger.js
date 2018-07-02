/*
 * Copyright (c) 2018 Alibaba Group Holding Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const util = require('util');

const LEVEL_DEBUG = 1;
const LEVEL_INFO = 2;
const LEVEL_WARN = 3;
const LEVEL_ERROR = 4;
const LOG_LEVEL = LEVEL_DEBUG;

const LEVELS = ['UNKNOWN', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

function println(level, ...args) {
  if (level >= LOG_LEVEL) {
    var date = new Date();
    console.log(
      `[${date.toLocaleString()}.${date.getMilliseconds()}]`,
      `[${LEVELS[level]}]`,
      util.format(...args));
  }
}

class Logger {
  static debug(...args) {
    println(LEVEL_DEBUG, ...args);
  }

  static info(...args) {
    println(LEVEL_INFO, ...args);
  }

  static warn(...args) {
    println(LEVEL_WARN, ...args);
  }

  static error(...args) {
    println(LEVEL_ERROR, ...args);
  }
}
module.exports = Logger;
module.exports.Logger = Logger;
