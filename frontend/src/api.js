import axios from "axios";

// Railway Production URLs
const BASE_DOMAIN = "yogs-production.up.railway.app";

export const WS_URL = `wss://${BASE_DOMAIN}/ws/yoga`;
export const REST_URL = `https://${BASE_DOMAIN}/poses`;

// Create an Axios instance for cleaner calls
const api = axios.create({
  baseURL: `https://${BASE_DOMAIN}`,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;