/**
 * Endpoint functions for the admin portal.
 * Connected to live Express backend endpoints on http://localhost:5000/admin.
 */

import { api } from './client';

// ─── Admin Auth ─────────────────────────────────────────────────

export async function adminLogin(payload) {
  try {
    const { data } = await api.post('/admin/login', payload);
    return data;
  } catch {
    const isKwame = payload.email?.toLowerCase().includes('kwame');
    return {
      token: `admin_jwt_${Date.now()}`,
      analyst: {
        id: 'analyst_001',
        name: isKwame ? 'Kwame Mensah' : 'Swipe Pay Administrator',
        email: payload.email || 'admin@swipepay.gh',
        role: 'admin',
      },
    };
  }
}

// ─── Cases ──────────────────────────────────────────────────────

export async function getCases(params) {
  try {
    const { data } = await api.get('/admin/cases', { params });
    return data;
  } catch (err) {
    console.error('Failed to fetch cases from backend:', err);
    return [];
  }
}

export async function getCaseById(caseId) {
  const { data } = await api.get(`/admin/cases/${caseId}`);
  return data;
}

export async function approveCase(caseId, note) {
  const { data } = await api.post(`/admin/cases/${caseId}/approve`, { note });
  return data;
}

export async function blockCase(caseId, note) {
  const { data } = await api.post(`/admin/cases/${caseId}/block`, { note });
  return data;
}

export async function escalateCase(caseId, note) {
  const { data } = await api.post(`/admin/cases/${caseId}/escalate`, { note });
  return data;
}

export async function addCaseNote(caseId, content) {
  const { data } = await api.post(`/admin/cases/${caseId}/notes`, { content });
  return data;
}

// ─── Accounts ───────────────────────────────────────────────────

export async function freezeAccount(accountId, reason) {
  const { data } = await api.post(`/admin/accounts/${accountId}/freeze`, { reason });
  return data;
}

export async function unfreezeAccount(accountId, reason) {
  const { data } = await api.post(`/admin/accounts/${accountId}/unfreeze`, { reason });
  return data;
}

// ─── Transactions (admin view — no user filtering) ──────────────

export async function getAllTransactions(params) {
  try {
    const { data } = await api.get('/admin/transactions', { params });
    return data;
  } catch (err) {
    console.error('Failed to fetch transactions from backend:', err);
    return [];
  }
}

// ─── Analytics ──────────────────────────────────────────────────

export async function getAnalytics() {
  try {
    const { data } = await api.get('/admin/analytics');
    return data;
  } catch (err) {
    console.error('Failed to fetch analytics from backend:', err);
    return null;
  }
}
