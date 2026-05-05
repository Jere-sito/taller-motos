const API = {
  _handle401(_status) { return false; },
  _handle403(status) {
    if (status === 403) { App.toast('Sin permiso para esta acción', 'error'); return true; }
    return false;
  },

  async get(url) {
    const r = await fetch(url);
    if (this._handle401(r.status)) return;
    if (!r.ok) throw await r.json();
    return r.json();
  },

  async post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (this._handle401(r.status)) return;
    const data = await r.json();
    if (!r.ok) { const err = new Error(data.message || data.error || 'Error'); err.data = data; err.status = r.status; throw err; }
    return data;
  },

  async patch(url, body) {
    const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (this._handle401(r.status)) return;
    this._handle403(r.status);
    const data = await r.json();
    if (!r.ok) { const err = new Error(data.message || data.error || 'Error'); err.data = data; err.status = r.status; throw err; }
    return data;
  },

  async put(url, body) {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (this._handle401(r.status)) return;
    const data = await r.json();
    if (!r.ok) { const err = new Error(data.message || data.error || 'Error'); err.data = data; err.status = r.status; throw err; }
    return data;
  },

  async del(url) {
    const r = await fetch(url, { method: 'DELETE' });
    if (this._handle401(r.status)) return;
    const data = await r.json();
    if (!r.ok) { const err = new Error(data.message || data.error || 'Error'); err.data = data; err.status = r.status; throw err; }
    return data;
  },

  async postForm(url, formData) {
    const r = await fetch(url, { method: 'POST', body: formData });
    if (this._handle401(r.status)) return;
    const data = await r.json();
    if (!r.ok) { const err = new Error(data.message || data.error || 'Error'); err.data = data; err.status = r.status; throw err; }
    return data;
  }
};
