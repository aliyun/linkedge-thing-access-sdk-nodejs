# LinkEdge Thing Access SDK on Function Compute for Node.js
Please reference to [here](README-zh.md) for Simplified Chinese version.

The project providers a node.js package that make it easy to develop services running in [LinkEdge](https://iot.aliyun.com/products/linkedge?spm=a2c56.193971.1020487.5.666025c8LPHl1r)'s [Function Compute](https://www.alibabacloud.com/zh/product/function-compute?spm=a2796.194751.1097650.dznavproductsa13.721c1d2eTyJQsv) that connecting things to LinkEdge.

## Getting Started - HelloThing
The `HelloThing` sample demonstrates you the procedure that connecting things to LinkEdge.
1. Copy `examples/HelloThing` folder to your workspace.
2. Go to LinkEdge console.
3. Create a product, which owns an property named `temperature`(type of int32), and an event named `high_temperature`(type of int32 and has a input parameter named `temperature` whose type is int32).
4. Create a device of the product created last step, with name `HelloThing`.
5. Update `HelloThing/index.js` in your workspace with the `productKey` and `deviceName` of the last created device.
6. Zip up the context of `HelloThing` folder so that the `index.js` is on the top of the zip file structure.
7. Go to Function Compute console and create a new function with name `HelloThing`.
8. Choose the runtime as *nodejs8*.
9. Upload the zip file in *Code Configuration* section.
10. Function handler is *index.handler*.
11. Back to LinkEdge console and create a new group.
12. Add the LinkEdge core device , the `HelloThing` device and the `HelloThing` function into that group.
13. Add a *Message Router* with the folowing configuration:
  * Source: `HelloThing` device
  * TopicFilter: Properties.
  * Target: IoT Hub
14. Deploy. A message from `HelloThing` device should be published to IoT Hub every 2 seconds. You can check this by going to LinkEdge console Device Running State page.

## Usage
First install this library:
```
npm install linkedge-thing-access-sdk
```

Then connect thing to LinkEdge. The most common use is as follows:
```
const {
  ThingAccessClient
} = require('linkedge-thing-access-sdk');

const config = {
  productKey: 'Your Product Key',
  deviceName: 'Your Device Name',
};
const callbacks = {
  setProperties: function (properties) {
    // Set properties to thing and return the result.
    // Return a object result or a promise of it. Throw the error if one raises.
    return {
      code: 0,
      message: 'success',
      }
    };
  },
  getProperties: function (keys) {
    // Get properties from thing and return them.
    // Return a object result or a promise of it. Throw the error if one raises.
    return {
      code: 0,
      message: 'success',
      params: {
        key1: 'value1',
        key2: 'value2',
      }
    };
  },
  callService: function (name, args) {
    // Call services on thing and return the result.
    // Return a object result or a promise of it. Throw the error if one raises.
    return new Promise((resolve) => {
      resolve({
        code: 0,
        message: 'success',
      });
    });
  }
};


var client = new ThingAccessClient(config, callbacks);
client.setup()
  .then(() => {
    return client.registerAndOnline();
  })
  .then(() => {
    // Push events and properties to LinkEdge platform.
    return new Promise((resolve) => {
      var count = 0;
      var timeout = setInterval(() => {
        count++;
        /*if (count >= 3) {
          clearInterval(timeout);
          resolve();
        }*/
        client.reportEvent('high_temperature', {temperature: 41});
        client.reportProperties({
          'temperature': 41,
        });
      }, 2000);
    });
  })
  .then(() => {
    return client.offline();
  })
  .then(() => {
    return client.cleanup();
  })
  .catch(err => {
    console.log(err);
  });
```

## References
You can run the following command in the root of the project to generate the API references to `docs` directory.
```
npm run generate-docs
```

## License
```
Copyright (c) 2017-present Alibaba Group Holding Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
