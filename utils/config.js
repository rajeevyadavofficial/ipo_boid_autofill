import { getBackendUrl } from './remoteConfig';

// Export as a function so it always pulls the latest value
export const getApiBaseUrl = () => {
    return getBackendUrl();
};

// Kept for backward compatibility if needed, but prefer the function
export const API_BASE_URL = getBackendUrl();
