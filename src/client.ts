// atlas-app-services-client.ts

import { get } from 'http';
import * as API from '.';
import { AdminLoginRequest, Configuration, ConfigurationParameters } from '.';

export interface Logger {
    log: (message: string, ...optionalParams: any[]) => void;
    error: (message: string, ...optionalParams: any[]) => void;
    debug: (message: string, ...optionalParams: any[]) => void;
    // ... other log levels as needed
}

class NoOpLogger implements Logger {
    log(message: string, ...optionalParams: any[]): void {
        // Do nothing
    }
    error(message: string, ...optionalParams: any[]): void {
        // Do nothing
    }
    debug(message: string, ...optionalParams: any[]): void {
        // Do nothing
    }
}

class AppIdRetrievalError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AppIdRetrievalError';
    }
}

class UnauthorizedException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedException';
    }
}


export class AtlasAppServicesClient {
    private adminApi: API.AdminApi;
    private appsApi: API.AppsApi;
    public groupId: string;
    private appId: string;
    private clientAppId: string;
    private userId: string;
    private configParams: ConfigurationParameters;
    private accessToken: string;
    private refreshToken: string;
    private tokenExpiration: Date;
    private logger: Logger;
    private apis: { [key: string]: any } = {}; // Cache of instantiated APIs

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
        //this.logger.debug(`Config Params: ${JSON.stringify(this.configParams, null, 2)}`);
    }


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
                const errorMessage = 'Failed to retrieve appID from App Services Admin API.';
                console.error(errorMessage, JSON.stringify(appsResponse.data, null, 2));
                throw new AppIdRetrievalError(errorMessage);
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
        };
        // Assign the access tokens and refresh interval
        this.setAccessToken(loginResponse.data.access_token);
        this.refreshToken = loginResponse.data.refresh_token;
        this.userId = loginResponse.data.user_id;
        this.logger.log('Successfully completed login to Atlas App Services Admin API');
        return loginResponse;
    }

    /*** Token Management */

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
        // Attempt to refresh the access token with the refresh token
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

    // Getter method to access groupId
    public getGroupId(): string {
        return this.groupId;
    }

    // Getter method to access appId
    public getAppId(): string {
        return this.appId;
    }

    // Getter method to access userId
    public getUserId(): string {
        return this.userId;
    }

    // Getter method to access accessToken
    public getAccessToken(): string {
        return this.accessToken;
    }

    // Getter method to access refreshToken
    public getRefreshToken(): string {
        return this.refreshToken;
    }

    // Getter method to access tokenExpiration
    public getTokenExpiration(): Date {
        return this.tokenExpiration;
    }



    /*** Getters for the APIs */

    private async getApi(apiName: string): Promise<any> {
        await this.ensureValidAccessToken();

        // Always re-instantiate the API with the potentially updated configParams
        const ApiClass = (API as { [key: string]: any })[apiName];
        if (typeof ApiClass !== 'function') {
            throw new Error(`API ${apiName} does not exist`);
        }
        const apiInstance = new ApiClass(new API.Configuration(this.configParams));

        // Create a proxy around the API instance
        const handler: ProxyHandler<any> = {
            get: (target, propKey: string | symbol, _receiver) => {
                const origMethod = target[propKey as any];
                if (typeof origMethod === 'function') {
                    return async (...args: any[]) => {
                        this.logger.debug(`Calling ${apiName}.${String(propKey)} with arguments:`, args);
                        try {
                            const result = await origMethod.apply(target, args);
                            return result;
                        } catch (error) {
                            this.logger.error(`Error calling ${apiName}.${String(propKey)}:`, error);
                            throw error;
                        }
                    };
                } else {
                    return origMethod;
                }
            },
        };

        const proxy = new Proxy(apiInstance, handler);
        this.apis[apiName] = proxy;

        return proxy;
    }

    async atlasAdminApi(): Promise<API.AdminApi> {
        return await this.getApi('AdminApi');
    }

    async atlasApikeysApi(): Promise<API.ApikeysApi> {
        return await this.getApi('ApikeysApi');
    }

    async atlasAppsApi(): Promise<API.AppsApi> {
        return await this.getApi('AppsApi');
    }

    async atlasAuthprovidersApi(): Promise<API.AuthprovidersApi> {
        return await this.getApi('AuthprovidersApi');
    }

    async atlasBillingApi(): Promise<API.BillingApi> {
        return await this.getApi('BillingApi');
    }

    async atlasCustomUserDataApi(): Promise<API.CustomUserDataApi> {
        return await this.getApi('CustomUserDataApi');
    }

    async atlasDataApiApi(): Promise<API.DataApiApi> {
        return await this.getApi('DataApiApi');
    }

    async atlasDependenciesApi(): Promise<API.DependenciesApi> {
        return await this.getApi('DependenciesApi');
    }

    async atlasDeployApi(): Promise<API.DeployApi> {
        return await this.getApi('DeployApi');
    }

    async atlasEmailApi(): Promise<API.EmailApi> {
        return await this.getApi('EmailApi');
    }

    async atlasEndpointsApi(): Promise<API.EndpointsApi> {
        return await this.getApi('EndpointsApi');
    }

    async atlasEnvironmentsApi(): Promise<API.EnvironmentsApi> {
        return await this.getApi('EnvironmentsApi');
    }

    async atlasEventSubscriptionsApi(): Promise<API.EventSubscriptionsApi> {
        return await this.getApi('EventSubscriptionsApi');
    }

    async atlasFunctionsApi(): Promise<API.FunctionsApi> {
        return await this.getApi('FunctionsApi');
    }

    async atlasGraphqlApi(): Promise<API.GraphqlApi> {
        return await this.getApi('GraphqlApi');
    }

    async atlasHostingApi(): Promise<API.HostingApi> {
        return await this.getApi('HostingApi');
    }

    async atlasLogForwardersApi(): Promise<API.LogForwardersApi> {
        return await this.getApi('LogForwardersApi');
    }

    async atlasLogsApi(): Promise<API.LogsApi> {
        return await this.getApi('LogsApi');
    }

    async atlasMetricsApi(): Promise<API.MetricsApi> {
        return await this.getApi('MetricsApi');
    }

    async atlasNotificationsApi(): Promise<API.NotificationsApi> {
        return await this.getApi('NotificationsApi');
    }

    async atlasRulesApi(): Promise<API.RulesApi> {
        return await this.getApi('RulesApi');
    }

    async atlasSchemasApi(): Promise<API.SchemasApi> {
        return await this.getApi('SchemasApi');
    }

    async atlasSecretsApi(): Promise<API.SecretsApi> {
        return await this.getApi('SecretsApi');
    }

    async atlasSecurityApi(): Promise<API.SecurityApi> {
        return await this.getApi('SecurityApi');
    }

    async atlasServicesApi(): Promise<API.ServicesApi> {
        return await this.getApi('ServicesApi');
    }

    async atlasSyncApi(): Promise<API.SyncApi> {
        return await this.getApi('SyncApi');
    }

    async atlasTriggersApi(): Promise<API.TriggersApi> {
        return await this.getApi('TriggersApi');
    }

    async atlasUsersApi(): Promise<API.UsersApi> {
        return await this.getApi('UsersApi');
    }

    async atlasValuesApi(): Promise<API.ValuesApi> {
        return await this.getApi('ValuesApi');
    }

    async atlasWebhooksApi(): Promise<API.WebhooksApi> {
        return await this.getApi('WebhooksApi');
    }

}

export const getClient = (config: {
    publicKey: string,
    privateKey: string,
    baseUrl: string,
    groupId: string,
}): AtlasAppServicesClient => {
    const client = new AtlasAppServicesClient(config);
    return client;
};
