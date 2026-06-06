import axios from 'axios';

const PRODUCTION_API_ORIGIN = 'https://cuuhohatinh.onrender.com';

function getApiBaseURL() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const { protocol, hostname, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isRenderBackend = hostname === 'cuuhohatinh.onrender.com';

  if (isLocal || isRenderBackend) {
    return '';
  }

  if (protocol === 'https:') {
    return PRODUCTION_API_ORIGIN;
  }

  return origin;
}

axios.defaults.baseURL = getApiBaseURL();
axios.defaults.timeout = 15000;

const savedToken = localStorage.getItem('authToken');
if (savedToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

axios.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    const isApiRequest = typeof config?.url === 'string' && config.url.startsWith('/api/');
    const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const canRetry = isApiRequest && !isLocal && !error.response && !config.__renderFallbackRetried;

    if (canRetry) {
      config.__renderFallbackRetried = true;
      config.baseURL = PRODUCTION_API_ORIGIN;
      return axios(config);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentProfile');
      delete axios.defaults.headers.common.Authorization;
    }

    return Promise.reject(error);
  }
);

export { PRODUCTION_API_ORIGIN };
