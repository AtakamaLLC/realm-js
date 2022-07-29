////////////////////////////////////////////////////////////////////////////
//
// Copyright 2020 Realm Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
////////////////////////////////////////////////////////////////////////////
import { App, BSON } from "realm";

import { fetch } from "./fetch";

import { AppImporter, Credentials } from "realm-app-importer";

export type TemplateReplacements = Record<string, Record<string, unknown>>;
export type ErrorResponse = { message: string; appId: never };
export type ImportResponse = { appId: string; message: never };
export type Response = ImportResponse | ErrorResponse;

function getUrls() {
  // Try reading the app importer URL out of the environment, it might not be accessiable via localhost
  const { appImporterUrl, realmBaseUrl } = environment;
  return {
    appImporterUrl: typeof appImporterUrl === "string" ? appImporterUrl : "http://localhost:8091",
    baseUrl: typeof realmBaseUrl === "string" ? realmBaseUrl : "http://localhost:9090",
  };
}

function getCredentials(): Credentials {
  const { publicKey, privateKey, username, password } = environment;
  if (typeof publicKey === "string" && typeof privateKey === "string") {
    return {
      kind: "api-key",
      publicKey,
      privateKey,
    };
  }
  return {
    kind: "username-password",
    username: typeof username === "string" ? username : "unique_user@domain.com",
    password: typeof password === "string" ? password : "password",
  };
}

export function getDefaultReplacements(name: string): TemplateReplacements {
  // When running on CI we connect through mongodb-atlas instead of local-mongodb
  const { mongodbClusterName } = environment;
  if (typeof mongodbClusterName === "string") {
    if (name === "with-db") {
      return {
        "services/mongodb/config.json": {
          type: "mongodb-atlas",
          config: {
            clusterName: mongodbClusterName,
            readPreference: "primary",
            wireProtocolEnabled: false,
            sync: {
              database_name: `test-database-${new BSON.ObjectID().toHexString()}`,
            },
          },
        },
      };
    } else if (name === "with-db-flx") {
      return {
        "services/mongodb/config.json": {
          type: "mongodb-atlas",
          config: {
            clusterName: mongodbClusterName,
            readPreference: "primary",
            wireProtocolEnabled: false,
            flexible_sync: {
              database_name: `test-database-${new BSON.ObjectID().toHexString()}`,
            },
          },
        },
      };
    }
  }
  return {};
}

export async function importApp(
  name: string,
  replacements: TemplateReplacements = getDefaultReplacements(name),
): Promise<App> {
  const { baseUrl } = getUrls();
  const appsDirectoryPath = "./realm-apps";
  const realmConfigPath = "./realm-config";

  const credentials = getCredentials();
  console.log(`Importing into "${baseUrl}" (using ${credentials.kind} credentials)`);
  const importer = new AppImporter({
    baseUrl,
    credentials,
    realmConfigPath,
    appsDirectoryPath,
    cleanUp: true,
  });

  const appTemplatePath = `../../realm-apps/${name}`;

  const { appId } = await importer.importApp(appTemplatePath, replacements);

  return new App({ baseUrl, id: appId });
  // const response = await fetch(appImporterUrl, {
  //   method: "POST",
  //   body: JSON.stringify({ name, replacements }),
  // });
  // const json = await response.json<Response>();
  // if (response.ok && typeof json.appId === "string") {
  //   return new App({ baseUrl, id: json.appId });
  // } else if (typeof json.message === "string") {
  //   throw new Error(`Failed to import: ${json.message}`);
  // } else {
  //   throw new Error("Failed to import app");
  // }
}

export async function deleteApp(clientAppId: string): Promise<void> {
  const { appImporterUrl } = getUrls();

  // This might take some time, so we just send it and forget it
  fetch(`${appImporterUrl}/app/${clientAppId}`, {
    method: "DELETE",
  });
}
