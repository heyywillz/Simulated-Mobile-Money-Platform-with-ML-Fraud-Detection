/**
 * API client for the hosted Express backend.
 * Base URL: https://machine-learning-server-3.onrender.com
 */

import axios from 'axios';

function resolveBaseUrl() {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch {}
  return 'http://localhost:5000';
}

const EXPRESS_BASE_URL = resolveBaseUrl();

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('momo_token', token);
    } else {
      localStorage.removeItem('momo_token');
    }
  }
}

export function getAuthToken() {
  if (authToken) return authToken;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('momo_token');
  }
  return null;
}

/**
 * Create an Axios client pointed at the Express backend.
 */
export function createApiClient(baseURL) {
  const client = axios.create({
    baseURL: baseURL ?? EXPRESS_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['jwt'] = token;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        setAuthToken(null);
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('momo:session_expired'));
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/** Axios instance for the Express backend */
export const api = createApiClient(EXPRESS_BASE_URL);

export function setApiBaseUrl(url) {
  api.defaults.baseURL = url;
}
