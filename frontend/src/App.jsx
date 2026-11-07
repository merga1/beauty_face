import { useEffect, useMemo, useState } from 'react';

const categories = [
  { name: 'Skincare', icon: '✿', color: 'lilac', caption: 'Gentle, everyday care' },
  { name: 'Sun care', icon: '☼', color: 'butter', caption: 'A little daily protection' },
  { name: 'Hair care', icon: '〰', color: 'sage', caption: 'Care from root to tip' },
  { name: 'Body care', icon: '♡', color: 'rose', caption: 'Comfort for every day' },
];

const money = (cents) => new Intl.NumberFormat('en-ET', {
  style: 'currency', currency: 'ETB', maximumFractionDigits: 0,
}).format(Number(cents || 0) / 100);

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /></span>;
}

function Header({ count, onBag, onConsult }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Beauty Face home">
        <BrandMark /><span>beauty<span className="brand-light">face</span></span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="#shop">Shop</a><a href="#our-approach">Our approach</a><a href="#safety">Skin safety</a>
      </nav>
      <div className="header-actions">
        <button className="text-link consult-link" onClick={onConsult}>Talk to a specialist <span>↗</span></button>
        <button className="bag-button" onClick={onBag} aria-label={`Open bag, ${count} items`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
          <span>Bag</span><b>{count}</b>
        </button>
      </div>
    </header>
  );
}

function ProductArt({ category, index = 0 }) {
  const style = ['art-lilac', 'art-peach', 'art-sage', 'art-sun', 'art-rose'][index % 5];
  const type = category?.toLowerCase().includes('hair') ? 'jar' : index % 3 === 0 ? 'tube' : 'bottle';
  return (
    <div className={`product-art ${style}`} aria-hidden="true">
      <span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" />
      <div className={`package-shape ${type}`}><div className="package-cap" /><div className="package-label"><i /><i /><i /></div></div>
      <span className="art-leaf leaf-one">✳</span><span className="art-leaf leaf-two">✦</span>
    </div>
  );
}

function ProductCard({ product, index, onAdd, onDetails, saved, onSave }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <ProductArt category={product.category} index={index} />
        <span className="sample-tag">Sample listing</span>
        <button className={`save-button ${saved ? 'is-saved' : ''}`} onClick={() => onSave(product.id)} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.1-8.8 10.4-8.8 10.4S3.2 13.9 3.2 8.8A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.5Z"/></svg>
        </button>
      </div>
      <div className="product-info">
        <div className="product-brand-row"><span className="product-brand">{product.brand}</span><span className="verified-dot" title="Supplier verification pending">!</span></div>
        <button className="product-title" onClick={() => onDetails(product)}>{product.name}</button>
        <p className="product-subtitle">{product.category} · {product.skin_types?.slice(0, 2).join(', ') || 'all skin types'}</p>
        <div className="product-bottom"><strong>{money(product.price_cents)}</strong><button className="add-button" onClick={() => onAdd(product)}>Add <span>+</span></button></div>
      </div>
    </article>
  );
}

function Overlay({ children, onClose, wide = false }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true">{children}</section></div>;
}

function CartDrawer({ cart, setCart, onClose, onCheckout }) {
  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.price_cents) * item.quantity, 0);
  return (
    <Overlay onClose={onClose}>
      <div className="dialog-heading"><div><span className="eyebrow">YOUR SELECTION</span><h2>Your bag <span className="muted-count">({cart.reduce((n, item) => n + item.quantity, 0)})</span></h2></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
      {cart.length === 0 ? <div className="empty-bag"><span>♡</span><h3>Your bag is waiting</h3><p>Take a look around and find something that feels right for you.</p><button className="primary-button" onClick={onClose}>Explore the shop</button></div> : <>
        <div className="cart-items">{cart.map(({ product, quantity }) => <div className="cart-row" key={product.id}>
          <ProductArt category={product.category} index={product.name.length} />
          <div className="cart-product"><span className="product-brand">{product.brand}</span><strong>{product.name}</strong><span>{money(product.price_cents)}</span><div className="quantity-control"><button onClick={() => setCart((items) => items.map((item) => item.product.id === product.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))} aria-label="Decrease quantity">−</button><span>{quantity}</span><button onClick={() => setCart((items) => items.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item))} aria-label="Increase quantity">+</button><button className="remove-item" onClick={() => setCart((items) => items.filter((item) => item.product.id !== product.id))}>Remove</button></div></div>
        </div>)}</div>
        <div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Delivery fee is confirmed for your area at checkout.</p><button className="primary-button full-button" onClick={onCheckout}>Continue to checkout <span>→</span></button><p className="secure-note"><span>✦</span> Secure hosted checkout with Chapa</p></div>
      </>}
    </Overlay>
  );
}

function CheckoutDialog({ cart, cities, fees, onClose, onOrder }) {
  const [form, setForm] = useState({ name: '', phone: '', city: 'Addis Ababa', subcity: '', woreda: '', landmark: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.price_cents) * item.quantity, 0);
  const deliveryFee = Number(fees[form.city] ?? 0);
  useEffect(() => {
    if (cities.length && !cities.includes(form.city)) setForm((current) => ({ ...current, city: cities[0] }));
  }, [cities, form.city]);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          customer: { name: form.name, phone: form.phone },
          delivery: { city: form.city, subcity: form.subcity, woreda: form.woreda, landmark: form.landmark },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not start checkout. Please try again.');
      onOrder(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  };
  return <Overlay onClose={onClose} wide>
    <div className="dialog-heading"><div><span className="eyebrow">DELIVERY DETAILS</span><h2>Where should we send it?</h2></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
    <p className="form-intro">Your details are encrypted before storage and used to fulfill this order. Payment takes place on Chapa's hosted checkout.</p>
    <form className="checkout-form" onSubmit={submit}>
      <label>Full name<input name="name" autoComplete="name" value={form.name} onChange={change} required minLength="2" maxLength="120" /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" placeholder="+251 …" value={form.phone} onChange={change} required /></label>
      <label>City<select name="city" value={form.city} onChange={change}>{cities.map((city) => <option key={city}>{city}</option>)}</select></label>
      <div className="form-pair"><label>Sub-city<input name="subcity" value={form.subcity} onChange={change} required maxLength="160" /></label><label>Woreda<input name="woreda" value={form.woreda} onChange={change} required maxLength="160" /></label></div>
      <label>Landmark or delivery directions<input name="landmark" placeholder="A nearby landmark helps your rider find you" value={form.landmark} onChange={change} required maxLength="160" /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="checkout-price-breakdown"><div><span>Items subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Delivery estimate</span><strong>{money(deliveryFee)}</strong></div><div className="estimate-total"><span>Estimated total</span><strong>{money(subtotal + deliveryFee)}</strong></div></div>
      <button className="primary-button full-button" disabled={busy}>{busy ? 'Preparing secure checkout…' : <>Continue to Chapa <span>→</span></>}</button>
      <p className="small-print">The API recalculates this estimate when you place the order. Orders are not confirmed until payment is verified by Beauty Face.</p>
    </form>
  </Overlay>;
}

function ConsultationDialog({ cities, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', city: 'Addis Ababa', preferredMode: 'text', privacyConsent: false });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cities.length && !cities.includes(form.city)) setForm((current) => ({ ...current, city: cities[0] }));
  }, [cities, form.city]);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch('/api/consultation-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not save your request.');
      setMessage(result.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return <Overlay onClose={onClose}>
    <div className="dialog-heading"><div><span className="eyebrow">CLINICAL PILOT</span><h2>Let's keep in touch</h2></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
    {message ? <div className="success-state"><span>✓</span><h3>You're on the list</h3><p>{message} This is not a booked appointment or medical advice.</p><button className="primary-button" onClick={onClose}>Done</button></div> : <>
      <p className="form-intro">We're building a network of licensed skin specialists. Leave a callback request for the pilot. No photos or health details are collected here.</p>
      <form className="checkout-form" onSubmit={submit}>
        <label>Full name<input name="name" value={form.name} onChange={change} required minLength="2" maxLength="120" /></label>
        <label>Phone number<input name="phone" type="tel" placeholder="+251 …" value={form.phone} onChange={change} required /></label>
        <label>City<select name="city" value={form.city} onChange={change}>{cities.map((city) => <option key={city}>{city}</option>)}</select></label>
        <label>Preferred contact<select name="preferredMode" value={form.preferredMode} onChange={change}><option value="text">Text</option><option value="voice">Voice call</option><option value="video">Video call</option></select></label>
        <label className="consent-check"><input type="checkbox" name="privacyConsent" checked={form.privacyConsent} onChange={change} required /><span>I agree to be contacted about the pilot. My contact details will be encrypted and used only for this request.</span></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button full-button" disabled={busy}>{busy ? 'Sending…' : 'Request a callback'}</button>
      </form>
    </>}
  </Overlay>;
}

function ProductDialog({ product, onClose, onAdd }) {
  return <Overlay onClose={onClose} wide>
    <div className="detail-layout"><ProductArt category={product.category} index={product.name.length} /><div className="detail-copy"><div className="dialog-heading"><span className="eyebrow">{product.category} · SAMPLE LISTING</span><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
      <span className="product-brand">{product.brand}</span><h2>{product.name}</h2><strong className="detail-price">{money(product.price_cents)}</strong><p>{product.description}</p>
      <div className="verification-note"><span>!</span><p>Supplier verification is pending. This placeholder listing is for interface demonstration only and is not approved for sale.</p></div>
      <h3>Ingredients</h3><p>{product.ingredients?.join(' · ') || 'Check the package label.'}</p>
      <h3>How to use</h3><p>{product.how_to_use || 'Follow the verified package label.'}</p>
      <h3>Lot and expiry</h3><p>{product.expiry_information || 'Expiry details not provided.'}</p>
      {product.warnings?.length > 0 && <><h3>Safety notes</h3><ul>{product.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></>}
      <button className="primary-button full-button" onClick={() => { onAdd(product); onClose(); }}>Add to bag <span>+</span></button>
    </div></div>
  </Overlay>;
}

function ArticleDialog({ article, onClose }) {
  return <Overlay onClose={onClose} wide><div className="article-dialog"><div className="dialog-heading"><span className="eyebrow">SKINCARE GUIDE · {article.language.toUpperCase()}</span><button className="close-button" onClick={onClose} aria-label="Close">×</button></div><h2>{article.title}</h2><p className="article-dialog-excerpt">{article.excerpt}</p><div className="article-dialog-body">{article.body}</div><small>{new Intl.DateTimeFormat('en-ET',{dateStyle:'long'}).format(new Date(article.published_at))}</small></div></Overlay>;
}

function SafetyReportDialog({ products, onClose }) {
  const [form, setForm] = useState({ reportType: 'product_quality', productId: '', orderId: '', details: '', contactName: '', contactPhone: '', privacyConsent: false });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/safety-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not send this report.');
      setMessage(result.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return <Overlay onClose={onClose} wide><div className="dialog-heading"><div><span className="eyebrow">PRODUCT SAFETY</span><h2>Tell us what happened</h2></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
    {message ? <div className="success-state"><span>✓</span><h3>Report received</h3><p>{message}</p><button className="primary-button" onClick={onClose}>Done</button></div> : <>
      <p className="form-intro">Reports are encrypted and reviewed by the safety team. Do not include photos. If you need medical care, contact a licensed health professional.</p>
      <form className="checkout-form" onSubmit={submit}>
        <label>Report type<select name="reportType" value={form.reportType} onChange={update}><option value="product_quality">Product quality</option><option value="counterfeit">Possible counterfeit</option><option value="reaction">Product reaction</option><option value="labeling">Label or expiry concern</option><option value="other">Other safety concern</option></select></label>
        <label>Product (optional)<select name="productId" value={form.productId} onChange={update}><option value="">Not listed or unknown</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Order reference (optional)<input name="orderId" placeholder="Paste the order ID if available" value={form.orderId} onChange={update} /></label>
        <label>What should we review?<textarea name="details" rows="4" minLength="10" maxLength="5000" value={form.details} onChange={update} required /></label>
        <div className="form-pair"><label>Your name (optional)<input name="contactName" value={form.contactName} onChange={update} maxLength="120" /></label><label>Phone (optional)<input name="contactPhone" type="tel" placeholder="+251 …" value={form.contactPhone} onChange={update} /></label></div>
        <label className="consent-check"><input type="checkbox" name="privacyConsent" checked={form.privacyConsent} onChange={update} required/><span>I agree to send this report for product-safety review. Any contact details are optional and encrypted.</span></label>
        {error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button full-button" disabled={busy}>{busy ? 'Sending report…' : 'Send safety report'}</button>
      </form>
    </>}
  </Overlay>;
}

function PaymentReturn({ orderId, onPaid, onExit }) {
  const [status, setStatus] = useState('Checking with Chapa…');
  const [failed, setFailed] = useState(false);
  const verify = async () => {
    setStatus('Checking with Chapa…'); setFailed(false);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment-status`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payment status is temporarily unavailable.');
      if (result.orderStatus === 'paid') { setStatus('Payment confirmed. Your order is on its way to our team.'); onPaid(); }
      else if (result.orderStatus === 'payment_failed') { setStatus('This payment did not complete. You can return to your bag and try again.'); }
      else setStatus('Your payment is still being confirmed. Please check again in a moment.');
    } catch (error) { setFailed(true); setStatus(error.message); }
  };
  useEffect(() => { verify(); }, [orderId]);
  return <div className="payment-return"><BrandMark/><span className="eyebrow">ORDER PAYMENT</span><h1>{status.includes('confirmed') ? 'Thank you' : 'Almost there'}</h1><p>{status}</p><div className="return-actions"><button className="primary-button" onClick={verify}>Check payment status</button><button className="text-link" onClick={onExit}>Return to the shop</button></div>{failed && <span className="small-print">Your checkout may still be processing. Please retry before placing another order.</span>}</div>;
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [articles, setArticles] = useState([]);
  const [deliveryCities, setDeliveryCities] = useState(['Addis Ababa', 'Adama']);
  const [deliveryFees, setDeliveryFees] = useState({ 'Addis Ababa': 50000, Adama: 70000 });
  const [siteSettings, setSiteSettings] = useState({ announcement: 'Skin-first beauty, made clearer', supportPhone: '' });
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [skinType, setSkinType] = useState('');
  const [cart, setCart] = useState(() => { try { const value = JSON.parse(localStorage.getItem('beauty-face-cart') || '[]'); return Array.isArray(value) ? value.filter((item) => item?.product?.id && Number.isInteger(item.quantity) && item.quantity > 0) : []; } catch { return []; } });
  const [saved, setSaved] = useState(() => { try { const value = JSON.parse(localStorage.getItem('beauty-face-saved') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } });
  const [dialog, setDialog] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [safetyReportOpen, setSafetyReportOpen] = useState(false);
  const [orderId, setOrderId] = useState(new URLSearchParams(window.location.search).get('order'));

  useEffect(() => {
    fetch('/api/config/public')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load delivery settings.')))
      .then((config) => {
        if (Array.isArray(config.deliveryCities) && config.deliveryCities.length) setDeliveryCities(config.deliveryCities);
        if (config.deliveryFeesCents && typeof config.deliveryFeesCents === 'object') setDeliveryFees(config.deliveryFeesCents);
        if (config.site && typeof config.site === 'object') setSiteSettings(config.site);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ q: query, category: activeCategory, skinType });
    setLoading(true);
    fetch(`/api/products?${params}`)
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Catalog is unavailable.'); return body.products || []; })
      .then((rows) => { setProducts(rows); setCatalogError(''); })
      .catch((error) => { setCatalogError(error.message); setProducts([]); })
      .finally(() => setLoading(false));
  }, [query, activeCategory, skinType]);

  useEffect(() => {
    fetch('/api/articles').then((response) => response.ok ? response.json() : Promise.reject(new Error('Articles unavailable.')))
      .then((result) => setArticles(result.articles || [])).catch(() => setArticles([]));
  }, []);

  useEffect(() => localStorage.setItem('beauty-face-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('beauty-face-saved', JSON.stringify(saved)), [saved]);
  useEffect(() => { document.body.classList.toggle('modal-open', Boolean(dialog || selectedProduct || selectedArticle || safetyReportOpen || orderId)); return () => document.body.classList.remove('modal-open'); }, [dialog, selectedProduct, selectedArticle, safetyReportOpen, orderId]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const visibleProducts = useMemo(() => products, [products]);
  const addToCart = (product) => setCart((items) => {
    const existing = items.find((item) => item.product.id === product.id);
    if (existing) return items.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item);
    return [...items, { product, quantity: 1 }];
  });
  const toggleSaved = (id) => setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const startCheckout = () => setDialog('checkout');
  const beginPayment = (result) => { setDialog(''); window.location.assign(result.checkoutUrl); };
  const finishPayment = () => { setCart([]); setOrderId(null); window.history.pushState({}, '', '/'); };
  const leavePayment = () => { setOrderId(null); window.history.pushState({}, '', '/'); };

  if (orderId) return <PaymentReturn orderId={orderId} onPaid={finishPayment} onExit={leavePayment} />;

  return <>
    <div className="announcement"><span className="announcement-sparkle">✦</span> {siteSettings.announcement} <span className="announcement-divider">·</span> Made for Ethiopia <a href="#our-approach">Discover our approach <span>→</span></a></div>
    <Header count={cartCount} onBag={() => setDialog('cart')} onConsult={() => setDialog('consult')} />
    <main id="top">
      <section className="hero-section">
        <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> YOUR SKIN, YOUR STORY</span><h1>Care for your skin.<br/><em>Feel good</em> in your skin.</h1><p>A calmer way to discover skincare and beauty. Thoughtful product details, local care, and guidance that puts your wellbeing first.</p>
          <div className="hero-actions"><a className="primary-button" href="#shop">Explore the collection <span>→</span></a><a className="secondary-link" href="#our-approach"><span className="play-icon">▷</span> How Beauty Face works</a></div>
          <div className="hero-trust"><span className="trust-stars">✦ ✦ ✦</span><span>Clear ingredients. More considered choices.</span></div>
        </div>
        <div className="hero-visual"><div className="hero-disc disc-back"/><div className="hero-disc disc-front"/><div className="hero-bottle bottle-left"><span className="bottle-cap"/><span className="bottle-name">daily<br/>care</span></div><div className="hero-bottle bottle-right"><span className="bottle-cap"/><span className="bottle-name">soft<br/>glow</span></div><div className="hero-bottle bottle-small"><span className="bottle-cap"/><span className="bottle-name">skin<br/>ritual</span></div><span className="hero-flower flower-a">✺</span><span className="hero-flower flower-b">✦</span><div className="hero-note"><span>beauty begins<br/>with understanding</span><span className="note-line"/></div><div className="hero-caption"><span>01 / 03</span><span>Everyday essentials</span></div></div>
      </section>

      <section className="benefit-strip" id="our-approach"><div><span className="benefit-icon">✿</span><span><strong>Details you can understand</strong><small>Ingredients and directions, made clear</small></span></div><div><span className="benefit-icon">◈</span><span><strong>Safety comes first</strong><small>Supplier status shown honestly</small></span></div><div><span className="benefit-icon">⌖</span><span><strong>Made for local care</strong><small>Delivery pilot in {deliveryCities.join(' and ')}</small></span></div></section>

      <section className="category-section content-width"><div className="section-heading"><div><span className="eyebrow">FIND YOUR KIND OF CARE</span><h2>A good place to begin</h2></div><a href="#shop" className="quiet-link">View all products <span>→</span></a></div><div className="category-grid">{categories.map((category) => <button className={`category-card ${category.color}`} key={category.name} onClick={() => { setActiveCategory(category.name); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }); }}><span className="category-icon">{category.icon}</span><span className="category-text"><strong>{category.name}</strong><small>{category.caption}</small></span><span className="category-arrow">↗</span></button>)}</div></section>

      <section className="shop-section" id="shop"><div className="content-width"><div className="section-heading shop-heading"><div><span className="eyebrow">THE BEAUTY FACE EDIT</span><h2>A little care goes a long way</h2><p>Thoughtful essentials for your everyday routine.</p></div><a href="#safety" className="quiet-link">Our product standards <span>→</span></a></div>
        <div className="shop-controls"><div className="category-tabs"><button className={!activeCategory ? 'active' : ''} onClick={() => setActiveCategory('')}>All care</button>{categories.map((category) => <button key={category.name} className={activeCategory === category.name ? 'active' : ''} onClick={() => setActiveCategory(activeCategory === category.name ? '' : category.name)}>{category.name}</button>)}</div><div className="search-filter"><label className="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products" /></label><select aria-label="Filter by skin type" value={skinType} onChange={(event) => setSkinType(event.target.value)}><option value="">All skin types</option><option value="dry">Dry</option><option value="oily">Oily</option><option value="combination">Combination</option><option value="sensitive">Sensitive</option></select></div></div>
        {catalogError && <div className="catalog-state error-state"><span>!</span><div><strong>We couldn't reach the catalog</strong><p>{catalogError} Start the API and connect PostgreSQL to load products.</p></div></div>}
        {loading && !catalogError && <div className="catalog-state"><span className="loading-dot"/><p>Finding your everyday essentials…</p></div>}
        {!loading && !catalogError && visibleProducts.length === 0 && <div className="catalog-state"><span>♡</span><p>No products match yet. Try a different search or category.</p></div>}
        <div className="product-grid">{visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} onAdd={addToCart} onDetails={setSelectedProduct} saved={saved.includes(product.id)} onSave={toggleSaved}/>)}</div>
        <div className="catalog-disclaimer"><span>ⓘ</span><p>Sample listings are for demonstration. Supplier verification and product claims are pending review; no sample listing is endorsed or approved for sale.</p></div>
      </div></section>

      <section className="safety-section content-width" id="safety"><div className="safety-art"><div className="safety-circle"><span>✳</span></div><div className="safety-label label-one">Take a closer look <span>↘</span></div><div className="safety-label label-two">Your skin deserves care <span>✦</span></div></div><div className="safety-copy"><span className="eyebrow">A MORE THOUGHTFUL ROUTINE</span><h2>Good skincare starts with good information.</h2><p>Learn what is on your label, how to use a product, and when it may be time to ask a professional. Your skin is personal. The advice should be, too.</p><a className="text-link" href="#education">Explore the skin-safety guide <span>→</span></a><p className="safety-note">Beauty Face does not diagnose skin conditions. Camera-based screening is not available in this early release.</p><button className="text-link safety-report-link" onClick={() => setSafetyReportOpen(true)}>Report a product-safety concern <span>→</span></button></div></section>

      <section className="consult-banner content-width"><div><span className="eyebrow">HUMAN CARE, WHEN YOU NEED IT</span><h2>Have a skin question?</h2><p>We're preparing a network of licensed specialists. Join the pilot callback list while we build it carefully.</p><button className="light-button" onClick={() => setDialog('consult')}>Request a pilot callback <span>→</span></button></div><div className="consult-illustration"><span className="consult-ring ring-one"/><span className="consult-ring ring-two"/><span className="face-line">⌣</span><span className="face-spark">✦</span><span className="face-small-spark">✿</span></div></section>

      <section className="education-section content-width" id="education"><div className="section-heading"><div><span className="eyebrow">A LITTLE KNOWLEDGE, EVERY DAY</span><h2>Skincare, made simpler</h2></div>{articles.length === 0 && <span className="quiet-link">Coming soon <span>✦</span></span>}</div><div className="education-grid">{articles.length ? articles.slice(0, 3).map((article, index) => <button className={`education-card education-${['lilac','sun','green'][index]}`} key={article.id} onClick={() => setSelectedArticle(article)}><span className="education-no">{article.language.toUpperCase()} — GUIDE</span><div className="education-doodle">{['Aa','✳','♡'][index]}</div><h3>{article.title}</h3><p>{article.excerpt}</p><span className="read-more">Read guide ↗</span></button>) : <><article className="education-card education-lilac"><span className="education-no">01 — LABELS</span><div className="education-doodle">Aa</div><h3>How to read a product label</h3><p>Start with ingredients, directions, and what the package actually says.</p><span className="read-more">Coming soon ↗</span></article><article className="education-card education-sun"><span className="education-no">02 — INGREDIENTS</span><div className="education-doodle">✳</div><h3>Get to know your ingredients</h3><p>A calm, plain-language guide to the words on your skincare shelf.</p><span className="read-more">Coming soon ↗</span></article><article className="education-card education-green"><span className="education-no">03 — WHEN TO ASK</span><div className="education-doodle">♡</div><h3>When a professional can help</h3><p>Some concerns are best discussed with a licensed skin specialist.</p><span className="read-more">Coming soon ↗</span></article></>}</div></section>
    </main>

    <footer className="site-footer"><div className="footer-top"><a className="brand footer-brand" href="#top"><BrandMark/><span>beauty<span className="brand-light">face</span></span></a><p>Everyday care, with a little more understanding.</p>{siteSettings.supportPhone && <a className="back-top" href={`tel:${siteSettings.supportPhone}`}>Support {siteSettings.supportPhone}</a>}<a className="back-top" href="#top">Back to top ↑</a></div><div className="footer-bottom"><span>© 2026 Beauty Face · Ethiopia</span><span>Care information is educational and not a diagnosis.</span><span className="footer-language">English <span>⌄</span></span></div></footer>

    {dialog === 'cart' && <CartDrawer cart={cart} setCart={setCart} onClose={() => setDialog('')} onCheckout={startCheckout}/>}
    {dialog === 'checkout' && <CheckoutDialog cart={cart} cities={deliveryCities} fees={deliveryFees} onClose={() => setDialog('')} onOrder={beginPayment}/>}
    {dialog === 'consult' && <ConsultationDialog cities={deliveryCities} onClose={() => setDialog('')}/>}
    {selectedProduct && <ProductDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart}/>}
    {selectedArticle && <ArticleDialog article={selectedArticle} onClose={() => setSelectedArticle(null)}/>}
    {safetyReportOpen && <SafetyReportDialog products={products} onClose={() => setSafetyReportOpen(false)}/>}
  </>;
}
