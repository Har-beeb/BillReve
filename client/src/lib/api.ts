import axios from "axios";

// Create a central Axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1", // Adjust to your backend port!
  withCredentials: true, // CRITICAL: This allows the frontend to send/receive the secure Refresh Token cookie
});

// A variable to hold our access token in memory
let currentAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

// -------------------------------------------------------------
// REQUEST INTERCEPTOR: Attach the token to every outgoing request
// -------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    if (currentAccessToken) {
      config.headers.Authorization = `Bearer ${currentAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// -------------------------------------------------------------
// RESPONSE INTERCEPTOR: Handle expired tokens silently
// -------------------------------------------------------------
api.interceptors.response.use(
  (response) => response, // If the request succeeds, just return it
  async (error) => {
    const originalRequest = error.config;

    // If the error is a 401 (Unauthorized) and we haven't already tried to retry it
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark as retried to prevent infinite loops

      try {
        // Attempt to hit the refresh endpoint we just built on the backend
        const refreshResponse = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newAccessToken = refreshResponse.data.data.accessToken;

        // Update our memory token
        setAccessToken(newAccessToken);

        // Update the failed request with the new token and fire it again
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // If the refresh token is also expired/invalid, the user is truly logged out.
        setAccessToken(null);
        // Here you would typically trigger a redirect to the /login page
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // If it's any other error (like a 400 Bad Request or 404), just pass it along
    return Promise.reject(error);
  },
);
