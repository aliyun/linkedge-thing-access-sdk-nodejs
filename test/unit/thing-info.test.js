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

const should = require('should');

process.env.FUNCTION_ID = 'functionId';
process.env.FUNCTION_NAME = 'functionName';

const ThingInfo = require('../../lib/thing-info');

describe('ThingInfo', function () {
  const global = {
    productKey: 'Your Product Key',
    deviceName: 'Your Device Name',
    custom: '{}',
  };
  describe('#from', function () {
    it('should fail since illegal product key config', function () {
      const config = Object.assign({}, global, { productKey: undefined });
      (function () {
        ThingInfo.from(config)
      }).should.throw();
    });
    it('should fail since illegal device name config', function () {
      const config = Object.assign({}, global, { deviceName: undefined });
      (function () {
        ThingInfo.from(config)
      }).should.throw();
    });
    it('should fail since custom config is not JSON string', function () {
      const config = Object.assign({}, global, { custom: 'Your Custom Config' });
      (function () {
        ThingInfo.from(config)
      }).should.throw();
    });
    it('should pass since empty custom config', function () {
      const config = Object.assign({}, global, { custom: undefined });
      (function () {
        ThingInfo.from(config)
      }).should.not.throw();
    });
    it('should pass since all requirements meet', function () {
      const config = Object.assign({}, global);
      (function () {
        ThingInfo.from(config)
      }).should.not.throw();
    });
  });
});

