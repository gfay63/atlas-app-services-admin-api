<h1 p align="center">
🎉 Atlas App Services Admin API@3.0
</h1>



<p align="center">
    <a href="https://gfay63.github.io/atlas-app-services-admin-api/"><b>Documentation & API Specification</b></a> •
    <a href="https://www.mongodb.com/docs/atlas/app-services/admin/api/v3/"><b>MongoDB API Reference</b></a>
</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/atlas-app-services-admin-api.svg)](https://www.npmjs.com/package/atlas-app-services-admin-api)
[![install size](https://img.shields.io/badge/dynamic/json?url=https://packagephobia.com/v2/api.json?p=atlas-app-services-admin-api&query=$.install.pretty&label=install%20size&style=flat-square)](https://packagephobia.now.sh/result?p=atlas-app-services-admin-api)
[![npm downloads](https://img.shields.io/npm/dm/atlas-app-services-admin-api.svg?style=flat-square)](https://npm-stat.com/charts.html?package=atlas-app-services-admin-api)
[![Known Vulnerabilities](https://snyk.io/test/npm/atlas-app-services-admin-api/badge.svg)](https://snyk.io/test/npm/atlas-app-services-admin-api)
![GitHub top language](https://img.shields.io/github/languages/top/gfay63/atlas-app-services-admin-api)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/gfay63)](https://github.com/sponsors/gfay63)
</div>

Welcome to the comprehensive interface for the `MongoDB Atlas App Services Admin API (3.0)`!

This package is derived in part from the official [MongoDB Atlas Open API specification](https://www.mongodb.com/docs/atlas/app-services/admin/api/v3/). It's been refactored and optimized to provide a seamless and efficient experience.

> 🚨 Disclaimer
>
> While this package provides comprehensive access to the MongoDB Atlas App Services Admin API, due to the vastness and complexity of the APIs, not all use cases have been exhaustively tested or verified. Users are encouraged to test the package in their specific contexts and report any issues they encounter. Contributions and feedback are always welcome!

## 🌟 Why Use This?

- **Full Coverage**: This package offers complete access to the MongoDB Atlas App Services Admin API. No more partial implementations or missing features.
- **Optimized for Use**: The refactoring ensures that accessing and using the API is as intuitive and straightforward as possible.
- **Full documentation**: See [full documentation with API Specification](https://gfay63.github.io/atlas-app-services-admin-api/).

## 🛠 Installation

```sh
npm install atlas-app-services-admin-api --save
```

## 🚀 Getting Started

To begin, you'll need your Public and Private keys, as well as your groupId (identical to your Project Id). See how to get them [here](https://www.mongodb.com/docs/atlas/app-services/admin/api/v3/).

The default BaseUrl is `https://realm.mongodb.com/api/admin/v3.0`.

Here's a quick example to retrieve the list of Triggers:

```javascript
// Logging is optional. Use any logger! If you don't have one, you can map the console:
class ConsoleLogger {
    log(message, ...optionalParams) {
        console.log(`**** ConsoleLogger-LOG: ${message}`, ...optionalParams);
    }
    error(message, ...optionalParams) {
        console.error(`**** ConsoleLogger-ERROR: ${message}`, ...optionalParams);
    }
    debug(message, ...optionalParams) {
        console.debug(`**** ConsoleLogger-DEBUG: ${message}`, ...optionalParams);
    }
}

const { AtlasAppServicesClient } = require('atlas-app-services-admin-api');

// Setup optional logging
const logger = new ConsoleLogger();

// Setup your Atlas config per docs
const configInfo = {
    publicKey: process.env.ATLAS_APP_SERVICES_PUBLIC_KEY,
    privateKey: process.env.ATLAS_APP_SERVICES_PRIVATE_KEY,
    groupId: process.env.ATLAS_APP_SERVICES_GROUP_ID,
    baseUrl: process.env.ATLAS_APP_SERVICES_BASE_URL, // Optional Override
};

// Instantiate and initialize the client
const atlasClient = new AtlasAppServicesClient(configInfo, logger);
await atlasClient.initialize();

// Instantiate the specific Atlas API you would like (see docs)
const triggersApi = await atlasClient.atlasTriggersApi();

// Snag Ids from client for the API calls as needed
const groupId = atlasClient.groupId;
const appId = atlasClient.appId;

// Make the API call
const apiResponse = await triggersApi.adminListTriggers(groupId, appId);
if (apiResponse.status !== 200 && apiResponse.data) {
    throw new HttpException(apiResponse.data, apiResponse.status);
}
return { result: apiResponse.data };
```

With this client set up, you have the entire Atlas Admin API at your fingertips! For a detailed guide, check out the full [API Specification](https://gfay63.github.io/atlas-app-services-admin-api/).

## 📌 Features

- **Easy Initialization**: Set up and start using the client in no time.
- **Comprehensive API Access**: From Triggers to Users, access every aspect of the Atlas Admin API.
- **Efficient Error Handling**: Built-in logging and error handling mechanisms for smoother development.
- **Regular Updates**: Stay in sync with the official MongoDB Atlas API.
- **Full API Reference**: Explore the full capabilities of our library in the API Reference.

## 🤝 Contribute

Your insights and contributions can make this package even better! Check out our [CONTRIBUTING.md](./CONTRIBUTING.md) guide and be a part of this exciting project.

## 📖 Documentation

Our [library's documentation](https://gfay63.github.io/atlas-app-services-admin-api/) is generated using TypeDoc, ensuring that you get the most accurate and up-to-date information directly from the source code.

Happy coding! 🎉

### ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
