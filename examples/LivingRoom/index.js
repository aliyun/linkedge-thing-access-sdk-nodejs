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

const edge = require('linkedge');

module.exports.handler = function (event, context, callback) {
  var obj;
  try {
     obj = JSON.parse(event.toString());
  } catch (err) {
    callback(err);
    return;
  }
  if (!obj.topic || !obj.topic.includes('thing/event/property/post')
    || !obj.payload || !obj.payload.temperature
    || (obj.payload.temperature.value !== 25 && obj.payload.temperature.value !== 28)
    || !obj.provider || !obj.provider.groupId) {
    callback(null);
    return;
  }
  var group = edge.getGroupById(obj.provider.groupId);
  group.getDeviceByProductKeyDeviceName('Air Conditioner Product Key',
    'Air Conditioner Device Name', function (err, device) {
      if (err) {
        callback(err);
        return;
      }
      var operator = obj.payload.temperature.value === 28 ? 'turnOn' : 'turnOff';
      device[operator](err => {
        if (err) {
          callback(err);
          return;
        }
        console.log(`${operator === 'turnOn' ? 'Turn on' : 'Turn off'} device successfully!`);
        callback(null);
      });
    });
};