import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class PersonioApi implements ICredentialType {
  name = "personioApi";
  displayName = "Personio API";
  documentationUrl = "https://api.personio.de/v2";
  icon: Icon = {
        light: "file:../nodes/Personio/personio.svg",
        dark: "file:../nodes/Personio/personio.dark.svg"
    };
  properties: INodeProperties[] = [
        {
            displayName: "Access Token",
            name: "secret",
            type: "string",
            typeOptions: {
                password: true
            },
            default: "",
            required: true
        }
    ];
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                Authorization: "=Bearer {{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://api.personio.de/v2",
            url: "/absence-periods"
        }
    };
}
