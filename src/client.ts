// Copyright (c) 2023 Gregory Fay
// This software is licensed under the MIT License.

import * as API from '.';
import { AdminLoginRequest, Configuration, ConfigurationParameters } from '.';

/**
 * Logger interface for custom logging.
 */
export interface Logger {
    log: (message: string, ...optionalParams: any[]) => void;
    error: (message: string, ...optionalParams: any[]) => void;
    debug: (message: string, ...optionalParams: any[]) => void;
    // ... other log levels as needed
}

/**
 * No operation logger for default logging.
 */
class NoOpLogger implements Logger {
    log(message: string, ...optionalParams: any[]): void { }
    error(message: string, ...optionalParams: any[]): void { }
    debug(message: string, ...optionalParams: any[]): void { }
}

/**
 * Custom error for App ID retrieval failures.
 */
class AppIdRetrievalError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AppIdRetrievalError';
    }
}

/**
 * Custom error for unauthorized access.
 */
class UnauthorizedException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedException';
    }
}

/**
 * AtlasAppServicesClient class for interacting with Atlas App Services.
 */
export class AtlasAppServicesClient {
    private adminApi: API.AdminApi;
    private appsApi: API.AppsApi;
    public groupId: string;
    public appId: string;
    public clientAppId: string;
    private userId: string;
    private configParams: ConfigurationParameters;
    private accessToken: string;
    private refreshToken: string;
    private tokenExpiration: Date;
    private logger: Logger;
    private apis: { [key: string]: any } = {}; // Cache of instantiated APIs

    /**
     * Constructor for AtlasAppServicesClient.
     * @param config - Configuration object containing publicKey, privateKey, baseUrl, and groupId.
     * @param logger - Optional logger for custom logging.
     */
    constructor(
        config: {
            publicKey: string,
            privateKey: string,
            baseUrl: string,
            groupId: string,
        },
        logger?: Logger,
    ) {
        this.logger = logger || new NoOpLogger();
        this.configParams = {
            username: config.publicKey,
            apiKey: config.privateKey,
            basePath: config.baseUrl,
            baseOptions: {
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        };
        this.groupId = config.groupId;
    }

    /**
     * Initialize the client by logging in and setting up the app.
     */
    async initialize() {
        await this.loginAndAppSetup();
    }

    private async loginAndAppSetup() {
        try {
            const loginResponse = await this.doAdminLogin();
            this.appsApi = new API.AppsApi(new Configuration(this.configParams));
            const appsResponse = await this.appsApi.adminListApplications(this.groupId, "atlas");
            if (!appsResponse.data || !appsResponse.data[0] || !appsResponse.data[0]._id) {
                this.logger.error(`Failed to get appID App Services Admin API: ${JSON.stringify(appsResponse.data, null, 2)}`);
                throw new AppIdRetrievalError('Failed to retrieve appID from App Services Admin API.');
            }
            this.appId = appsResponse.data[0]._id;
            this.clientAppId = appsResponse.data[0].client_app_id;
            this.groupId = appsResponse.data[0].group_id;
        } catch (error) {
            throw error;
        }
    }

    private async doAdminLogin() {
        const adminLoginRequest: AdminLoginRequest = {
            username: this.configParams.username,
            apiKey: this.configParams.apiKey
        };
        this.adminApi = new API.AdminApi(new Configuration(this.configParams));
        const loginResponse = await this.adminApi.adminLogin("mongodb-cloud", adminLoginRequest);
        if (!loginResponse.data || !loginResponse.data.access_token || !loginResponse.data.refresh_token) {
            throw new UnauthorizedException('Failed to Login to Atlas App Services Admin API');
        }
        this.setAccessToken(loginResponse.data.access_token);
        this.refreshToken = loginResponse.data.refresh_token;
        this.userId = loginResponse.data.user_id;
        this.logger.log('Successfully completed login to Atlas App Services Admin API');
        return loginResponse;
    }

    private setAccessToken(token: string) {
        this.tokenExpiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
        this.accessToken = token;
        this.configParams.accessToken = token;
    }

    private isAccessTokenValid(): boolean {
        if (!this.tokenExpiration) {
            return false;
        }
        return Date.now() < this.tokenExpiration.getTime() - 30 * 1000; // 30 seconds before expiration
    }

    private async ensureValidAccessToken(): Promise<void> {
        if (this.isAccessTokenValid()) {
            return;
        }
        this.configParams.accessToken = this.refreshToken;
        this.adminApi = new API.AdminApi(new Configuration(this.configParams));
        try {
            const refreshResponse = await this.adminApi.adminCreateSession();
            if (!refreshResponse || !refreshResponse.data || !refreshResponse.data.access_token) {
                this.logger.error(`Failed to refresh access token: ${JSON.stringify(refreshResponse.data, null, 2)}`);
                await this.loginAndAppSetup(); // Re-login and re-initialize
            } else {
                this.logger.log('Successfully refreshed access token');
                this.setAccessToken(refreshResponse.data.access_token);
            }
        } catch (error) {
            this.logger.error(`Failed to refresh access token (error): ${JSON.stringify(error.response.data, null, 2)}`);
            await this.loginAndAppSetup(); // Re-login and re-initialize
        }
    }

    private async instantiateApi(apiName: string): Promise<any> {
        await this.ensureValidAccessToken();
        const ApiClass = (API as { [key: string]: any })[apiName];
        if (typeof ApiClass !== 'function') {
            throw new Error(`API ${apiName} does not exist`);
        }

        const apiInstance = new ApiClass(new API.Configuration(this.configParams));
        return new Proxy(apiInstance, this.createApiProxyHandler());
    }

    private createApiProxyHandler(): ProxyHandler<any> {
        return {
            get: (target, propKey, receiver) => {
                const origMethod = target[propKey];
                if (typeof origMethod === 'function') {
                    return (...args: any[]) => {
                        this.logger.log(`Calling method: '${String(propKey)}' with arguments: ${this.stringifyArgs(args)}`);
                        return origMethod.apply(target, args);
                    };
                } else {
                    return origMethod;
                }
            }
        };
    }

    private stringifyArgs(args: any[], depth: number = 2): string {
        const cache: any[] = [];
        return JSON.stringify(args, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    // Circular reference found, discard key
                    return;
                }
                // Store value in our collection
                cache.push(value);
            }
            return value;
        }, depth);
    }

    /*** Getters for the APIs */

    /*** Getters for the APIs */

    /**
     * Get an instance of the Admin API.
     * @returns {Promise<API.AdminApi>} An instance of the Admin API.
     */
    async atlasAdminApi(): Promise<API.AdminApi> {
        return await this.instantiateApi('AdminApi');
    }

    /**
     * Get an instance of the API Keys API.
     * @returns {Promise<API.ApikeysApi>} An instance of the API Keys API.
     */
    async atlasApikeysApi(): Promise<API.ApikeysApi> {
        return await this.instantiateApi('ApikeysApi');
    }

    /**
     * Get an instance of the Apps API.
     * @returns {Promise<API.AppsApi>} An instance of the Apps API.
     */
    async atlasAppsApi(): Promise<API.AppsApi> {
        return await this.instantiateApi('AppsApi');
    }

    /**
     * Get an instance of the Auth Providers API.
     * @returns {Promise<API.AuthprovidersApi>} An instance of the Auth Providers API.
     */
    async atlasAuthprovidersApi(): Promise<API.AuthprovidersApi> {
        return await this.instantiateApi('AuthprovidersApi');
    }

    /**
     * Get an instance of the Billing API.
     * @returns {Promise<API.BillingApi>} An instance of the Billing API.
     */
    async atlasBillingApi(): Promise<API.BillingApi> {
        return await this.instantiateApi('BillingApi');
    }

    /**
     * Get an instance of the Custom User Data API.
     * @returns {Promise<API.CustomUserDataApi>} An instance of the Custom User Data API.
     */
    async atlasCustomUserDataApi(): Promise<API.CustomUserDataApi> {
        return await this.instantiateApi('CustomUserDataApi');
    }

    /**
     * Get an instance of the Data API.
     * @returns {Promise<API.DataApiApi>} An instance of the Data API.
     */
    async atlasDataApiApi(): Promise<API.DataApiApi> {
        return await this.instantiateApi('DataApiApi');
    }

    /**
     * Get an instance of the Dependencies API.
     * @returns {Promise<API.DependenciesApi>} An instance of the Dependencies API.
     */
    async atlasDependenciesApi(): Promise<API.DependenciesApi> {
        return await this.instantiateApi('DependenciesApi');
    }

    /**
     * Get an instance of the Deploy API.
     * @returns {Promise<API.DeployApi>} An instance of the Deploy API.
     */
    async atlasDeployApi(): Promise<API.DeployApi> {
        return await this.instantiateApi('DeployApi');
    }

    /**
     * Get an instance of the Email API.
     * @returns {Promise<API.EmailApi>} An instance of the Email API.
     */
    async atlasEmailApi(): Promise<API.EmailApi> {
        return await this.instantiateApi('EmailApi');
    }

    /**
     * Get an instance of the Endpoints API.
     * @returns {Promise<API.EndpointsApi>} An instance of the Endpoints API.
     */
    async atlasEndpointsApi(): Promise<API.EndpointsApi> {
        return await this.instantiateApi('EndpointsApi');
    }

    /**
     * Get an instance of the Environments API.
     * @returns {Promise<API.EnvironmentsApi>} An instance of the Environments API.
     */
    async atlasEnvironmentsApi(): Promise<API.EnvironmentsApi> {
        return await this.instantiateApi('EnvironmentsApi');
    }

    /**
     * Get an instance of the Event Subscriptions API.
     * @returns {Promise<API.EventSubscriptionsApi>} An instance of the Event Subscriptions API.
     */
    async atlasEventSubscriptionsApi(): Promise<API.EventSubscriptionsApi> {
        return await this.instantiateApi('EventSubscriptionsApi');
    }

    /**
     * Get an instance of the Functions API.
     * @returns {Promise<API.FunctionsApi>} An instance of the Functions API.
     */
    async atlasFunctionsApi(): Promise<API.FunctionsApi> {
        return await this.instantiateApi('FunctionsApi');
    }

    /**
     * Get an instance of the GraphQL API.
     * @returns {Promise<API.GraphqlApi>} An instance of the GraphQL API.
     */
    async atlasGraphqlApi(): Promise<API.GraphqlApi> {
        return await this.instantiateApi('GraphqlApi');
    }

    /**
     * Get an instance of the Hosting API.
     * @returns {Promise<API.HostingApi>} An instance of the Hosting API.
     */
    async atlasHostingApi(): Promise<API.HostingApi> {
        return await this.instantiateApi('HostingApi');
    }

    /**
     * Get an instance of the Log Forwarders API.
     * @returns {Promise<API.LogForwardersApi>} An instance of the Log Forwarders API.
     */
    async atlasLogForwardersApi(): Promise<API.LogForwardersApi> {
        return await this.instantiateApi('LogForwardersApi');
    }

    /**
     * Get an instance of the Logs API.
     * @returns {Promise<API.LogsApi>} An instance of the Logs API.
     */
    async atlasLogsApi(): Promise<API.LogsApi> {
        return await this.instantiateApi('LogsApi');
    }

    /**
     * Get an instance of the Metrics API.
     * @returns {Promise<API.MetricsApi>} An instance of the Metrics API.
     */
    async atlasMetricsApi(): Promise<API.MetricsApi> {
        return await this.instantiateApi('MetricsApi');
    }

    /**
     * Get an instance of the Notifications API.
     * @returns {Promise<API.NotificationsApi>} An instance of the Notifications API.
     */
    async atlasNotificationsApi(): Promise<API.NotificationsApi> {
        return await this.instantiateApi('NotificationsApi');
    }

    /**
     * Get an instance of the Rules API.
     * @returns {Promise<API.RulesApi>} An instance of the Rules API.
     */
    async atlasRulesApi(): Promise<API.RulesApi> {
        return await this.instantiateApi('RulesApi');
    }

    /**
     * Get an instance of the Schemas API.
     * @returns {Promise<API.SchemasApi>} An instance of the Schemas API.
     */
    async atlasSchemasApi(): Promise<API.SchemasApi> {
        return await this.instantiateApi('SchemasApi');
    }

    /**
     * Get an instance of the Secrets API.
     * @returns {Promise<API.SecretsApi>} An instance of the Secrets API.
     */
    async atlasSecretsApi(): Promise<API.SecretsApi> {
        return await this.instantiateApi('SecretsApi');
    }

    /**
     * Get an instance of the Security API.
     * @returns {Promise<API.SecurityApi>} An instance of the Security API.
     */
    async atlasSecurityApi(): Promise<API.SecurityApi> {
        return await this.instantiateApi('SecurityApi');
    }

    /**
     * Get an instance of the Services API.
     * @returns {Promise<API.ServicesApi>} An instance of the Services API.
     */
    async atlasServicesApi(): Promise<API.ServicesApi> {
        return await this.instantiateApi('ServicesApi');
    }

    /**
     * Get an instance of the Sync API.
     * @returns {Promise<API.SyncApi>} An instance of the Sync API.
     */
    async atlasSyncApi(): Promise<API.SyncApi> {
        return await this.instantiateApi('SyncApi');
    }

    /**
     * Get an instance of the Triggers API.
     * @returns {Promise<API.TriggersApi>} An instance of the Triggers API.
     */
    async atlasTriggersApi(): Promise<API.TriggersApi> {
        return await this.instantiateApi('TriggersApi');
    }

    /**
     * Get an instance of the Users API.
     * @returns {Promise<API.UsersApi>} An instance of the Users API.
     */
    async atlasUsersApi(): Promise<API.UsersApi> {
        return await this.instantiateApi('UsersApi');
    }

    /**
     * Get an instance of the Values API.
     * @returns {Promise<API.ValuesApi>} An instance of the Values API.
     */
    async atlasValuesApi(): Promise<API.ValuesApi> {
        return await this.instantiateApi('ValuesApi');
    }

    /**
     * Get an instance of the Webhooks API.
     * @returns {Promise<API.WebhooksApi>} An instance of the Webhooks API.
     */
    async atlasWebhooksApi(): Promise<API.WebhooksApi> {
        return await this.instantiateApi('WebhooksApi');
    }

}

