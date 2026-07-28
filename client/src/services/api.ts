import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Crucial for sending/receiving HTTP-only cookies (refresh tokens)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add access token from memory if needed
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s and token refresh automatically
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh token using HTTP-only refresh cookie
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        
        const newAccessToken = res.data.accessToken;
        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, user is completely logged out. Clear local token.
        localStorage.removeItem('accessToken');
        // Dispatch custom event to trigger logout in UI
        window.dispatchEvent(new Event('auth:unauthorized'));
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
