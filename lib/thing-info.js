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

/**
 * The class represents a wrapper of thing info that's used to connect to Link IoT Edge.
 */
class ThingInfo {
  /**
   * Construct a new ThingInfo instance.
   *
   * @param productKey {String} the product key
   * @param deviceName {String} the device name
   * @param custom {Object} the associated custom config
   *
   * @private
   */
  constructor({
    productKey,
    deviceName,
    custom,
  } = {}) {
    /**
     * The product key.
     *
     * @type {String}
     */
    this.productKey = productKey;
    /**
     * The device name.
     *
     * @type {String}
     */
    this.deviceName = deviceName;
    /**
     * The associated custom config.
     *
     * @type {Object}
     */
    this.custom = custom;
  }

  /**
   * Construct a new thing from a config description.
   *
   * @private
   */
  static from(config) {
    if (!config.productKey) {
      throw new Error(`Can't find required "productKey".`);
    }
    if (!config.deviceName) {
      throw new Error(`Can't find required "deviceName".`);
    }
    return new ThingInfo(config);
  }
}

module.exports = ThingInfo;