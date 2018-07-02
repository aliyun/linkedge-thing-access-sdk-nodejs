# LinkEdge设备接入SDK函数计算Node.js版
英文版请参阅[这里](README.md)

本项目提供一个Node.js包，方便用户在[LinkEdge](https://iot.aliyun.com/products/linkedge?spm=a2c56.193971.1020487.5.666025c8LPHl1r)上编写[函数计算](https://www.aliyun.com/product/fc?spm=5176.8142029.388261.292.e9396d3eVdDQfj)来接入设备。

## 快速开始 - HelloThing
`HelloThing`示例演示使用函数计算将设备接入LinkEdge的全过程。
1. 复制`examples/HelloThing`文件夹到你的工作目录。
2. 进入LinkEdge控制台。
3. 创建一个产品。该产品包含一个`temperature`属性（int32类型）和一个`high_temperature`事件（int32类型和一个int32类型名为`temperature`的输入参数）。
4. 创建一个名为`HelloThing`的上述产品的设备。
5. 使用`HelloThing`的`productKey`和`deviceName`更新`HelloThing/index.js`中对应字段。
6. 压缩`HelloThing`目录的内容为一个zip包，确保`index.js`在顶级目录下。
7. 进入函数计算控制台并创建一个名为`HelloThing`的函数。
8. 运行环境选择*nodejs8*。
9. 在*代码配置*区选择*代码包上传*，并上传代码zip包。
10. 函数入口填写*index.handler*。
11. 回到LinkEdge控制台并创建一个新的分组。
12. 添加LinkEdge网关设备、`HelloThing`设备和`HelloThing`函数到新创建的分组。
13. 使用如下配置添加*消息路由*：
  * 消息来源：`HelloThing`设备
  * TopicFilter：属性
  * 消息目标：IoT Hub
14. 部署分组。`HelloThing`设备的上报的属性和事件将会每隔2秒被同步到云端，可以在LinkEdge控制台设备运行状态页面查看。

## 使用
首先，安装设备接入SDK：
```
npm install linkedge-thing-access-sdk
```

然后，实现设备接入，最常用的使用方式如下：
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

## API参考文档
在项目根目录执行如下命令将会在`docs`目录生成API参考文档。
```
npm run generate-docs
```

## 许可证
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
