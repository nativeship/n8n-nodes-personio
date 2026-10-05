"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonioApi = void 0;
class PersonioApi {
    constructor() {
        this.name = "personioApi";
        this.displayName = "Personio API";
        this.documentationUrl = "https://api.personio.de/v2";
        this.icon = {
            light: "file:../nodes/Personio/personio.svg",
            dark: "file:../nodes/Personio/personio.dark.svg"
        };
        this.properties = [
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
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://api.personio.de/v2",
                url: "/absence-periods"
            }
        };
    }
}
exports.PersonioApi = PersonioApi;
//# sourceMappingURL=PersonioApi.credentials.js.map