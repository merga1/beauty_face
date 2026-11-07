import { useCallback, useEffect, useMemo, useState } from 'react';
import './admin.css';

// All admin API calls go to the same backend origin.
// In production (separate Render services), set VITE_API_BASE to the backend URL.
const API = import.meta.env.VITE_API_BASE ?? '';

const menu = [
  ['overview', 'Overview', '⌂'], ['products', 'Products', '▦'], ['orders', 'Orders & payments', '▣'],
  ['customers', 'Customers', '♙'], ['sellers', 'Sellers', '◈'], ['doctors', 'Clinicians', '✚'],
  ['riders', 'Delivery riders', '⌖'], ['consultation-requests', 'Callback requests', '◷'],
  ['safety-reports', 'Safety reports', '⚑'], ['articles', 'Website content', '▤'],
  ['administrators', 'Administrators', '♜'], ['settings', 'Site settings', '⚙'], ['audit', 'Audit log', '≋'],
];

const titles = Object.fromEntries(menu.map(([key, label]) => [key, label]));
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const amount = (cents) => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(Number(cents || 0) / 100);
const singular = { products: 'product', sellers: 'seller', doctors: 'doctor', riders: 'rider', articles: 'article', administrators: 'administrator' };

function getFields(type, item, sellers = []) {
  if (type === 'products') return [
    { key: 'name', label: 'Product name', required: true }, { key: 'slug', label: 'URL slug', required: true, hint: 'Lowercase words joined by hyphens.' },
    { key: 'brand', label: 'Brand', required: true }, { key: 'category', label: 'Category', required: true },
    { key: 'description', label: 'Description', type: 'textarea', required: true },
    { key: 'priceEtb', label: 'Price (ETB)', type: 'number', min: '0', step: '0.01', required: true },
    { key: 'stockCount', label: 'Stock count', type: 'number', min: '0', step: '1', required: true },
    { key: 'sellerId', label: 'Seller', type: 'select', options: [['', 'No seller assigned'], ...sellers.map((seller) => [seller.id, seller.display_name])] },
    { key: 'skinTypes', label: 'Skin types', hint: 'Comma-separated.' }, { key: 'concerns', label: 'Concerns', hint: 'Comma-separated.' },
    { key: 'ingredients', label: 'Ingredients', type: 'textarea', hint: 'Comma-separated; preserve label wording.' },
    { key: 'howToUse', label: 'How to use', type: 'textarea' }, { key: 'warnings', label: 'Warnings', type: 'textarea', hint: 'Comma-separated.' },
    { key: 'expiryInformation', label: 'Lot and expiry information', type: 'textarea' },
    { key: 'supplierVerification', label: 'Supplier verification', type: 'select', options: [['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected']] },
    { key: 'sampleListing', label: 'Sample listing (demo only)', type: 'checkbox' }, { key: 'published', label: 'Published to storefront', type: 'checkbox' },
  ];
  if (type === 'sellers') return [
    { key: 'displayName', label: 'Seller name', required: true },
    { key: 'verificationStatus', label: 'Verification status', type: 'select', options: [['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['suspended', 'Suspended']] },
  ];
  if (type === 'doctors') return [
    { key: 'displayName', label: 'Clinician name', required: true },
    { key: 'licenseNumber', label: 'License number', hint: item ? 'Leave blank to keep the stored value.' : 'Encrypted before storage.', required: !item },
    { key: 'specialties', label: 'Specialties', hint: 'Comma-separated.' }, { key: 'languages', label: 'Languages', hint: 'Comma-separated.' },
    { key: 'licenseStatus', label: 'License status', type: 'select', options: [['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['suspended', 'Suspended']] },
  ];
  if (type === 'riders') return [
    { key: 'displayName', label: 'Rider name', required: true }, { key: 'phone', label: 'Phone number', type: 'tel', required: true },
    { key: 'vehicleType', label: 'Vehicle type', required: true },
    { key: 'status', label: 'Status', type: 'select', options: [['pending', 'Pending'], ['active', 'Active'], ['suspended', 'Suspended']] },
  ];
  if (type === 'articles') return [
    { key: 'title', label: 'Title', required: true }, { key: 'slug', label: 'URL slug', required: true },
    { key: 'excerpt', label: 'Short description', type: 'textarea' }, { key: 'body', label: 'Article body', type: 'textarea', required: false },
    { key: 'language', label: 'Language', type: 'select', options: [['en', 'English'], ['am', 'Amharic'], ['om', 'Afaan Oromoo'], ['ti', 'Tigrinya']] },
    { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']] },
  ];
  if (type === 'administrators') return [
    { key: 'fullName', label: 'Full name', required: true }, { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'password', label: 'Temporary password', type: 'password', required: true, hint: 'At least 14 characters. Share it securely and ask the new admin to change it after sign-in.' },
  ];
  return [];
}

function toInitial(type, item) {
  if (!item) {
    if (type === 'products') return { category: 'Skincare', supplierVerification: 'pending', skinTypes: '', concerns: '', ingredients: '', warnings: '', stockCount: 0, priceEtb: 0, expiryInformation: 'Expiry details not provided.' };
    if (type === 'sellers') return { verificationStatus: 'pending' };
    if (type === 'doctors') return { licenseStatus: 'pending', specialties: '', languages: 'English' };
    if (type === 'riders') return { vehicleType: 'motorcycle', status: 'pending' };
    if (type === 'articles') return { language: 'en', status: 'draft' };
    return {};
  }
  if (type === 'products') return {
    ...item, skinTypes: (item.skin_types || []).join(', '), concerns: (item.concerns || []).join(', '),
    ingredients: (item.ingredients || []).join(', '), warnings: (item.warnings || []).join(', '),
    howToUse: item.how_to_use, expiryInformation: item.expiry_information,
    supplierVerification: item.supplier_verification, sampleListing: item.sample_listing,
    published: item.published, stockCount: item.stock_count,
  };
  if (type === 'sellers') return { displayName: item.display_name, verificationStatus: item.verification_status };
  if (type === 'doctors') return { displayName: item.display_name, licenseStatus: item.license_status, specialties: (item.specialties || []).join(', '), languages: (item.languages || []).join(', ') };
  if (type === 'riders') return { displayName: item.displayName, phone: item.phone, vehicleType: item.vehicleType, status: item.status };
  if (type === 'articles') return { title: item.title, slug: item.slug, excerpt: item.excerpt, body: item.body, language: item.language, status: item.status };
  return item;
}

function RecordEditor({ type, item, sellers, onSave, onClose }) {
  const fields = getFields(type, item, sellers);
  const [form, setForm] = useState(() => toInitial(type, item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(form); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return <div className="admin-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <header className="admin-modal-head"><div><span className="admin-kicker">{item ? 'UPDATE RECORD' : 'NEW RECORD'}</span><h2 id="editor-title">{item ? 'Edit' : 'Add'} {singular[type]}</h2></div><button className="admin-icon-button" onClick={onClose} aria-label="Close">×</button></header>
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-form-grid">{fields.map((field) => <label key={field.key} className={`admin-field ${field.type === 'textarea' ? 'field-wide' : ''} ${field.type === 'checkbox' ? 'field-checkbox' : ''}`}>
          {field.type === 'checkbox' ? <><input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => update(field.key, event.target.checked)} /><span>{field.label}</span></> : <>
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.type === 'textarea' ? <textarea rows="4" value={form[field.key] ?? ''} onChange={(event) => update(field.key, event.target.value)} required={field.required !== false} /> : field.type === 'select' ?
              <select value={form[field.key] ?? field.options[0][0]} onChange={(event) => update(field.key, event.target.value)}>{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> :
              <input type={field.type || 'text'} min={field.min} step={field.step} value={form[field.key] ?? ''} onChange={(event) => update(field.key, event.target.value)} required={field.required !== false} />}
            {field.hint && <small>{field.hint}</small>}
          </>}
        </label>)}</div>
        {error && <div className="admin-form-error" role="alert">{error}</div>}
        <footer className="admin-modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Cancel</button><button className="admin-button primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
      </form>
    </section>
  </div>;
}

function PasswordEditor({ onSave, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (event) => setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (form.newPassword !== form.confirmPassword) return setError('The new passwords do not match.');
    setBusy(true);
    try { await onSave({ currentPassword: form.currentPassword, newPassword: form.newPassword }); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return <div className="admin-modal-backdrop"><section className="admin-modal small-modal" role="dialog" aria-modal="true">
    <header className="admin-modal-head"><div><span className="admin-kicker">ACCOUNT SECURITY</span><h2>Change password</h2></div><button className="admin-icon-button" onClick={onClose} aria-label="Close">×</button></header>
    <form className="admin-form" onSubmit={submit}><label className="admin-field"><span>Current password</span><input type="password" name="currentPassword" autoComplete="current-password" value={form.currentPassword} onChange={change} required /></label>
      <label className="admin-field"><span>New password</span><input type="password" name="newPassword" autoComplete="new-password" minLength="14" value={form.newPassword} onChange={change} required /><small>Use at least 14 characters.</small></label>
      <label className="admin-field"><span>Confirm new password</span><input type="password" name="confirmPassword" autoComplete="new-password" minLength="14" value={form.confirmPassword} onChange={change} required /></label>
      {error && <div className="admin-form-error">{error}</div>}<footer className="admin-modal-actions"><button type="button" className="admin-button secondary" onClick={onClose}>Cancel</button><button className="admin-button primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></footer>
    </form>
  </section></div>;
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onLogin(email, password); }
    catch (loginError) { setError(loginError.message); }
    finally { setBusy(false); }
  };
  return <main className="admin-login-page"><div className="admin-login-card"><div className="admin-logo"><span className="admin-logo-mark">b</span><span>beauty<span>face</span></span></div><span className="admin-kicker">SITE ADMINISTRATION</span><h1>Welcome back</h1><p>Sign in to manage the Beauty Face platform.</p>
    <form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <div className="admin-form-error" role="alert">{error}</div>}<button className="admin-button primary login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span>→</span></button></form>
    <small>Admin accounts are created by an existing administrator or the server bootstrap command.</small>
  </div></main>;
}

function MetricCard({ label, value, note, accent = '' }) {
  return <article className={`metric-card ${accent}`}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong><small>{note}</small></article>;
}

function StatusPill({ children }) {
  const key = String(children || 'unknown').toLowerCase().replaceAll('_', '-');
  return <span className={`status-pill status-${key}`}>{String(children || 'unknown').replaceAll('_', ' ')}</span>;
}

export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState('overview');
  const [data, setData] = useState({});
  const [doctors, setDoctors] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) headers['X-CSRF-Token'] = csrfToken;
    const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  }, [csrfToken]);

  useEffect(() => {
    fetch(`${API}/api/admin/auth/session`, { credentials: 'include' })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then((result) => { setAdmin(result.admin); setCsrfToken(result.csrfToken); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const loadSection = useCallback(async (target = section) => {
    if (!admin) return;
    setLoading(true); setPageError('');
    try {
      const result = await request(`/api/admin/${target}`);
      setData((current) => ({ ...current, [target]: result }));
      if (target === 'doctors') setDoctors(result.doctors || []);
      if (target === 'sellers') setSellers(result.sellers || []);
      if (target === 'products') {
        const sellerResult = await request('/api/admin/sellers');
        setSellers(sellerResult.sellers || []);
      }
      if (target === 'consultation-requests') {
        const doctorsResult = await request('/api/admin/doctors');
        setDoctors(doctorsResult.doctors || []);
      }
      if (target === 'riders') setRiders(result.riders || []);
      if (target === 'orders') {
        const ridersResult = await request('/api/admin/riders');
        setRiders(ridersResult.riders || []);
      }
    } catch (error) { setPageError(error.message); }
    finally { setLoading(false); }
  }, [admin, request, section]);

  useEffect(() => { if (admin) loadSection(section); }, [admin, section, loadSection]);

  const listKey = { products: 'products', sellers: 'sellers', doctors: 'doctors', riders: 'riders', 'safety-reports': 'reports', 'consultation-requests': 'requests', orders: 'orders', customers: 'customers', articles: 'articles', administrators: 'administrators', audit: 'events' }[section];
  const rows = data[section]?.[listKey] || [];
  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(value));
  }, [query, rows]);

  const login = async (email, password) => {
    const response = await fetch(`${API}/api/admin/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign-in failed.');
    setAdmin(result.admin); setCsrfToken(result.csrfToken);
  };

  const logout = async () => {
    try { await request('/api/admin/auth/logout', { method: 'POST', body: '{}' }); }
    finally { setAdmin(null); setCsrfToken(''); setData({}); }
  };

  const refresh = async () => {
    await loadSection(section);
    if (section !== 'overview') {
      try { const result = await request('/api/admin/overview'); setData((current) => ({ ...current, overview: result })); } catch { /* the active view already shows request errors */ }
    }
  };

  const saveRecord = async (form) => {
    const type = modal.type;
    const isEdit = Boolean(modal.item);
    const endpoint = type === 'administrators' ? '/api/admin/administrators' : `/api/admin/${type}`;
    const method = isEdit ? 'PATCH' : 'POST';
    const path = isEdit ? `${endpoint}/${modal.item.id}` : endpoint;
    const body = type === 'products' ? { ...form, priceEtb: Number(form.priceEtb), stockCount: Number(form.stockCount) }
      : type === 'sellers' ? { displayName: form.displayName, verificationStatus: form.verificationStatus }
        : type === 'doctors' ? { ...form }
          : type === 'riders' ? { ...form }
          : type === 'articles' ? { ...form }
            : form;
    await request(path, { method, body: JSON.stringify(body) });
    setModal(null); setNotice(`${singular[type][0].toUpperCase()}${singular[type].slice(1)} ${isEdit ? 'updated' : 'created'}.`);
    await refresh();
  };

  const changeStatus = async (path, status, successMessage, extra = {}) => {
    try {
      await request(path, { method: 'PATCH', body: JSON.stringify({ status, ...extra }) });
      setNotice(successMessage); await refresh();
    } catch (error) { setPageError(error.message); }
  };

  const removeRecord = async (path, description, successMessage) => {
    if (!window.confirm(description)) return;
    try {
      await request(path, { method: 'DELETE' });
      setNotice(successMessage); await refresh();
    } catch (error) { setPageError(error.message); }
  };

  const toggleAdministrator = async (item, isActive) => {
    try {
      await request(`/api/admin/administrators/${item.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      setNotice(isActive ? 'Administrator activated.' : 'Administrator deactivated.'); await refresh();
    } catch (error) { setPageError(error.message); }
  };

  const assignRider = async (order, riderId) => {
    try {
      await request(`/api/admin/orders/${order.id}/assign-rider`, { method: 'POST', body: JSON.stringify({ riderId }) });
      setNotice('Delivery rider assigned. Order marked as dispatched.'); await refresh();
    } catch (error) { setPageError(error.message); }
  };

  const saveSetting = async (path, value, message) => {
    await request(path, { method: 'PATCH', body: JSON.stringify(value) });
    setNotice(message); await refresh();
  };

  const changePassword = async (form) => {
    await request('/api/admin/auth/change-password', { method: 'POST', body: JSON.stringify(form) });
    setModal(null); setNotice('Password updated. Other active sessions were signed out.');
  };

  if (checking) return <div className="admin-loading">Opening secure admin workspace…</div>;
  if (!admin) return <LoginScreen onLogin={login} />;

  const view = data[section] || {};
  const overview = data.overview?.overview || {};
  const openEditor = (type, item = null) => setModal({ type, item });

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-logo admin-sidebar-logo" href="/admin"><span className="admin-logo-mark">b</span><span>beauty<span>face</span></span></a>
      <div className="workspace-label">PLATFORM WORKSPACE</div>
      <nav className="admin-menu">{menu.map(([key, label, icon]) => <button key={key} className={section === key ? 'selected' : ''} onClick={() => { setSection(key); setQuery(''); setNotice(''); }}><span className="menu-symbol">{icon}</span><span>{label}</span>{key === 'orders' && Number(overview.open_orders) > 0 && <b>{overview.open_orders}</b>}</button>)}</nav>
      <div className="admin-sidebar-foot"><span className="secure-dot"/> Admin access is logged</div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar"><div><span className="admin-top-kicker">BEAUTY FACE · ADMIN</span><h1>{titles[section]}</h1></div><div className="admin-top-actions"><label className="admin-search"><span>⌕</span><input aria-label="Filter this page" placeholder="Filter this page" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="admin-button secondary password-button" onClick={() => setModal({ type: 'password' })}>Change password</button><div className="admin-profile"><span className="admin-avatar">{admin.fullName.split(' ').map((piece) => piece[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{admin.fullName}</strong><small>Administrator</small></span><button className="admin-icon-button" onClick={logout} title="Sign out">↪</button></div></div></header>
      <main className="admin-content">
        {notice && <div className="admin-notice"><span>✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
        {pageError && <div className="admin-error-banner"><strong>Could not load this section</strong><span>{pageError}</span><button className="admin-button secondary" onClick={() => loadSection(section)}>Try again</button></div>}
        {loading && <div className="admin-loading-line"><span/>Loading {titles[section].toLowerCase()}…</div>}

        {section === 'overview' && <OverviewPage overview={overview} onNavigate={setSection} loading={loading} />}
        {section === 'products' && <ProductsPage rows={filteredRows} onCreate={() => openEditor('products')} onEdit={(item) => openEditor('products', item)} onDelete={(item) => removeRecord(`/api/admin/products/${item.id}`, `Unpublish ${item.name}?`, 'Product removed from the storefront.')}/>}
        {section === 'sellers' && <SellersPage rows={filteredRows} onCreate={() => openEditor('sellers')} onEdit={(item) => openEditor('sellers', item)} onDelete={(item) => removeRecord(`/api/admin/sellers/${item.id}`, `Suspend ${item.display_name}?`, 'Seller suspended.')}/>}
        {section === 'doctors' && <DoctorsPage rows={filteredRows} onCreate={() => openEditor('doctors')} onEdit={(item) => openEditor('doctors', item)} onDelete={(item) => removeRecord(`/api/admin/doctors/${item.id}`, `Suspend ${item.display_name}?`, 'Clinician suspended.')}/>}
        {section === 'riders' && <RidersPage rows={filteredRows} onCreate={() => openEditor('riders')} onEdit={(item) => openEditor('riders', item)} onDelete={(item) => removeRecord(`/api/admin/riders/${item.id}`, `Suspend ${item.displayName}?`, 'Delivery rider suspended.')}/>}
        {section === 'orders' && <OrdersPage rows={filteredRows} riders={riders.filter((rider) => rider.status === 'active')} onStatus={(item, status) => changeStatus(`/api/admin/orders/${item.id}/status`, status, 'Order status updated.')} onAssign={assignRider}/>}
        {section === 'customers' && <CustomersPage rows={filteredRows} onStatus={(item, status) => changeStatus(`/api/admin/customers/${item.id}`, status, 'Customer account updated.')} onDelete={(item) => removeRecord(`/api/admin/customers/${item.id}`, `Erase ${item.name || 'this customer'} and their retained address/contact details? This is allowed only after open orders are resolved.`, 'Customer contact data erased.')}/>}
        {section === 'consultation-requests' && <RequestsPage rows={filteredRows} doctors={doctors} onUpdate={(item, status, doctorId) => changeStatus(`/api/admin/consultation-requests/${item.id}`, status, 'Callback request updated.', { doctorId: doctorId || null })} onDelete={(item) => removeRecord(`/api/admin/consultation-requests/${item.id}`, 'Cancel this request and erase its contact details?', 'Callback request contact erased.')}/>}
        {section === 'safety-reports' && <SafetyReportsPage rows={filteredRows} onUpdate={(item, status, resolutionNote) => changeStatus(`/api/admin/safety-reports/${item.id}`, status, 'Safety report updated.', { resolutionNote })} onDelete={(item) => removeRecord(`/api/admin/safety-reports/${item.id}`, 'Erase the encrypted report details and resolve this report?', 'Safety report details erased.')}/>}
        {section === 'articles' && <ArticlesPage rows={filteredRows} onCreate={() => openEditor('articles')} onEdit={(item) => openEditor('articles', item)} onDelete={(item) => removeRecord(`/api/admin/articles/${item.id}`, `Archive “${item.title}”?`, 'Article archived.')}/>}
        {section === 'administrators' && <AdministratorsPage rows={filteredRows} currentAdmin={admin} onCreate={() => openEditor('administrators')} onToggle={toggleAdministrator}/>}
        {section === 'settings' && <SettingsPage settings={view.settings} onSaveDelivery={(value) => saveSetting('/api/admin/settings/delivery', value, 'Delivery settings saved.')} onSaveSite={(value) => saveSetting('/api/admin/settings/site', value, 'Website settings saved.')}/>}
        {section === 'audit' && <AuditPage rows={filteredRows}/>}
      </main>
    </div>
    {modal?.type === 'password' ? <PasswordEditor onSave={changePassword} onClose={() => setModal(null)}/> : modal && <RecordEditor type={modal.type} item={modal.item} sellers={sellers} onSave={saveRecord} onClose={() => setModal(null)}/>}
  </div>;
}

function OverviewPage({ overview, onNavigate, loading }) {
  return <>
    <section className="admin-welcome"><div><span className="admin-kicker">YOUR WORKSPACE, AT A GLANCE</span><h2>Good work starts with a clear view.</h2><p>Review your catalog, orders, verification queues, and the people keeping the platform running.</p></div><button className="admin-button primary" onClick={() => onNavigate('products')}>Manage catalog <span>→</span></button></section>
    <section className="metric-grid">
      <MetricCard label="Published products" value={overview.published_products} note={`${overview.products || 0} total listings`} accent="metric-plum"/>
      <MetricCard label="Open orders" value={overview.open_orders} note={`${overview.orders || 0} orders recorded`} accent="metric-sage"/>
      <MetricCard label="Active customers" value={overview.customers} note="Customer records linked to orders" accent="metric-peach"/>
      <MetricCard label="Verification queue" value={Number(overview.pending_sellers || 0) + Number(overview.pending_doctors || 0)} note={`${overview.pending_sellers || 0} sellers · ${overview.pending_doctors || 0} clinicians`} accent="metric-yellow"/>
    </section>
    <section className="overview-lower"><div className="admin-card"><div className="admin-card-heading"><div><span className="admin-kicker">NEEDS ATTENTION</span><h3>Review queues</h3></div><span className="heading-mark">✦</span></div>
      <button className="queue-row" onClick={() => onNavigate('sellers')}><span className="queue-icon seller-icon">◈</span><span><strong>Seller verification</strong><small>Check supplier details and sourcing</small></span><b>{overview.pending_sellers || 0}</b><i>→</i></button>
      <button className="queue-row" onClick={() => onNavigate('doctors')}><span className="queue-icon doctor-icon">✚</span><span><strong>Clinician licenses</strong><small>Review provider credentials</small></span><b>{overview.pending_doctors || 0}</b><i>→</i></button>
      <button className="queue-row" onClick={() => onNavigate('consultation-requests')}><span className="queue-icon request-icon">◷</span><span><strong>Pilot callback requests</strong><small>Contact requests awaiting review</small></span><b>{overview.callback_requests || 0}</b><i>→</i></button>
      <button className="queue-row" onClick={() => onNavigate('safety-reports')}><span className="queue-icon request-icon">⚑</span><span><strong>Product-safety reports</strong><small>New, escalated, or in-review</small></span><b>{overview.safety_reports || 0}</b><i>→</i></button>
    </div><div className="admin-card quick-card"><div className="admin-card-heading"><div><span className="admin-kicker">QUICK ACTIONS</span><h3>What would you like to do?</h3></div></div>
      <button className="quick-action" onClick={() => onNavigate('products')}><span>＋</span><div><strong>Add a product</strong><small>Create or update a catalog listing</small></div><i>→</i></button>
      <button className="quick-action" onClick={() => onNavigate('articles')}><span>▤</span><div><strong>Publish an article</strong><small>Update the public education section</small></div><i>→</i></button>
      <button className="quick-action" onClick={() => onNavigate('administrators')}><span>♜</span><div><strong>Invite an administrator</strong><small>Grant platform management access</small></div><i>→</i></button>
    </div></section>
    <div className="admin-footnote"><span>ⓘ</span><p>Demo products remain marked as unverified until you review the real supplier and label evidence. Chapa payments are confirmed through server verification.</p></div>
  </>;
}

function PageTitle({ kicker, title, subtitle, action }) {
  return <div className="list-page-head"><div><span className="admin-kicker">{kicker}</span><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function EmptyTable({ columns, children }) {
  return children.length ? children : <tr><td className="empty-table" colSpan={columns}>Nothing here yet. Use the action above to add your first record.</td></tr>;
}

function ProductsPage({ rows, onCreate, onEdit, onDelete }) {
  return <><PageTitle kicker="CATALOG MANAGEMENT" title="Products" subtitle="Control product information, stock, verification, and storefront visibility." action={<button className="admin-button primary" onClick={onCreate}>＋ Add product</button>}/>
    <div className="admin-table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Supplier</th><th>Visibility</th><th/></tr></thead><tbody><EmptyTable columns={7} children={rows.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.brand} · {item.slug}{item.sample_listing ? ' · demo' : ''}</small></td><td>{item.category}</td><td>{amount(item.price_cents)}</td><td>{item.stock_count}</td><td><StatusPill>{item.supplier_verification}</StatusPill></td><td><StatusPill>{item.published ? 'published' : 'draft'}</StatusPill></td><td className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-link" onClick={() => onDelete(item)}>Unpublish</button></td></tr>)}/></tbody></table></div>
  </>;
}

function SellersPage({ rows, onCreate, onEdit, onDelete }) {
  return <><PageTitle kicker="PARTNER MANAGEMENT" title="Sellers" subtitle="Review supplier status and the listings connected to each seller." action={<button className="admin-button primary" onClick={onCreate}>＋ Add seller</button>}/>
    <div className="admin-table-wrap"><table><thead><tr><th>Seller</th><th>Verification</th><th>Products</th><th>Added</th><th/></tr></thead><tbody><EmptyTable columns={5} children={rows.map((item) => <tr key={item.id}><td><strong>{item.display_name}</strong><small>{item.is_demo ? 'Demo catalog' : item.id}</small></td><td><StatusPill>{item.verification_status}</StatusPill></td><td>{item.product_count}</td><td>{dateTime(item.created_at)}</td><td className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-link" onClick={() => onDelete(item)}>Suspend</button></td></tr>)}/></tbody></table></div>
  </>;
}

function DoctorsPage({ rows, onCreate, onEdit, onDelete }) {
  return <><PageTitle kicker="CLINICAL PARTNERS" title="Clinicians" subtitle="Track license review. A verified profile does not create appointment availability by itself." action={<button className="admin-button primary" onClick={onCreate}>＋ Add clinician</button>}/>
    <div className="admin-table-wrap"><table><thead><tr><th>Clinician</th><th>License reference</th><th>Specialties</th><th>Languages</th><th>License status</th><th/></tr></thead><tbody><EmptyTable columns={6} children={rows.map((item) => <tr key={item.id}><td><strong>{item.display_name}</strong><small>{dateTime(item.created_at)}</small></td><td>{item.licenseMasked || 'Not available'}</td><td>{(item.specialties || []).join(', ') || '—'}</td><td>{(item.languages || []).join(', ') || '—'}</td><td><StatusPill>{item.license_status}</StatusPill></td><td className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-link" onClick={() => onDelete(item)}>Suspend</button></td></tr>)}/></tbody></table></div>
  </>;
}

function OrdersPage({ rows, riders, onStatus, onAssign }) {
  const nextStatus = { paid: ['preparing'], preparing: ['dispatched'], dispatched: ['delivered'] };
  return <><PageTitle kicker="FULFILLMENT & RECONCILIATION" title="Orders and payments" subtitle="Payment state is read-only here and comes from Chapa verification. Move paid orders through fulfillment."/>
    <div className="admin-table-wrap"><table><thead><tr><th>Order</th><th>Customer / delivery</th><th>Order total</th><th>Payment</th><th>Fulfillment</th><th>Placed</th><th>Actions</th></tr></thead><tbody><EmptyTable columns={7} children={rows.map((item) => <tr key={item.id}><td><strong>#{item.id.slice(0, 8).toUpperCase()}</strong><small>{item.items?.map((line) => `${line.quantity} × ${line.name}`).join(', ') || 'No line items'}</small></td><td><strong>{item.customerName}</strong><small>{item.customerPhone || 'Contact erased'}</small><small>{item.delivery ? `${item.delivery.city}, ${item.delivery.subcity}, Woreda ${item.delivery.woreda} · ${item.delivery.landmark}` : 'Delivery details erased'}</small></td><td>{amount(item.totalCents)}</td><td><StatusPill>{item.paymentStatus || 'unknown'}</StatusPill><small className="table-subline">{item.merchantReference || '—'}</small></td><td><StatusPill>{item.status}</StatusPill><small>{item.riderName ? `Rider: ${item.riderName} · ${item.deliveryStatus}` : 'No rider assigned'}</small></td><td>{dateTime(item.createdAt)}</td><td><div className="stacked-actions">{nextStatus[item.status]?.length ? <select className="inline-select" value="" aria-label="Update fulfillment status" onChange={(event) => event.target.value && onStatus(item, event.target.value)}><option value="">Update status…</option>{nextStatus[item.status].map((status) => <option key={status}>{status}</option>)}</select> : null}{(item.status === 'preparing' || (item.status === 'dispatched' && (!item.deliveryStatus || item.deliveryStatus === 'assigned'))) && riders.length > 0 && <RiderAssignment item={item} riders={riders} onAssign={onAssign}/>}</div></td></tr>)}/></tbody></table></div>
    <div className="admin-footnote"><span>ⓘ</span><p>Payment status can only be changed by verified Chapa events. Refund controls are withheld until a verified refund flow is connected.</p></div>
  </>;
}

function RiderAssignment({ item, riders, onAssign }) {
  const [riderId, setRiderId] = useState(item.riderId || '');
  return <div className="rider-assignment"><select className="inline-select" aria-label="Choose delivery rider" value={riderId} onChange={(event) => setRiderId(event.target.value)}><option value="">Assign rider…</option>{riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.displayName}</option>)}</select><button disabled={!riderId} onClick={() => onAssign(item, riderId)}>{item.riderId ? 'Reassign' : 'Assign'}</button></div>;
}

function RidersPage({ rows, onCreate, onEdit, onDelete }) {
  return <><PageTitle kicker="FULFILLMENT TEAM" title="Delivery riders" subtitle="Add and manage rider records. Only active riders can be assigned to prepared orders." action={<button className="admin-button primary" onClick={onCreate}>＋ Add rider</button>}/>
    <div className="admin-table-wrap"><table><thead><tr><th>Rider</th><th>Phone</th><th>Vehicle</th><th>Status</th><th>Added</th><th/></tr></thead><tbody><EmptyTable columns={6} children={rows.map((item) => <tr key={item.id}><td><strong>{item.displayName}</strong><small>{item.id}</small></td><td>{item.phone}</td><td>{item.vehicleType}</td><td><StatusPill>{item.status}</StatusPill></td><td>{dateTime(item.createdAt)}</td><td className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-link" onClick={() => onDelete(item)}>Suspend</button></td></tr>)}/></tbody></table></div>
  </>;
}

function SafetyReportsPage({ rows, onUpdate, onDelete }) {
  return <><PageTitle kicker="PRODUCT SAFETY" title="Safety reports" subtitle="Review product quality, labeling, counterfeit, and reaction concerns. Keep investigation notes factual and avoid adding unnecessary health information."/>
    <div className="admin-table-wrap"><table><thead><tr><th>Received</th><th>Report</th><th>Product / order</th><th>Details and contact</th><th>Review</th><th/></tr></thead><tbody><EmptyTable columns={6} children={rows.map((item) => <tr key={item.id}><td>{dateTime(item.createdAt)}</td><td><StatusPill>{item.reportType}</StatusPill></td><td><strong>{item.productName || 'No product selected'}</strong><small>{item.orderId ? `Order ${item.orderId.slice(0, 8)}` : 'No order reference'}</small></td><td className="report-detail"><strong>{item.details || 'Details erased'}</strong><small>{item.name || item.phone ? `${item.name || ''} ${item.phone || ''}`.trim() : 'No contact provided'}</small></td><td><SafetyReportActions item={item} onUpdate={onUpdate}/></td><td className="row-actions"><button className="danger-link" onClick={() => onDelete(item)}>Erase details</button></td></tr>)}/></tbody></table></div>
  </>;
}

function SafetyReportActions({ item, onUpdate }) {
  const [status, setStatus] = useState(item.status);
  const [resolutionNote, setResolutionNote] = useState(item.resolutionNote || '');
  return <div className="stacked-actions"><select className="inline-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="new">New</option><option value="in_review">In review</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option></select><input className="inline-input" aria-label="Resolution note" placeholder="Resolution note" maxLength="2000" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)}/><button onClick={() => onUpdate(item, status, resolutionNote)}>Save review</button></div>;
}

function SettingsPage({ settings, onSaveDelivery, onSaveSite }) {
  const delivery = settings?.delivery || {};
  const site = settings?.site || {};
  const [cities, setCities] = useState((delivery.deliveryCities || []).join(', '));
  const [fees, setFees] = useState(() => Object.entries(delivery.deliveryFeesCents || {}).map(([city, cents]) => `${city}: ${Number(cents) / 100}`).join('\n'));
  const [announcement, setAnnouncement] = useState(site.announcement || '');
  const [supportPhone, setSupportPhone] = useState(site.supportPhone || '');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!settings) return;
    setCities((delivery.deliveryCities || []).join(', '));
    setFees(Object.entries(delivery.deliveryFeesCents || {}).map(([city, cents]) => `${city}: ${Number(cents) / 100}`).join('\n'));
    setAnnouncement(site.announcement || '');
    setSupportPhone(site.supportPhone || '');
  }, [settings]);
  const saveDelivery = async (event) => {
    event.preventDefault(); setError('');
    const deliveryCities = cities.split(',').map((city) => city.trim()).filter(Boolean);
    const deliveryFeesCents = {};
    for (const line of fees.split('\n').filter((entry) => entry.trim())) {
      const separator = line.lastIndexOf(':');
      if (separator < 1) { setError('Enter one fee per line as City: amount in ETB.'); return; }
      const city = line.slice(0, separator).trim();
      const fee = Number(line.slice(separator + 1).trim());
      if (!Number.isFinite(fee) || fee < 0) { setError(`Enter a valid fee for ${city}.`); return; }
      deliveryFeesCents[city] = Math.round(fee * 100);
    }
    if (deliveryCities.some((city) => deliveryFeesCents[city] === undefined)) { setError('Add a delivery fee for every city.'); return; }
    try { await onSaveDelivery({ deliveryCities, deliveryFeesCents }); } catch (requestError) { setError(requestError.message); }
  };
  const saveSite = async (event) => { event.preventDefault(); setError(''); try { await onSaveSite({ announcement, supportPhone }); } catch (requestError) { setError(requestError.message); } };
  return <><PageTitle kicker="STOREFRONT CONFIGURATION" title="Site settings" subtitle="Manage the announcement, support contact, delivery cities, and fee estimates shown at checkout."/>
    {!settings && <div className="admin-empty-state">Settings are loading. If they do not appear, use Try again.</div>}
    {settings && <div className="settings-grid">
      <form className="admin-card settings-form" onSubmit={saveDelivery}><div className="admin-card-heading"><div><span className="admin-kicker">CHECKOUT</span><h3>Delivery areas and fees</h3></div></div><label className="admin-field"><span>Delivery cities</span><input value={cities} onChange={(event) => setCities(event.target.value)} placeholder="Addis Ababa, Adama"/><small>Comma-separated city names. Customers can select only these cities.</small></label><label className="admin-field"><span>Fees (ETB, one per line)</span><textarea rows="5" value={fees} onChange={(event) => setFees(event.target.value)} placeholder={'Addis Ababa: 500\nAdama: 700'}/><small>Include every city using the exact same spelling. Amounts are saved in cents.</small></label><button className="admin-button primary">Save delivery settings</button></form>
      <form className="admin-card settings-form" onSubmit={saveSite}><div className="admin-card-heading"><div><span className="admin-kicker">PUBLIC WEBSITE</span><h3>Announcement and support</h3></div></div><label className="admin-field"><span>Announcement banner</span><input maxLength="180" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} required/></label><label className="admin-field"><span>Support phone (optional)</span><input type="tel" maxLength="40" value={supportPhone} onChange={(event) => setSupportPhone(event.target.value)} placeholder="+251 …"/></label><button className="admin-button primary">Save website settings</button></form>
    </div>}
    {error && <div className="admin-form-error settings-error" role="alert">{error}</div>}
    <div className="admin-footnote"><span>ⓘ</span><p>Delivery charges are estimates. Keep fees and supported areas current with your actual fulfillment arrangements.</p></div>
  </>;
}

function CustomersPage({ rows, onStatus, onDelete }) {
  return <><PageTitle kicker="CUSTOMER RECORDS" title="Customers" subtitle="Guest checkout creates encrypted customer records. Account erasure is blocked while an order is active."/>
    <div className="admin-table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Last order</th><th>Account status</th><th/></tr></thead><tbody><EmptyTable columns={6} children={rows.map((item) => <tr key={item.id}><td><strong>{item.name || 'Deleted customer'}</strong><small>{dateTime(item.createdAt)}</small></td><td>{item.phone || 'Erased'}</td><td>{item.orderCount}</td><td>{dateTime(item.latestOrderAt)}</td><td><StatusPill>{item.status}</StatusPill></td><td className="row-actions">{item.status !== 'deleted' && <><button onClick={() => onStatus(item, item.status === 'active' ? 'suspended' : 'active')}>{item.status === 'active' ? 'Suspend' : 'Reactivate'}</button><button className="danger-link" onClick={() => onDelete(item)}>Erase</button></>}</td></tr>)}/></tbody></table></div>
  </>;
}

function RequestsPage({ rows, doctors, onUpdate, onDelete }) {
  return <><PageTitle kicker="CLINICAL PILOT" title="Callback requests" subtitle="These are waitlist callbacks, not confirmed appointments. Do not collect clinical notes here."/>
    <div className="admin-table-wrap"><table><thead><tr><th>Contact</th><th>City</th><th>Preference</th><th>Assigned clinician</th><th>Status</th><th>Received</th><th/></tr></thead><tbody><EmptyTable columns={7} children={rows.map((item) => <tr key={item.id}><td><strong>{item.name || 'Contact erased'}</strong><small>{item.phone || '—'}</small></td><td>{item.city}</td><td>{item.preferred_mode}</td><td>{item.doctor_name || '—'}</td><td><StatusPill>{item.status}</StatusPill></td><td>{dateTime(item.created_at)}</td><td className="row-actions"><RequestActions item={item} doctors={doctors} onUpdate={onUpdate} onDelete={onDelete}/></td></tr>)}/></tbody></table></div>
  </>;
}

function RequestActions({ item, doctors, onUpdate, onDelete }) {
  const [status, setStatus] = useState(item.status);
  const [doctorId, setDoctorId] = useState(item.doctor_id || '');
  return <div className="stacked-actions"><select className="inline-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="pilot_waitlist">Waitlist</option><option value="requested">Requested</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
    {doctors.length > 0 && <select className="inline-select" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="">Unassigned</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.display_name}</option>)}</select>}
    <button onClick={() => onUpdate(item, status, doctorId)}>Save</button><button className="danger-link" onClick={() => onDelete(item)}>Erase</button></div>;
}

function ArticlesPage({ rows, onCreate, onEdit, onDelete }) {
  return <><PageTitle kicker="PUBLIC WEBSITE CONTENT" title="Education articles" subtitle="Draft, edit, translate, publish, and archive the public skin-safety content." action={<button className="admin-button primary" onClick={onCreate}>＋ Write article</button>}/>
    <div className="admin-table-wrap"><table><thead><tr><th>Article</th><th>Language</th><th>Status</th><th>Updated</th><th/></tr></thead><tbody><EmptyTable columns={5} children={rows.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><small>/{item.slug} · {item.excerpt}</small></td><td>{item.language.toUpperCase()}</td><td><StatusPill>{item.status}</StatusPill></td><td>{dateTime(item.updated_at)}</td><td className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-link" onClick={() => onDelete(item)}>Archive</button></td></tr>)}/></tbody></table></div>
  </>;
}

function AdministratorsPage({ rows, currentAdmin, onCreate, onToggle }) {
  return <><PageTitle kicker="ACCESS CONTROL" title="Administrators" subtitle="Every active administrator has full platform access. Deactivated accounts lose all active sessions." action={<button className="admin-button primary" onClick={onCreate}>＋ Add administrator</button>}/>
    <div className="admin-table-wrap"><table><thead><tr><th>Administrator</th><th>Last sign-in</th><th>Created</th><th>Access</th><th/></tr></thead><tbody><EmptyTable columns={5} children={rows.map((item) => <tr key={item.id}><td><strong>{item.full_name}{item.id === currentAdmin.id ? ' · You' : ''}</strong><small>{item.email}</small></td><td>{dateTime(item.last_login_at)}</td><td>{dateTime(item.created_at)}</td><td><StatusPill>{item.is_active ? 'active' : 'suspended'}</StatusPill></td><td className="row-actions">{item.id !== currentAdmin.id && <button onClick={() => onToggle(item, !item.is_active)}>{item.is_active ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}/></tbody></table></div>
  </>;
}

function AuditPage({ rows }) {
  return <><PageTitle kicker="ACCOUNTABILITY" title="Audit log" subtitle="Recent administrator actions. Contact information and passwords are excluded from event details."/>
    <div className="admin-table-wrap"><table><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody><EmptyTable columns={5} children={rows.map((item) => <tr key={item.id}><td>{dateTime(item.created_at)}</td><td><strong>{item.admin_name || 'Removed admin'}</strong><small>{item.admin_email || '—'}</small></td><td><StatusPill>{item.action}</StatusPill></td><td>{item.resource_type}<small>{item.resource_id || '—'}</small></td><td className="audit-details">{JSON.stringify(item.details)}</td></tr>)}/></tbody></table></div>
  </>;
}
