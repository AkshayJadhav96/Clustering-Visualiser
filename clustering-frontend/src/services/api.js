import axios from 'axios';

/** Same-origin `/api` in dev (see vite proxy); override with VITE_API_BASE if needed. */
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/cluster';

function apiErrorMessage(err) {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error;
    if (typeof msg === 'string') return msg;
    if (err.response?.status) return `Request failed (${err.response.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Unexpected error';
}

export const clusterApi = {
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err) };
    }
  },

  run: async (payload) => {
    try {
      const { data } = await axios.post(`${API_BASE}/run`, payload);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: apiErrorMessage(err) };
    }
  },
};
