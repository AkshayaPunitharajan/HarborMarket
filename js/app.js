const PER = 8, CREDIT_DEFAULT_NOTE = 1000;
const $app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const toast = m => { $('#toast').text(m).addClass('show'); setTimeout(() => $('#toast').removeClass('show'), 2600); };
const cart = { get: () => JSON.parse(localStorage.getItem('cart') || '[]'), set: c => localStorage.setItem('cart', JSON.stringify(c)) };
const uid = p => p + Date.now().toString(36).toUpperCase();
const hue = s => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const modal = html => $('#modal').html(`<div class="card">${html}</div>`).prop('hidden', false);
const closeModal = () => $('#modal').prop('hidden', true).empty();
$('#modal').on('click', e => { if (e.target.id === 'modal') closeModal(); });
const fail = e => toast(e.message || e);
const shrink = (file, max = 480) => new Promise((res, rej) => {
  if (!file.type.startsWith('image/')) return rej(new Error('Choose an image file'));
  if (file.size > 8e6) return rej(new Error('Image is over 8 MB'));
  const r = new FileReader();
  r.onload = () => { const im = new Image();
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .72)); };
    im.onerror = () => rej(new Error('Could not read that image')); im.src = r.result; };
  r.readAsDataURL(file);
});
const V = { email: e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), mob: m => /^[6-9]\d{9}$/.test(m) };

// ---------- NAV / ROUTER ----------
function nav() {
  const u = FB.user(), h = location.hash;
  const a = (href, t) => `<a href="${href}" class="${h.startsWith(href) ? 'on' : ''}">${t}</a>`;
  let x = '';
  if (!u) x = a('#/shop', 'Shop') + a('#/login', 'Sign in');
  else if (FB.isAdmin()) x = a('#/admin/inventory', 'Inventory') + a('#/admin/categories', 'Categories') + a('#/admin/customers', 'Customers') + a('#/admin/reports', 'Reports');
  else x = a('#/shop', 'Shop') + a('#/cart', `Cart (${cart.get().reduce((s, i) => s + i.qty, 0)})`) + a('#/orders', 'Orders');
  if (u) x += `<button id="out">Sign out (${esc(u.email)})</button>`;
  $('#nav').html(x);
}
$(document).on('click', '#out', () => { FB.signOut(); location.hash = '#/login'; });

const routes = {
  '#/login': viewLogin, '#/signup': viewSignup, '#/reset': viewReset, '#/shop': viewShop, '#/cart': viewCart, '#/orders': viewOrders,
  '#/admin/inventory': viewInventory, '#/admin/categories': viewCategories, '#/admin/customers': viewCustomers, '#/admin/reports': viewReports
};
function route() {
  const h = location.hash || '#/shop', u = FB.user();
  const priv = ['#/cart', '#/orders'].includes(h), adm = h.startsWith('#/admin');
  if ((priv || adm) && !u) return location.hash = '#/login';
  if (adm && !FB.isAdmin()) return location.hash = '#/shop';
  if (u && FB.isAdmin() && ['#/shop', '#/cart', '#/orders', '#/login', '#/signup'].includes(h)) return location.hash = '#/admin/inventory';
  $app.off(); nav(); closeModal();
  (routes[h] || viewShop)().catch(fail);
}
$(window).on('hashchange', route);

// ---------- AUTH ----------
async function viewLogin() {
  $app.html(`<div class="card auth"><h2>Welcome back</h2><p class="mut">Sign in to shop or manage the store.</p>
  <label>Email</label><input id="em" type="email" autocomplete="username">
  <label>Password</label><input id="pw" type="password" autocomplete="current-password">
  <p class="err" id="er"></p><div class="row"><button class="btn" id="go">Sign in</button><span class="sp"></span><a href="#/reset">Forgot password?</a></div>
  <p class="mut">New here? <a href="#/signup">Create an account</a></p></div>`);
  $('#go').on('click', async () => {
    const e = $('#em').val().trim(), p = $('#pw').val();
    if (!V.email(e)) return $('#er').text('Enter a valid email address.');
    if (!p) return $('#er').text('Enter your password.');
    try { await FB.signIn(e, p); location.hash = FB.isAdmin() ? '#/admin/inventory' : '#/shop'; route(); }
    catch (x) { $('#er').text(x.message.replace(/_/g, ' ').toLowerCase()); }
  });
}
async function viewSignup() {
  $app.html(`<div class="card auth"><h2>Create your account</h2>
  <label>Full name</label><input id="nm"><label>Email</label><input id="em" type="email">
  <label>Mobile</label><input id="mb" inputmode="numeric" maxlength="10"><label>Password (min 6)</label><input id="pw" type="password" autocomplete="new-password">
  <p class="err" id="er"></p><button class="btn" id="go">Sign up</button><p class="mut">Have an account? <a href="#/login">Sign in</a></p></div>`);
  $('#go').on('click', async () => {
    const nm = $('#nm').val().trim(), em = $('#em').val().trim(), mb = $('#mb').val().trim(), pw = $('#pw').val();
    if (nm.length < 2) return $('#er').text('Enter your full name.');
    if (!V.email(em)) return $('#er').text('Enter a valid email address.');
    if (!V.mob(mb)) return $('#er').text('Mobile must be 10 digits.');
    if (pw.length < 6) return $('#er').text('Password needs at least 6 characters.');
    try {
      const s = await FB.signUp(em, pw);
      if (!FB.isAdmin()) await FB.create('customers', s.uid, { name: nm, email: em, mob: mb, creditLimit: 0, creditUsed: 0, createdAt: new Date().toISOString() });
      toast('Account created'); location.hash = FB.isAdmin() ? '#/admin/inventory' : '#/shop'; route();
    } catch (x) { $('#er').text(x.message.replace(/_/g, ' ').toLowerCase()); }
  });
}
async function viewReset() {
  $app.html(`<div class="card auth"><h2>Reset password</h2><p class="mut">We'll email you a reset link.</p>
  <label>Email</label><input id="em" type="email"><p class="err" id="er"></p><button class="btn" id="go">Send link</button> <a href="#/login">Back</a></div>`);
  $('#go').on('click', async () => {
    const e = $('#em').val().trim(); if (!V.email(e)) return $('#er').text('Enter a valid email address.');
    try { await FB.reset(e); toast('Reset link sent. Check your inbox.'); } catch (x) { $('#er').text(x.message.replace(/_/g, ' ').toLowerCase()); }
  });
}

// ---------- PAGINATION HELPER ----------
const pager = (page, hasNext) => `<div class="pager"><button class="btn ghost sm" data-pg="${page - 1}" ${page ? '' : 'disabled'}>Previous</button><span class="mut">Page ${page + 1}</span><button class="btn ghost sm" data-pg="${page + 1}" ${hasNext ? '' : 'disabled'}>Next</button></div>`;
async function page(cat, pg, activeOnly) {
  const where = []; if (cat) where.push(['catId', cat]); if (activeOnly) where.push(['active', true]);
  const rows = await FB.query('products', { where, limit: PER + 1, offset: pg * PER });
  return { rows: rows.slice(0, PER), next: rows.length > PER };
}

// ---------- CUSTOMER: SHOP ----------
let shop = { cat: '', pg: 0, q: '' };
async function viewShop() {
  const cats = await FB.all('categories');
  $app.html(`<div class="row"><h1 class="sp">Shop</h1><input id="q" placeholder="Search products" style="max-width:260px" value="${esc(shop.q)}">
  <select id="cat" style="max-width:200px"><option value="">All categories</option>${cats.map(c => `<option value="${esc(c.id)}" ${shop.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
  <div id="list" class="grid" style="margin-top:1rem"></div><div id="pg"></div>`);
  const load = async () => {
    let r;
    if (shop.q) { const all = (await FB.query('products', { where: shop.cat ? [['catId', shop.cat], ['active', true]] : [['active', true]] })).filter(p => (p.title + p.des).toLowerCase().includes(shop.q.toLowerCase())); r = { rows: all.slice(shop.pg * PER, shop.pg * PER + PER), next: all.length > (shop.pg + 1) * PER }; }
    else r = await page(shop.cat, shop.pg, true);
    $('#list').html(r.rows.map(p => `<div class="card prod">${p.img ? `<img class="pimg" src="${p.img}" alt="${esc(p.title)}">` : `<div class="tag" style="background:hsl(${hue(p.title)} 55% 42%)">${esc(p.title[0])}</div>`}
      <strong>${esc(p.title)}</strong><span class="mut">${esc(p.des)}</span><div class="row"><span class="price">${money(p.price)}</span><span class="sp"></span><span class="mut">${p.qty > 0 ? p.qty + ' left' : 'Out of stock'}</span></div>
      <div class="row"><input type="number" min="1" max="${p.qty}" value="1" id="q_${esc(p.id)}"><button class="btn sm sp" data-add="${esc(p.id)}" ${p.qty < 1 ? 'disabled' : ''}>Add to cart</button></div></div>`).join('') || '<p class="mut">Nothing matches. Try another category or search.</p>');
    $('#pg').html(pager(shop.pg, r.next));
    window._rows = r.rows;
  };
  $('#cat').on('change', e => { shop.cat = e.target.value; shop.pg = 0; load().catch(fail); });
  $('#q').on('change', e => { shop.q = e.target.value.trim(); shop.pg = 0; load().catch(fail); });
  $app.on('click', '[data-pg]', function () { shop.pg = +$(this).data('pg'); load().catch(fail); });
  $app.on('click', '[data-add]', function () {
    if (!FB.user()) return location.hash = '#/login';
    const id = $(this).data('add'), p = window._rows.find(x => x.id === id), q = +$('#q_' + id.replace(/([^\w-])/g, '\\$1')).val();
    if (!(q >= 1 && q <= p.qty)) return toast(`Choose between 1 and ${p.qty}`);
    const c = cart.get(), l = c.find(i => i.id === id);
    if (l) l.qty = Math.min(l.qty + q, p.qty); else c.push({ id, title: p.title, price: p.price, catId: p.catId, qty: q });
    cart.set(c); nav(); toast('Added to cart');
  });
  await load();
}

// ---------- CUSTOMER: CART & CHECKOUT ----------
async function viewCart() {
  const c = cart.get(), total = c.reduce((s, i) => s + i.price * i.qty, 0);
  const me = await FB.get('customers', FB.user().uid); const avail = me.creditLimit - me.creditUsed;
  if (!c.length) return $app.html('<div class="card"><h2>Your cart is empty</h2><a class="btn" href="#/shop">Browse products</a></div>');
  $app.html(`<h1>Cart</h1><div class="card wrap"><table><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr>
  ${c.map((i, n) => `<tr><td>${esc(i.title)}</td><td>${money(i.price)}</td><td>${i.qty}</td><td>${money(i.price * i.qty)}</td><td><button class="btn bad sm" data-rm="${n}">Remove</button></td></tr>`).join('')}
  <tr><th colspan="3">Total</th><th colspan="2">${money(total)}</th></tr></table></div>
  <div class="card" style="margin-top:1rem"><h3>Payment</h3><label><input type="radio" name="pay" value="cash" checked style="width:auto"> Cash</label>
  <label><input type="radio" name="pay" value="credit" style="width:auto"> Credit limit <span class="mut">(available ${money(avail)})</span></label>
  <p class="err" id="er"></p><button class="btn" id="buy">Place order</button></div>`);
  $app.on('click', '[data-rm]', function () { const c2 = cart.get(); c2.splice(+$(this).data('rm'), 1); cart.set(c2); route(); });
  $('#buy').on('click', async function () {
    const pay = $('[name=pay]:checked').val(); if (pay === 'credit' && total > avail) return $('#er').text('Total is above your available credit.');
    $(this).prop('disabled', true);
    try {
      for (const i of c) { const p = await FB.get('products', i.id); if (!p.active || p.qty < i.qty) throw new Error(`${i.title}: only ${p.qty} in stock`); }
      const o = { customerId: me.id, customerName: me.name, email: me.email, payment: pay, total, createdAt: new Date().toISOString(),
        items: c.map(i => ({ id: i.id, title: i.title, catId: i.catId, price: i.price, qty: i.qty, amount: i.price * i.qty })) };
      const id = uid('ORD'); await FB.create('orders', id, o);
      for (const i of c) { const p = await FB.get('products', i.id); await FB.update('products', i.id, { qty: p.qty - i.qty }); }
      if (pay === 'credit') await FB.update('customers', me.id, { creditUsed: me.creditUsed + total });
      cart.set([]); nav(); bill({ id, ...o }); $app.html('<div class="card"><h2>Order placed</h2><a class="btn" href="#/orders">View order history</a></div>');
    } catch (e) { $('#er').text(e.message); $(this).prop('disabled', false); }
  });
}
function bill(o) {
  modal(`<h2>Bill · ${esc(o.id)}</h2><p class="mut">${new Date(o.createdAt).toLocaleString()} · ${esc(o.customerName)} · paid by ${o.payment}</p>
  <table>${o.items.map(i => `<tr><td>${esc(i.title)} × ${i.qty}</td><td>${money(i.amount)}</td></tr>`).join('')}<tr><th>Total</th><th>${money(o.total)}</th></tr></table>
  <div class="row no-print" style="margin-top:1rem"><button class="btn" onclick="print()">Print</button><button class="btn ghost" onclick="closeModal()">Close</button></div>`);
}
async function viewOrders() {
  const os = (await FB.query('orders', { where: [['customerId', FB.user().uid]] })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  window._os = os;
  $app.html(`<h1>Order history</h1><div class="card wrap"><table><tr><th>Order</th><th>Date</th><th>Payment</th><th>Total</th><th></th></tr>
  ${os.map(o => `<tr><td>${o.id}</td><td>${new Date(o.createdAt).toLocaleDateString()}</td><td>${o.payment}</td><td>${money(o.total)}</td><td><button class="btn ghost sm" data-bill="${o.id}">Bill</button></td></tr>`).join('') || '<tr><td colspan=5 class="mut">No orders yet.</td></tr>'}</table></div>`);
  $app.on('click', '[data-bill]', function () { bill(window._os.find(o => o.id === $(this).data('bill'))); });
}

// ---------- ADMIN: INVENTORY ----------
let inv = { cat: '', pg: 0 };
async function viewInventory() {
  const cats = await FB.all('categories'), cn = id => (cats.find(c => c.id === id) || {}).name || id;
  $app.html(`<div class="row"><h1 class="sp">Inventory</h1><select id="cat" style="max-width:200px"><option value="">All categories</option>${cats.map(c => `<option value="${esc(c.id)}" ${inv.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
  <input id="one" placeholder="Find by item id" style="max-width:170px"><button class="btn ghost" id="bulk">Import sample catalogue</button><button class="btn" id="add">New item</button></div>
  <div class="card wrap" style="margin-top:1rem"><table id="t"></table></div><div id="pg"></div>`);
  const draw = (rows, next, paged = true) => {
    window._inv = rows;
    $('#t').html(`<tr><th></th><th>Id</th><th>Category</th><th>Title</th><th>Qty</th><th>Price</th><th>Status</th><th></th></tr>` + rows.map(p => `<tr><td>${p.img ? `<img class="thumb" src="${p.img}" alt="">` : ''}</td><td>${esc(p.id)}</td><td>${esc(cn(p.catId))}</td><td>${esc(p.title)}</td><td>${p.qty}</td><td>${money(p.price)}</td>
      <td><span class="pill ${p.active ? 'ok' : 'off'}">${p.active ? 'Active' : 'Inactive'}</span></td>
      <td class="row"><button class="btn ghost sm" data-ed="${esc(p.id)}">Edit</button><button class="btn ghost sm" data-tg="${esc(p.id)}">${p.active ? 'Deactivate' : 'Activate'}</button><button class="btn bad sm" data-dl="${esc(p.id)}">Delete</button></td></tr>`).join('') || '<tr><td class="mut">No items.</td></tr>');
    $('#pg').html(paged ? pager(inv.pg, next) : '');
  };
  const load = async () => { const r = await page(inv.cat, inv.pg, false); draw(r.rows, r.next); };
  const form = (p = {}) => {
    const edit = !!p.id;
    modal(`<h2>${edit ? 'Edit item' : 'New item'}</h2><label>Id (blank = auto)</label><input id="f_id" value="${esc(p.id)}" ${edit ? 'disabled' : ''}>
    <label>Category</label><select id="f_cat">${cats.map(c => `<option value="${esc(c.id)}" ${p.catId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label>Title</label><input id="f_t" value="${esc(p.title)}"><label>Description</label><textarea id="f_d" rows="3">${esc(p.des)}</textarea>
    <label>Image</label><input id="f_img" type="file" accept="image/*"><img id="prev" alt="" src="${p.img || ''}" style="max-width:140px;margin-top:.5rem;border-radius:8px;${p.img ? '' : 'display:none'}">
    <div class="row"><div><label>Quantity</label><input id="f_q" type="number" min="0" value="${p.qty ?? 0}"></div><div><label>Price</label><input id="f_p" type="number" min="0" step="0.01" value="${p.price ?? 0}"></div></div>
    <p class="err" id="er"></p><div class="row"><button class="btn" id="sv">Save</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>`);
    let newImg = null;
    $('#f_img').on('change', async e => { const f = e.target.files[0]; if (!f) return;
      try { newImg = await shrink(f); $('#prev').attr('src', newImg).show(); $('#er').text(''); } catch (x) { newImg = null; $('#er').text(x.message); } });
    $('#sv').on('click', async () => {
      const d = { catId: $('#f_cat').val(), title: $('#f_t').val().trim(), des: $('#f_d').val().trim(), qty: parseInt($('#f_q').val()), price: parseFloat($('#f_p').val()) };
      if (!d.catId) return $('#er').text('Create a category first.'); if (d.title.length < 2) return $('#er').text('Title is required.');
      if (!(d.qty >= 0) || !(d.price >= 0)) return $('#er').text('Quantity and price must be 0 or more.');
      try { if (edit) await FB.update('products', p.id, newImg ? { ...d, img: newImg } : d); else await FB.create('products', $('#f_id').val().trim() || uid('P'), { ...d, img: newImg || '', active: true }); closeModal(); toast('Saved'); await load(); } catch (e) { $('#er').text(e.message); }
    });
  };
  $('#cat').on('change', e => { inv.cat = e.target.value; inv.pg = 0; load().catch(fail); });
  $('#add').on('click', () => form());
  $('#bulk').on('click', () => {
    modal(`<h2>Import sample catalogue?</h2>
      <p>This adds up to 8 sample categories and 40 sample products, each with a sample illustration.</p>
      <p>Existing categories with the same name and products with the same title in that category are skipped. Existing records are not overwritten.</p>
      <p class="mut" id="bulkStatus">Your Firestore database will be updated after you confirm.</p>
      <p class="err" id="bulkError"></p>
      <div class="row"><button class="btn" id="runBulk">Start import</button><button class="btn ghost" id="cancelBulk">Cancel</button></div>`);
    $('#cancelBulk').on('click', closeModal);
    $('#runBulk').on('click', async () => {
      $('#runBulk').prop('disabled', true).text('Importing…');
      $('#cancelBulk').prop('disabled', true);
      $('#bulkStatus').text('Connecting to Firestore…');
      try {
        const result = await window.SampleCatalogue.import(progress => {
          if (progress.stage === 'categories') $('#bulkStatus').text(`Preparing categories: ${progress.added} added`);
          else $('#bulkStatus').text(`Importing products: ${progress.done}/${progress.total} checked; ${progress.added} added`);
        });
        $('#bulkStatus').text(`Completed. Categories added: ${result.categoriesAdded}. Products added: ${result.productsAdded}. Products skipped: ${result.productsSkipped}.`);
        $('#runBulk').text('Completed');
        toast('Sample catalogue import completed');
        await load();
      } catch (e) {
        $('#bulkError').text(e.message || String(e));
        $('#bulkStatus').text('Import stopped. Items already added remain in Firestore; run again to continue safely.');
        $('#runBulk').prop('disabled', false).text('Retry / continue');
        $('#cancelBulk').prop('disabled', false);
      }
    });
  });
  $('#one').on('change', async e => { const v = e.target.value.trim(); if (!v) return load(); try { draw([await FB.get('products', v)], false, false); } catch { draw([], false, false); toast('No item with that id'); } });
  $app.on('click', '[data-pg]', function () { inv.pg = +$(this).data('pg'); load().catch(fail); });
  $app.on('click', '[data-ed]', function () { form(window._inv.find(p => p.id === $(this).data('ed'))); });
  $app.on('click', '[data-tg]', async function () { const p = window._inv.find(x => x.id === $(this).data('tg')); try { await FB.update('products', p.id, { active: !p.active }); await load(); } catch (e) { fail(e); } });
  $app.on('click', '[data-dl]', function () {
    const id = $(this).data('dl');
    modal(`<h2>Delete item?</h2><p>This permanently removes <strong>${esc(id)}</strong>.</p><div class="row"><button class="btn bad" id="yes">Yes, delete</button><button class="btn ghost" onclick="closeModal()">No</button></div>`);
    $('#yes').on('click', async () => { try { await FB.remove('products', id); closeModal(); toast('Deleted'); await load(); } catch (e) { fail(e); } });
  });
  await load();
}

// ---------- ADMIN: CATEGORIES ----------
async function viewCategories() {
  const cats = await FB.all('categories');
  $app.html(`<h1>Categories</h1><div class="card row"><input id="cid" placeholder="Id (e.g. C01)" style="max-width:140px"><input id="cnm" placeholder="Name" style="max-width:260px"><button class="btn" id="ad">Add category</button></div>
  <div class="card wrap" style="margin-top:1rem"><table><tr><th>Id</th><th>Name</th><th></th></tr>${cats.map(c => `<tr><td>${esc(c.id)}</td><td><input value="${esc(c.name)}" data-cn="${esc(c.id)}"></td><td><button class="btn bad sm" data-cd="${esc(c.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan=3 class="mut">Add your first category.</td></tr>'}</table></div>`);
  $('#ad').on('click', async () => { const id = $('#cid').val().trim(), n = $('#cnm').val().trim(); if (!id || n.length < 2) return toast('Id and name are required');
    try { await FB.create('categories', id, { name: n }); route(); } catch (e) { fail(e); } });
  $app.on('change', '[data-cn]', async function () { try { await FB.update('categories', $(this).data('cn'), { name: this.value.trim() }); toast('Renamed'); } catch (e) { fail(e); } });
  $app.on('click', '[data-cd]', async function () { if (!confirm('Delete this category?')) return; try { await FB.remove('categories', $(this).data('cd')); route(); } catch (e) { fail(e); } });
}

// ---------- ADMIN: CUSTOMERS & CREDIT LIMIT ----------
async function viewCustomers() {
  const cs = await FB.all('customers');
  $app.html(`<h1>Customers</h1><p class="mut">Set each customer's credit limit (your brief suggests ${money(CREDIT_DEFAULT_NOTE)}). New customers start at ₹0.</p>
  <div class="card wrap"><table><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Credit limit</th><th>Used</th><th></th></tr>
  ${cs.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.mob)}</td><td><input type="number" min="0" value="${c.creditLimit}" id="cl_${c.id}"></td><td>${money(c.creditUsed)}</td>
  <td class="row"><button class="btn sm" data-cl="${c.id}">Save</button><button class="btn bad sm" data-cx="${c.id}">Reset limit</button></td></tr>`).join('') || '<tr><td colspan=6 class="mut">No customers yet.</td></tr>'}</table></div>`);
  $app.on('click', '[data-cl]', async function () { const v = parseFloat($('#cl_' + $(this).data('cl')).val()); if (!(v >= 0)) return toast('Enter 0 or more');
    try { await FB.update('customers', $(this).data('cl'), { creditLimit: v }); toast('Credit limit saved'); } catch (e) { fail(e); } });
  $app.on('click', '[data-cx]', async function () { try { await FB.update('customers', $(this).data('cx'), { creditLimit: 0 }); route(); } catch (e) { fail(e); } });
}

// ---------- ADMIN: REPORTS ----------
async function viewReports() {
  const [cats, prods, custs, orders] = await Promise.all([FB.all('categories'), FB.query('products', { limit: 1000, select: ['catId', 'title', 'qty', 'price', 'active'] }), FB.all('customers'), FB.all('orders')]);
  const cn = id => (cats.find(c => c.id === id) || {}).name || id;
  const sum = (a, k) => a.reduce((s, x) => s + x[k], 0);
  const group = (rows, key, f) => Object.values(rows.reduce((m, r) => ((m[key(r)] ||= { k: key(r), qty: 0, amt: 0, n: 0 }), m[key(r)].qty += r.qty || 0, m[key(r)].amt += r.amount ?? r.total, m[key(r)].n++, m), {}));
  const inRange = (f, t) => orders.filter(o => o.createdAt.slice(0, 10) >= f && o.createdAt.slice(0, 10) <= t);
  const lines = os => os.flatMap(o => o.items.map(i => ({ ...i, payment: o.payment, date: o.createdAt.slice(0, 10), order: o.id, customer: o.customerName })));
  const T = (h, r) => `<table><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${r.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td class="mut">No data.</td></tr>`}</table>`;
  const sales = (os, f) => T(['Date', 'Order', 'Customer', 'Item', 'Category', 'Qty', 'Amount'], lines(os).filter(f || (() => true)).map(l => [l.date, l.order, l.customer, l.title, cn(l.catId), l.qty, money(l.amount)]));
  const ord = (os) => T(['Date', 'Order', 'Customer', 'Payment', 'Total'], os.map(o => [o.createdAt.slice(0, 10), o.id, o.customerName, o.payment, money(o.total)]));
  const R = {
    'Customers: all': { d: 0, f: () => T(['Name', 'Email', 'Mobile', 'Credit limit', 'Credit used'], custs.map(c => [c.name, c.email, c.mob, money(c.creditLimit), money(c.creditUsed)])) },
    'Customers: top 10 by spend': { d: 1, f: (a, b) => T(['Customer', 'Orders', 'Spent'], group(inRange(a, b), o => o.customerName).sort((x, y) => y.amt - x.amt).slice(0, 10).map(g => [g.k, g.n, money(g.amt)])) },
    'Customers: cash purchases': { d: 1, f: (a, b) => ord(inRange(a, b).filter(o => o.payment === 'cash')) },
    'Customers: credit purchases': { d: 1, f: (a, b) => ord(inRange(a, b).filter(o => o.payment === 'credit')) },
    'Inventory: current stock': { d: 0, f: () => T(['Id', 'Title', 'Category', 'Qty'], prods.map(p => [p.id, p.title, cn(p.catId), p.qty])) },
    'Inventory: by category': { d: 0, f: () => T(['Category', 'Items', 'Units in stock'], group(prods.map(p => ({ ...p, amount: p.qty })), p => cn(p.catId)).map(g => [g.k, g.n, g.amt])) },
    'Inventory: high stock (> 100)': { d: 0, f: () => T(['Id', 'Title', 'Qty'], prods.filter(p => p.qty > 100).map(p => [p.id, p.title, p.qty])) },
    'Inventory: low stock (< 15)': { d: 0, f: () => T(['Id', 'Title', 'Qty'], prods.filter(p => p.qty < 15).map(p => [p.id, p.title, p.qty])) },
    'Sales: all': { d: 1, f: (a, b) => sales(inRange(a, b)) },
    'Sales: by category': { d: 1, f: (a, b) => T(['Category', 'Units', 'Revenue'], group(lines(inRange(a, b)), l => cn(l.catId)).map(g => [g.k, g.qty, money(g.amt)])) },
    'Sales: cash': { d: 1, f: (a, b) => sales(inRange(a, b), l => l.payment === 'cash') },
    'Sales: credit': { d: 1, f: (a, b) => sales(inRange(a, b), l => l.payment === 'credit') },
    'Sales: top 10 items': { d: 1, f: (a, b) => T(['Item', 'Units', 'Revenue'], group(lines(inRange(a, b)), l => l.title).sort((x, y) => y.qty - x.qty).slice(0, 10).map(g => [g.k, g.qty, money(g.amt)])) },
    'Sales: bottom 10 items': { d: 1, f: (a, b) => T(['Item', 'Units', 'Revenue'], group(lines(inRange(a, b)), l => l.title).sort((x, y) => x.qty - y.qty).slice(0, 10).map(g => [g.k, g.qty, money(g.amt)])) }
  };
  const today = new Date().toISOString().slice(0, 10);
  $app.html(`<h1>Reports</h1><div class="card row"><select id="rp" style="max-width:260px">${Object.keys(R).map(k => `<option>${k}</option>`).join('')}</select>
  <span id="dr" class="row"><label style="margin:0">From</label><input type="date" id="fr" value="${today.slice(0, 8)}01" style="width:auto"><label style="margin:0">To</label><input type="date" id="to" value="${today}" style="width:auto"></span>
  <button class="btn" id="run">Run report</button><button class="btn ghost no-print" onclick="print()">Print</button></div>
  <div class="card wrap" id="out" style="margin-top:1rem"></div>`);
  const run = () => { const r = R[$('#rp').val()]; $('#dr').toggle(!!r.d); $('#out').html(r.f($('#fr').val(), $('#to').val())); };
  $('#rp').on('change', run); $('#run').on('click', run); run();
}

route();
