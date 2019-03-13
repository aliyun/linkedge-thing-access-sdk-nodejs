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

const ThingInfo = require('./thing-info');
const {
  DriverConfigManager,
} = require('./thing-access');

/**
 * Configuration associated with the program.
 */
class Config {

  /**
   * Registers a callback that will be notified when the config changed.
   *
   * @param callback callback to notify when the config changed event occurs.
   */
  static registerChangedCallback(callback) {
    DriverConfigManager.get().on('changes', callback);
  }

  /**
   * Unregisters a callback.
   *
   * @param callback callback to notify when the config changed event occurs.
   */
  static unregisterChangedCallback(callback) {
    DriverConfigManager.get().removeListener('changes', callback);
  }


  /**
   * Returns the global {@link Config} object.
   *
   * @returns {Promise<Config>}
   */
  static get() {
    return DriverConfigManager.get().getConfig().then((config) => {
      return new Config(config);
    });
  }

  /**
   * Construct a new Config with a config string.
   *
   * @param string a JSON config string.
   */
  constructor(string) {
    let config;
    try {
      config = JSON.parse(string);
    } catch (err) {
      // Converting to a new exception that is more readable.
      throw new Error('Config is not JSON string!');
    }
    const devices = config['deviceList'];
    if (!Array.isArray(devices) || devices.length === 0) {
      throw new Error(`Could not find device information in config!`);
    }
    /**
     * @private
     */
    this.thingInfos = devices.map(device => ThingInfo.from(device));
  }

  /**
   * Returns all thing infos for further use.
   *
   * @returns {ThingInfo[]} all things
   */
  getThingInfos() {
    return this.thingInfos;
  }
}

module.exports = Config;