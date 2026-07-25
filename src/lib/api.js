// Central API base URL
// - In dev:  VITE_API_BASE_URL is undefined → empty string → Vite proxy handles /api → localhost:3001
// - In prod: VITE_API_BASE_URL=https://your-app.railway.app → absolute URLs cross-domain

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
