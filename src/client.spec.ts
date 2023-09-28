import { AtlasAppServicesClient, Logger, AdminApi, AppsApi } from './';
import dotenv from 'dotenv';
dotenv.config();

class ConsoleLogger implements Logger {
  log(message: string, ...optionalParams: any[]): void {
    console.log(`**** ConsoleLogger-LOG: ${message}`, ...optionalParams);
  }
  error(message: string, ...optionalParams: any[]): void {
    console.error(`**** ConsoleLogger-ERROR: ${message}`, ...optionalParams);
  }
  debug(message: string, ...optionalParams: any[]): void {
    console.debug(`**** ConsoleLogger-DEBUG: ${message}`, ...optionalParams);
  }
}

const logger = new ConsoleLogger();

describe('AtlasAppServicesClient', () => {
  let client: AtlasAppServicesClient;

  beforeEach(() => {
    // Create instances of the mocked classes
    const config = {
      publicKey: process.env.ATLAS_APP_SERVICES_PUBLIC_KEY,
      privateKey: process.env.ATLAS_APP_SERVICES_PRIVATE_KEY,
      baseUrl: process.env.ATLAS_APP_SERVICES_BASE_URL,
      groupId: process.env.ATLAS_APP_SERVICES_GROUP_ID,
    };
    client = new AtlasAppServicesClient(config, logger);
  });


  it('instance should be an instanceof AtlasAppServicesClient', () => {
    expect(client instanceof AtlasAppServicesClient).toBeTruthy();
  });

  it('should have a method initialize', () => {
    expect(client.initialize).toBeDefined();
  });

  describe('constructor', () => {
    it('should create an instance of the client', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(AtlasAppServicesClient);
    });
  });


  describe('call AppsApi and get valid result', () => {
    it('should initialize the client successfully', async () => {
      const client_app_id_Result = process.env.ATLAS_APP_SERVICES_APP_ID;

      await client.initialize();
      const atlasAppsApi = await client.atlasAppsApi()
      const appsArray = await atlasAppsApi.adminListApplications(client.groupId, "atlas");

      expect(appsArray).toBeDefined();
      expect(appsArray.data).toBeDefined();
      expect(appsArray.data[0].client_app_id).toBe(client_app_id_Result);
    }, 10000);

  });

});