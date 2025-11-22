import axios from "axios";

const api = axios.create({
    // baseURL: "http://127.0.0.1:8000",
    baseURL: process.env.REACT_APP_API_BASE_URL,
    withCredentials: true,
    headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
    },
});

// Attach CSRF token if cookie is present
api.interceptors.request.use((config) => {
    const csrfToken = getCookieValue("XSRF-TOKEN");
    if (csrfToken) {
        config.headers["X-XSRF-TOKEN"] = decodeURIComponent(csrfToken);
    }
    
    // Attach auth token from localStorage
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        config.headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    return config;
});

function getCookieValue(name) {
    const cookieString = document.cookie;
    const cookies = cookieString.split("; ");
    for (let cookie of cookies) {
        const [key, value] = cookie.split("=");
        if (key === name) return value;
    }
    return null;
}

export default api;
