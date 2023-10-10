# 🎉 Atlas App Services Admin API@3.0

Welcome to the comprehensive interface for the [MongoDB Atlas App Services Admin API (3.0)](https://www.mongodb.com/docs/atlas/app-services/admin/api/v3/)!

This package is derived directly from the official open API specification [here](blob:https://www.mongodb.com/78fd1eaa-8b75-4f59-b462-043187294fd5). It's been refactored and optimized to provide a seamless and efficient experience.

## 🚨 Disclaimer

While this package provides comprehensive access to the MongoDB Atlas App Services Admin API, due to the vastness and complexity of the APIs, not all use cases have been exhaustively tested or verified. Users are encouraged to test the package in their specific contexts and report any issues they encounter. Contributions and feedback are always welcome!

## 🌟 Why Use This?

- **Full Coverage**: This package offers complete access to the MongoDB Atlas App Services Admin API. No more partial implementations or missing features.
- **Optimized for Use**: The refactoring ensures that accessing and using the API is as intuitive and straightforward as possible.

## 🛠 Installation

```sh
npm install atlas-app-services-admin-api --save
```

## 🚀 Getting Started

To begin, you'll need your Public and Private keys, as well as your groupId (identical to your Project Id). Get them [here](https://www.mongodb.com/docs/atlas/app-services/admin/api/v3/).

The default BaseUrl is `https://realm.mongodb.com/api/admin/v3.0`.

Here's a quick example to retrieve the list of Triggers:

```javascript
// If you don't have a logger, you can map the console:
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

exports = async function(arg){
  const logger = new ConsoleLogger(); 
  const { getClient, AtlasAppServicesClient, AtlasAppServicesAdminService } = require('atlas-app-services-admin-api');
  try {
    const configInfo = {
        publicKey: process.env.ATLAS_APP_SERVICES_PUBLIC_KEY,
        privateKey: process.env.ATLAS_APP_SERVICES_PRIVATE_KEY,
        groupId: process.env.ATLAS_APP_SERVICES_GROUP_ID,
        baseUrl: process.env.ATLAS_APP_SERVICES_BASE_URL, // Optional Override
    };
    const atlasClient = new AtlasAppServicesClient(configInfo, logger);
    await atlasClient.initialize();
    const groupId = atlasClient.groupId;
    const appId = atlasClient.appId;
    const triggersApi = await atlasClient.atlasTriggersApi();
    const apiResponse = await triggersApi.adminListTriggers(groupId, appId);
    if (apiResponse.status !== 200 && apiResponse.data) {
        throw new HttpException(apiResponse.data, apiResponse.status);
    }
    return { result: apiResponse.data };
  } catch(err) {
    console.log("Error occurred while executing test:", err.message);
    return { error: err.message };
  }
};
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

Our library's documentation is generated using TypeDoc, ensuring that you get the most accurate and up-to-date information directly from the source code.

Happy coding! 🎉

### ⚖️ License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
