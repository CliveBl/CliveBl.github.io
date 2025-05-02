const ENV = {
    development: {
        API_BASE_URL: "https://localhost:443/api/v1",
        AUTH_BASE_URL: "https://localhost:443/auth",
    },
    production: {
        API_BASE_URL: "https://srv.taxesil.top:443/api/v1",
        AUTH_BASE_URL: "https://srv.taxesil.top:443/auth",
    },
};
let currentEnv = "production";
const domain = window.location.hostname;
console.log("Domain:", domain);
if (domain.includes("localhost") || domain.includes("127.0.0.1")) {
    currentEnv = "development";
}
// Get environment from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const envParam = urlParams.get("env");
currentEnv = envParam || "production";
console.log("Current environment:", currentEnv);
export const API_BASE_URL = ENV[currentEnv].API_BASE_URL;
export const AUTH_BASE_URL = ENV[currentEnv].AUTH_BASE_URL;
//# sourceMappingURL=env.js.map