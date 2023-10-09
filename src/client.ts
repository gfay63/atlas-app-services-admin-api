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
    public appId: string;
    public clientAppId: string;
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


    /*** Getters for the APIs */

    private async instantiateApi(apiName: string): Promise<any> {
        await this.ensureValidAccessToken();
        const ApiClass = (API as { [key: string]: any })[apiName];
        if (typeof ApiClass !== 'function') {
            throw new Error(`API ${apiName} does not exist`);
        }
        return new ApiClass(new API.Configuration(this.configParams));
    }

    async atlasAdminApi(): Promise<API.AdminApi> {
        const apiName = 'AdminApi';
        return await this.instantiateApi(apiName);
    }

    async atlasApikeysApi(): Promise<API.ApikeysApi> {
        const apiName = 'ApikeysApi';
        return await this.instantiateApi(apiName);
    }

    async atlasAppsApi(): Promise<API.AppsApi> {
        const apiName = 'AppsApi';
        return await this.instantiateApi(apiName);
        //const proxy = this.createApiProxy(apiInstance, apiName);
        //this.apis[apiName] = proxy;
        //return proxy;
    }

    async atlasAuthprovidersApi(): Promise<API.AuthprovidersApi> {
        const apiName = 'AuthprovidersApi';
        return await this.instantiateApi(apiName);
    }

    async atlasBillingApi(): Promise<API.BillingApi> {
        const apiName = 'BillingApi';
        return await this.instantiateApi(apiName);
    }

    async atlasCustomUserDataApi(): Promise<API.CustomUserDataApi> {
        const apiName = 'CustomUserDataApi';
        return await this.instantiateApi(apiName);
    }

    async atlasDataApiApi(): Promise<API.DataApiApi> {
        const apiName = 'DataApiApi';
        return await this.instantiateApi(apiName);
    }

    async atlasDependenciesApi(): Promise<API.DependenciesApi> {
        const apiName = 'DependenciesApi';
        return await this.instantiateApi(apiName);
    }

    async atlasDeployApi(): Promise<API.DeployApi> {
        const apiName = 'DeployApi';
        return await this.instantiateApi(apiName);
    }

    async atlasEmailApi(): Promise<API.EmailApi> {
        const apiName = 'EmailApi';
        return await this.instantiateApi(apiName);
    }

    async atlasEndpointsApi(): Promise<API.EndpointsApi> {
        const apiName = 'EndpointsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasEnvironmentsApi(): Promise<API.EnvironmentsApi> {
        const apiName = 'EnvironmentsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasEventSubscriptionsApi(): Promise<API.EventSubscriptionsApi> {
        const apiName = 'EventSubscriptionsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasFunctionsApi(): Promise<API.FunctionsApi> {
        const apiName = 'FunctionsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasGraphqlApi(): Promise<API.GraphqlApi> {
        const apiName = 'GraphqlApi';
        return await this.instantiateApi(apiName);
    }

    async atlasHostingApi(): Promise<API.HostingApi> {
        const apiName = 'HostingApi';
        return await this.instantiateApi(apiName);
    }

    async atlasLogForwardersApi(): Promise<API.LogForwardersApi> {
        const apiName = 'LogForwardersApi';
        return await this.instantiateApi(apiName);
    }

    async atlasLogsApi(): Promise<API.LogsApi> {
        const apiName = 'LogsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasMetricsApi(): Promise<API.MetricsApi> {
        const apiName = 'MetricsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasNotificationsApi(): Promise<API.NotificationsApi> {
        const apiName = 'NotificationsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasRulesApi(): Promise<API.RulesApi> {
        const apiName = 'RulesApi';
        return await this.instantiateApi(apiName);
    }

    async atlasSchemasApi(): Promise<API.SchemasApi> {
        const apiName = 'SchemasApi';
        return await this.instantiateApi(apiName);
    }

    async atlasSecretsApi(): Promise<API.SecretsApi> {
        const apiName = 'SecretsApi';
        return await this.instantiateApi(apiName);
    }

    async atlasSecurityApi(): Promise<API.SecurityApi> {
        const apiName = 'SecurityApi';
        return await this.instantiateApi(apiName);
    }

    async atlasServicesApi(): Promise<API.ServicesApi> {
        const apiName = 'ServicesApi';
        return await this.instantiateApi(apiName);
    }

    async atlasSyncApi(): Promise<API.SyncApi> {
        const apiName = 'SyncApi';
        return await this.instantiateApi(apiName);
    }

    async atlasTriggersApi(): Promise<API.TriggersApi> {
        const apiName = 'TriggersApi';
        return await this.instantiateApi(apiName);
    }

    async atlasUsersApi(): Promise<API.UsersApi> {
        const apiName = 'UsersApi';
        return await this.instantiateApi(apiName);
    }

    async atlasValuesApi(): Promise<API.ValuesApi> {
        const apiName = 'ValuesApi';
        return await this.instantiateApi(apiName);
    }

    async atlasWebhooksApi(): Promise<API.WebhooksApi> {
        const apiName = 'WebhooksApi';
        return await this.instantiateApi(apiName);
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
