/* Marquinho Modas: protótipo local, sem servidor, pagamentos ou autenticação de produção. */
(() => {
  'use strict';
  const C = window.StoreCore, A=window.StoreAdmin, products = window.PRODUCTS, $ = id => document.getElementById(id), esc = C.escapeHTML;
  const PREFIX = 'mm_demo_v2_', DEMO = {id:'demo',name:'Cliente de demonstração',email:'cliente@example.com',phone:'16999990000',demo:true};
  const PATHS = {
    user:'M20 21v-2a7 7 0 0 0-14 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    bag:'M5 7h14l1 14H4L5 7Z M8 8V6a4 4 0 0 1 8 0v2',
    arrow:'M5 12h14 M13 6l6 6-6 6',close:'M6 6l12 12 M18 6 6 18',plus:'M5 12h14 M12 5v14',
    pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    truck:'M1 4h13v13H1V4Z M14 8h4l4 5v4h-8 M8 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    search:'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',check:'M5 12l4 4L19 6',
    admin:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z M8 12l3 3 5-6',menu:'M4 6h16 M4 12h16 M4 18h16'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name] || PATHS.bag}"/></svg>`;
  function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  let storage, session, storageUnavailable = false;
  try { storage = window.localStorage; } catch (_) { storageUnavailable = true; }
  try { session = window.sessionStorage; } catch (_) { /* in-memory session */ }
  const read = (key, fallback) => C.safeRead(storage, PREFIX + key, fallback);
  function persist(key, value) {
    try { if (!storage) throw new Error(); storage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (_) { if (!storageUnavailable) toast('Armazenamento indisponível: os dados ficarão apenas nesta página.'); storageUnavailable = true; return false; }
  }
  const validUser = u => u && typeof u.id==='string' && u.id.length<100 && !Object.keys(C.validateProfile(u,false)).length && typeof u.salt==='string' && typeof u.hash==='string' && /^[a-f0-9]{32}$/.test(u.salt) && /^[a-f0-9]{64}$/.test(u.hash);
  let users = read('users', []); users = Array.isArray(users) ? users.filter(validUser).slice(0,100) : [];
  let cart = C.sanitizeCart(read('cart', []), products);
  function validOrder(o) {
    return o && typeof o.id==='string' && /^MM-[A-Z0-9-]+$/.test(o.id) && typeof o.userId==='string' && typeof o.name==='string' && typeof o.email==='string' && (o.phone===undefined||typeof o.phone==='string') && typeof o.date==='string' && Number.isFinite(Date.parse(o.date)) && ['pickup','delivery'].includes(o.delivery) && ['pix','card'].includes(o.payment) && Array.isArray(o.items) && o.items.length>0 && o.items.every(i=>i && typeof i.name==='string' && typeof i.size==='string' && Number.isSafeInteger(i.price) && i.price>=0 && Number.isInteger(i.qty) && i.qty>0 && i.qty<=10) && Number.isSafeInteger(o.subtotal) && Number.isSafeInteger(o.shipping) && o.shipping===(o.delivery==='pickup'?0:1500) && o.subtotal===o.items.reduce((s,i)=>s+i.price*i.qty,0) && o.total===o.subtotal+o.shipping && typeof o.address==='string';
  }
  let orders = read('orders', []); orders = Array.isArray(orders) ? orders.filter(validOrder).slice(0,200) : [];
  const savedSession = C.safeRead(session, PREFIX+'session', null);
  let user = savedSession==='demo' ? DEMO : users.find(u=>u.id===savedSession) || null;
  let category='Todos', currentProduct=null, chosenSize='', authTab='login', resumeCheckout=false, submitting=false, authBusy=false, authAttempt=0, toastTimer;
  const unsavedOrders=new Set();
  let adminTab='orders', adminDelivery='all', adminStatus='all', adminQuery='', adminUnlocked=false, managedOrder=null, lastNewCount=A.countNew(orders);
  const adminDetail=document.createElement('dialog');adminDetail.id='admin-order-dialog';adminDetail.className='admin-order-dialog';adminDetail.setAttribute('aria-labelledby','admin-order-title');adminDetail.innerHTML='<button class="close" data-close aria-label="Fechar gestão do pedido">'+icon('close')+'</button><div id="admin-order-content"></div>';document.body.appendChild(adminDetail);
  let cepController, cepSequence=0, cepBusy=false, verifiedAddress=null;
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function toast(message) { const box=$('toast'); box.textContent=message; box.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>box.hidden=true,4500); }
  function showDialog(id) { const dialog=$(id); if(!dialog.open) dialog.showModal(); document.body.style.overflow='hidden'; }
  function hideDialog(id) { if($(id).open) $(id).close(); }
  function closeEffects(dialog) {
    if(dialog.id==='auth-dialog') { authAttempt++; resumeCheckout=false; $('auth-password').value=''; $('auth-password').type='password';const toggle=document.querySelector('[data-action="password"]');toggle.textContent='Mostrar';toggle.setAttribute('aria-label','Mostrar senha'); }
    if(dialog.id==='checkout-dialog') cancelCep();
    if(dialog.id==='admin-dialog') lockAdmin();
    if(dialog.id==='admin-login-dialog'){$('admin-password').value='';$('admin-login-error').textContent='';}
    if(dialog.id==='admin-order-dialog'){$('admin-order-content').replaceChildren();managedOrder=null;}
    if(!document.querySelector('dialog[open]')) document.body.style.overflow='';
  }
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>closeEffects(dialog));
    dialog.addEventListener('click',e=>{ if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();} });
  });
  function greeting() { $('greeting').textContent=user ? user.name.split(' ')[0] : 'Minha conta'; refreshAdmin(); }
  function renderProducts() {
    const search=normalize($('search').value.trim());
    let visible=products.filter(p=>(category==='Todos'||category===p.category||(category==='Promocoes'&&p.oldPrice))&&normalize(p.name+' '+p.category).includes(search));
    const sort=$('sort').value;
    if(sort==='price-asc')visible.sort((a,b)=>a.price-b.price);
    if(sort==='price-desc')visible.sort((a,b)=>b.price-a.price);
    if(sort==='name')visible.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    $('results').textContent=`${visible.length} ${visible.length===1?'peça selecionada':'peças selecionadas'}`;
    $('product-grid').innerHTML=visible.length ? visible.map(p=>`<article class="product-card"><button class="product-image-button" data-product="${p.id}" aria-label="Ver ${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)} — foto ilustrativa" style="object-position:${p.position}" loading="lazy" width="600" height="800">${p.oldPrice?`<span class="product-badge">−${Math.round((1-p.price/p.oldPrice)*100)}% NA PRÉVIA</span>`:''}<span class="view-product">${icon('plus')}</span></button><div class="product-info"><p class="product-category">${esc(p.category)}</p><h3><button class="product-name" data-product="${p.id}">${esc(p.name)}</button></h3><div class="price-line"><span class="price">${C.money(p.price)}</span>${p.oldPrice?`<span class="old-price">${C.money(p.oldPrice)}</span>`:''}</div><p class="product-sizes">Tamanhos ${p.sizes.join(' · ')}</p><button class="product-choose" data-product="${p.id}">Escolher tamanho ${icon('plus')}</button></div></article>`).join('') : `<div class="empty-state">${icon('search')}<h3>Nenhuma peça por aqui.</h3><p>Tente outra palavra ou explore toda a coleção.</p><button class="button secondary" data-action="clear-filters">Ver toda a coleção</button></div>`;
    document.querySelectorAll('.categories [data-category]').forEach(b=>{const active=b.dataset.category===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  }
  function openProduct(id) {
    currentProduct=products.find(p=>p.id===id); if(!currentProduct)return;
    chosenSize=''; const p=currentProduct;
    $('detail-content').innerHTML=`<div class="product-detail-layout"><div><div class="gallery-stage"><img id="gallery-image" src="${esc(p.image)}" alt="${esc(p.name)} — foto completa" style="object-position:${p.position}"><span class="gallery-label" id="gallery-label">Foto completa</span></div><div class="thumbnails" role="group" aria-label="Visualizações da foto">${['Foto completa','Ampliação da foto','Detalhe da foto'].map((name,i)=>`<button class="thumbnail ${i===0?'active':''}" data-gallery="${i}" aria-label="${name}" aria-pressed="${i===0}"><span><img src="${esc(p.image)}" alt="" style="transform:scale(${[1,1.45,1.9][i]});object-position:${p.position}"></span></button>`).join('')}</div><p class="gallery-note">Imagem ilustrativa. As miniaturas ampliam a mesma fotografia.</p></div><div class="detail-info"><p class="eyebrow">${esc(p.category)}</p><h2 id="detail-title">${esc(p.name)}</h2><div class="price-line"><span class="price">${C.money(p.price)}</span>${p.oldPrice?`<span class="old-price">${C.money(p.oldPrice)}</span>`:''}</div><p class="detail-description">${esc(p.description)}</p><div class="size-label"><strong>Escolha seu tamanho</strong><span>Seleção obrigatória</span></div><div class="sizes" role="group" aria-label="Tamanhos disponíveis">${p.sizes.map(s=>`<button data-size="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join('')}</div><p id="size-error" class="inline-error" role="alert"></p><button class="button primary full" data-action="add">${icon('bag')} Adicionar à sacola</button><div class="detail-footer">${icon('pin')} Retirada grátis · entrega demonstrativa em Franca</div></div></div>`;
    showDialog('detail-dialog');
  }
  function updateCart(save=true) {
    cart=C.sanitizeCart(cart,products); if(save)persist('cart',cart);
    const totals=C.cartTotals(cart,products); $('cart-count').textContent=totals.quantity; $('bag-quantity').textContent=`(${totals.quantity})`;
    document.querySelector('.bag-trigger').setAttribute('aria-label',`Abrir sacola, ${totals.quantity} itens`);
    $('cart-content').innerHTML=cart.length ? cart.map(line=>{const p=products.find(p=>p.id===line.id);return `<article class="cart-item"><img src="${esc(p.image)}" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3><p>Tamanho ${esc(line.size)} · ${C.money(p.price)} cada</p><span class="line-total">${C.money(p.price*line.qty)}</span><div class="cart-item-bottom"><div class="qty-control"><button data-quantity="-1" data-id="${p.id}" data-item-size="${esc(line.size)}" aria-label="Diminuir quantidade de ${esc(p.name)}, tamanho ${esc(line.size)}">−</button><span aria-label="Quantidade">${line.qty}</span><button data-quantity="1" data-id="${p.id}" data-item-size="${esc(line.size)}" aria-label="Aumentar quantidade de ${esc(p.name)}, tamanho ${esc(line.size)}" ${line.qty>=10?'disabled':''}>+</button></div><button class="remove-item" data-remove="${p.id}" data-item-size="${esc(line.size)}" aria-label="Remover ${esc(p.name)}, tamanho ${esc(line.size)}">Remover</button></div></div></article>`;}).join('') : `<div class="empty-state">${icon('bag')}<h3>Sua próxima escolha começa aqui.</h3><p>Explore a coleção e guarde suas peças favoritas na sacola.</p><button class="button primary" data-action="continue-shopping">Explorar a coleção ${icon('arrow')}</button></div>`;
    $('cart-footer').hidden=!cart.length;
    $('cart-footer').innerHTML=`<div class="total-row"><span>Subtotal · ${totals.quantity} ${totals.quantity===1?'item':'itens'}</span><strong>${C.money(totals.subtotal)}</strong></div><p class="small muted">Retirada grátis. Entrega calculada na próxima etapa.</p><button class="button primary full" data-action="checkout">Continuar para o pedido ${icon('arrow')}</button><p class="small muted center">Pedido de demonstração · sem cobrança</p>`;
    if($('checkout-dialog').open)renderCheckoutSummary();
  }
  function switchAuth(tab) {
    authTab=tab; $('signup-fields').hidden=tab!=='signup'; $('consent-label').hidden=tab!=='signup';
    $('auth-submit').textContent=tab==='signup'?'Criar conta de demonstração':'Entrar';
    $('auth-password').autocomplete=tab==='signup'?'new-password':'current-password';
    document.querySelectorAll('[data-auth-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.authTab===tab);b.setAttribute('aria-pressed',String(b.dataset.authTab===tab));});clearAuthErrors();
  }
  function clearAuthErrors() { ['name','phone','email','password'].forEach(f=>{$('error-'+f).textContent='';$('auth-'+f).removeAttribute('aria-invalid');$('auth-'+f).setAttribute('aria-describedby','error-'+f);});$('auth-error').textContent=''; }
  function openAuth(forCheckout=false) { resumeCheckout=forCheckout;switchAuth('login');showDialog('auth-dialog');setTimeout(()=>$('auth-email').focus(),0); }
  async function passwordHash(password,salt) {
    if(!window.crypto?.subtle)throw new Error('Este navegador não oferece a criptografia necessária. Use o perfil de demonstração.');
    const bytes=new Uint8Array(salt.match(/.{2}/g).map(b=>parseInt(b,16)));
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const result=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:150000,hash:'SHA-256'},key,256);
    return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function login(nextUser) {
    lockAdmin();hideDialog('admin-dialog');hideDialog('admin-login-dialog');
    user=nextUser;try{session?.setItem(PREFIX+'session',JSON.stringify(user.id));}catch(_){}
    const continueCheckout=resumeCheckout;resumeCheckout=false;hideDialog('auth-dialog');greeting();
    $('auth-password').value='';toast(user.demo?'Perfil de demonstração pronto.':'Você entrou na sua conta de demonstração.');
    if(continueCheckout)openCheckout();else openAccount();
  }
  async function submitAuth(e) {
    e.preventDefault();if(authBusy)return;clearAuthErrors();
    const profile={name:$('auth-name').value.trim(),email:C.normalizeEmail($('auth-email').value),phone:C.normalizePhone($('auth-phone').value),password:$('auth-password').value};
    const errors=authTab==='signup'?C.validateProfile(profile):{};
    if(authTab==='login'){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))errors.email='Informe um e-mail válido.';if(!profile.password)errors.password='Informe sua senha de teste.';}
    if(Object.keys(errors).length){for(const [f,message] of Object.entries(errors)){$('error-'+f).textContent=message;$('auth-'+f).setAttribute('aria-invalid','true');}$('auth-'+Object.keys(errors)[0]).focus();return;}
    if(authTab==='signup'&&!$('auth-consent').checked){$('auth-error').textContent='Confirme que esta é uma conta local de demonstração.';$('auth-consent').focus();return;}
    authBusy=true;const attempt=++authAttempt;$('auth-submit').disabled=true;$('auth-submit').textContent='Aguarde…';
    document.querySelectorAll('[data-auth-tab],[data-action="demo-account"]').forEach(b=>b.disabled=true);
    try {
      if(authTab==='signup') {
        if(users.some(u=>u.email===profile.email))throw new Error('Este e-mail já está cadastrado neste navegador. Use a aba Entrar.');
        if(users.some(u=>u.phone===profile.phone))throw new Error('Este celular já está cadastrado neste navegador.');
        if(users.length>=100)throw new Error('Limite de contas da demonstração atingido. Use o perfil de demonstração.');
        const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
        const hash=await passwordHash(profile.password,salt);
        if(attempt!==authAttempt||!$('auth-dialog').open)return;
        const newUser={id:crypto.randomUUID(),name:profile.name,email:profile.email,phone:profile.phone,salt,hash};
        users.push(newUser);persist('users',users);login(newUser);
      } else {
        const match=users.find(u=>u.email===profile.email);
        if(!match||await passwordHash(profile.password,match.salt)!==match.hash)throw new Error('E-mail ou senha não conferem. Se ainda não tem conta, escolha Criar conta.');
        if(attempt===authAttempt&&$('auth-dialog').open)login(match);
      }
    }catch(error){if(attempt===authAttempt)$('auth-error').textContent=error.message;}finally{authBusy=false;$('auth-submit').disabled=false;$('auth-submit').textContent=authTab==='signup'?'Criar conta de demonstração':'Entrar';document.querySelectorAll('[data-auth-tab],[data-action="demo-account"]').forEach(b=>b.disabled=false);}
  }
  const dateLabel = iso => new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
  function openAccount() {
    if(!user){openAuth();return;}
    $('account-title').textContent=`Olá, ${user.name.split(' ')[0]}.`;
    const history=orders.filter(o=>o.userId===user.id);
    $('account-content').innerHTML=`<div class="account-details"><strong>${esc(user.name)}</strong><br>${esc(user.email)}<br><span class="muted">Perfil local ${user.demo?'de exemplo':'de demonstração'}</span></div><h3>Seus pedidos de teste</h3>${history.length?history.map(o=>`<div class="history-item"><div><h3>${esc(o.id)} · ${C.money(o.total)}</h3><p>${dateLabel(o.date)} · ${esc(A.labels[A.status(o)])}</p></div><button data-order="${esc(o.id)}">Ver resumo</button></div>`).join(''):'<p class="muted">Seu primeiro pedido de teste aparecerá aqui.</p>'}<button class="button secondary full logout" data-action="logout">Sair da conta</button>`;
    showDialog('account-dialog');
  }
  function openCheckout() {
    if(!cart.length){toast('Escolha uma peça antes de continuar.');return;}
    hideDialog('cart-dialog');
    if(!user){openAuth(true);return;}
    $('checkout-error').textContent='';renderCheckoutSummary();showDialog('checkout-dialog');
  }
  const delivery = () => document.querySelector('[name="delivery"]:checked').value;
  const payment = () => document.querySelector('[name="payment"]:checked').value;
  function summaryItems(items) { return items.map(i=>`<div class="summary-item"><div>${esc(i.name)}<small>Tamanho ${esc(i.size)} · Quantidade ${i.qty}</small></div><strong>${C.money(i.price*i.qty)}</strong></div>`).join(''); }
  function totalsHTML(t) { return `<div class="total-row"><span>Subtotal</span><span>${C.money(t.subtotal)}</span></div><div class="total-row"><span>Entrega ${t.shipping?'(simulada)':''}</span><span>${t.shipping?C.money(t.shipping):'Grátis'}</span></div><div class="total-row final"><span>Total</span><span>${C.money(t.total)}</span></div>`; }
  function cartSnapshot(){return cart.map(line=>{const p=products.find(p=>p.id===line.id);return {id:p.id,name:p.name,price:p.price,qty:line.qty,size:line.size};});}
  function renderCheckoutSummary(){const t=C.cartTotals(cart,products,delivery());$('checkout-summary').innerHTML=summaryItems(cartSnapshot())+`<p class="summary-client">Pedido de ${esc(user?.name||'visitante')}</p>`+totalsHTML(t);}
  function cancelCep(){cepController?.abort();cepSequence++;cepBusy=false;$('cep-button').disabled=false;$('cep-button').textContent='Consultar';}
  function invalidateCep(){cancelCep();verifiedAddress=null;$('cep-status').textContent='Consulte o CEP novamente para confirmar a entrega.';$('address-city').value='Franca / SP';}
  async function lookupCep(){
    const cep=$('address-cep').value.replace(/\D/g,'');cancelCep();verifiedAddress=null;
    if(cep.length!==8){$('cep-status').textContent='Digite um CEP com 8 dígitos.';$('address-cep').focus();return;}
    const sequence=++cepSequence;cepController=new AbortController();const controller=cepController;cepBusy=true;$('cep-button').disabled=true;$('cep-button').textContent='Buscando…';$('cep-status').textContent='Consultando o endereço…';
    const timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(`https://viacep.com.br/ws/${cep}/json/`,{signal:controller.signal});
      if(!response.ok)throw new Error();const data=await response.json();
      if(sequence!==cepSequence||delivery()!=='delivery'||!$('checkout-dialog').open)return;
      if(data.erro){$('cep-status').textContent='CEP não encontrado. Confira os números.';return;}
      if(normalize(data.localidade)!=='franca'||data.uf!=='SP'){$('cep-status').textContent='A entrega desta prévia está disponível apenas em Franca, SP.';return;}
      verifiedAddress={cep,city:'Franca',state:'SP',example:false};$('address-street').value=data.logradouro||'';$('address-neighborhood').value=data.bairro||'';$('address-city').value='Franca / SP';$('cep-status').textContent='CEP confirmado. Complete o número e confira o endereço.';$('address-number').focus();
    }catch(_){if(sequence===cepSequence)$('cep-status').textContent='Não foi possível consultar agora. Tente novamente ou use o endereço fictício para testar.';}
    finally{clearTimeout(timeout);if(sequence===cepSequence){cepBusy=false;$('cep-button').disabled=false;$('cep-button').textContent='Consultar';}}
  }
  function addressValues(){return {cep:$('address-cep').value,validatedCep:verifiedAddress?.cep,city:verifiedAddress?.city,state:verifiedAddress?.state,street:$('address-street').value.trim(),number:$('address-number').value.trim(),neighborhood:$('address-neighborhood').value.trim(),complement:$('address-complement').value.trim()};}
  function submitCheckout(e){
    e.preventDefault();if(submitting)return;$('checkout-error').textContent='';
    if(cepBusy){$('checkout-error').textContent='Aguarde a consulta do CEP terminar.';return;}
    const a=addressValues(),mode=delivery();cart=C.sanitizeCart(cart,products);
    const errors=C.checkoutErrors({cart,products,user,delivery:mode,address:a});
    if(!['pix','card'].includes(payment()))errors.payment='Escolha uma forma de pagamento.';
    if(Object.keys(errors).length){$('checkout-error').textContent=Object.values(errors)[0];const f=Object.keys(errors)[0];const el=$('address-'+f);if(el)el.focus();return;}
    submitting=true;$('checkout-submit').disabled=true;
    const totals=C.cartTotals(cart,products,mode);
    const id='MM-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
    const order={id,userId:user.id,name:user.name,email:user.email,phone:user.phone,date:new Date().toISOString(),items:cartSnapshot(),delivery:mode,payment:payment(),address:mode==='pickup'?'Retirada na loja em Franca, SP':`${a.street}, ${a.number}${a.complement?' · '+a.complement:''} — ${a.neighborhood}, Franca/SP · CEP ${a.cep}${verifiedAddress?.example?' (endereço fictício)':''}`,...totals,status:'Demonstração — sem cobrança',fulfillment:'new',paymentConfirmed:false,history:[]};
    orders.unshift(order);orders=orders.slice(0,200);if(persist('orders',orders))unsavedOrders.clear();else unsavedOrders.add(id);refreshAdmin(true);cart=[];persist('cart',cart);updateCart(false);hideDialog('checkout-dialog');showOrder(id);
    $('checkout-form').reset();$('address-fields').hidden=true;verifiedAddress=null;$('cep-status').textContent='Consulte um CEP de Franca, SP.';submitting=false;$('checkout-submit').disabled=false;
  }
  function showOrder(id){
    const o=orders.find(o=>o.id===id);if(!o)return;
    $('order-content').innerHTML=`<div class="success-symbol">${icon('check')}</div><p class="eyebrow">EXPERIÊNCIA CONCLUÍDA</p><h2 id="order-title">Seu pedido de teste está pronto.</h2><p class="order-code">${esc(o.id)} · ${dateLabel(o.date)}</p><span class="status-pill">Demonstração · sem cobrança</span><div class="receipt-details"><strong>Cliente</strong>${esc(o.name)}<strong>${o.delivery==='pickup'?'Retirada':'Entrega'}</strong>${esc(o.address)}<strong>Preferência de pagamento</strong>${o.payment==='pix'?'Pix a combinar com a loja':'Cartão no recebimento'}</div>${summaryItems(o.items)}${totalsHTML(o)}<p class="muted small">Este resumo foi salvo neste navegador. Nenhum pedido foi enviado à loja e nenhum pagamento foi processado.</p><div class="order-actions"><button class="button secondary" data-copy-order="${esc(o.id)}">Copiar resumo</button><button class="button primary" data-close>Continuar explorando ${icon('arrow')}</button></div><div id="copy-fallback" hidden><label class="muted" for="copy-text">Selecione e copie o resumo abaixo:</label><textarea id="copy-text" rows="8" readonly></textarea></div>`;
    const fulfillment=document.createElement('p');fulfillment.className='order-progress-note';fulfillment.textContent='Acompanhamento: '+A.labels[A.status(o)];$('order-content').querySelector('.status-pill').after(fulfillment);
    if(unsavedOrders.has(id)){const notice=$('order-content').querySelector('.muted.small');notice.textContent='O navegador não conseguiu salvar este pedido. Ele está disponível somente nesta página: copie o resumo antes de sair. Nenhuma cobrança foi realizada.';notice.className='demo-notice';}
    showDialog('order-dialog');
  }
  function orderText(o){return `MARQUINHO MODAS — DEMONSTRAÇÃO\n${o.id}\nCliente: ${o.name}\n${o.items.map(i=>`${i.qty}x ${i.name} · tamanho ${i.size} · ${C.money(i.qty*i.price)}`).join('\n')}\nSubtotal: ${C.money(o.subtotal)}\nFrete simulado: ${C.money(o.shipping)}\nTotal: ${C.money(o.total)}\nRecebimento: ${o.address}\nPagamento: ${o.payment==='pix'?'Pix a combinar':'Cartão no recebimento'}\nSem cobrança, reserva ou envio à loja.`;}
  async function copyOrder(id){const o=orders.find(o=>o.id===id);if(!o)return;const text=orderText(o);try{await navigator.clipboard.writeText(text);toast('Resumo de demonstração copiado.');}catch(_){$('copy-fallback').hidden=false;$('copy-text').value=text;$('copy-text').focus();$('copy-text').select();}}
  function refreshAdmin(announce=false){
    const allowed=A.isStoreOwner(user), count=A.countNew(orders), badge=$('admin-new-count');
    if(badge){badge.textContent=String(allowed?count:0);badge.hidden=!allowed||count===0;badge.setAttribute('aria-label',`${allowed?count:0} pedidos novos`);}
    document.querySelectorAll('[data-action="admin"]').forEach(b=>{b.hidden=!allowed;b.setAttribute('aria-label',`Área do administrador${allowed&&count?', '+count+(count===1?' pedido novo':' pedidos novos'):''}`);});
    if(!allowed){lockAdmin();hideDialog('admin-dialog');hideDialog('admin-login-dialog');}
    if(allowed&&announce&&count>lastNewCount)toast(`${count} ${count===1?'pedido novo para conferir no painel do lojista.':'pedidos novos para conferir no painel do lojista.'}`);
    lastNewCount=count;if($('admin-dialog').open)renderAdmin();if($('admin-order-dialog').open&&managedOrder)renderAdminOrder(managedOrder);
  }
  function renderAdmin() {
    if (!A.isStoreOwner(user) || !adminUnlocked) return;
    const counts = Object.fromEntries(Object.keys(A.labels).map(key => [key, orders.filter(o => A.status(o) === key).length]));
    const matchesQuery = text => normalize(text).includes(normalize(adminQuery));
    const visible = orders.filter(o => (adminDelivery === 'all' || o.delivery === adminDelivery) && (adminStatus === 'all' || A.status(o) === adminStatus || (adminStatus === 'progress' && ['preparing', 'ready'].includes(A.status(o)))) && matchesQuery([o.id, o.name, o.email, o.phone || ''].join(' ')));
    const clients = users.filter(u => matchesQuery([u.name, u.email, u.phone].join(' ')));
    const statusTabs = [['all', 'Todos'], ['new', 'Novos'], ['preparing', 'Em preparação'], ['ready', 'Prontos'], ['dispatched', 'Em entrega'], ['completed', 'Concluídos'], ['cancelled', 'Cancelados']];
    const stats = [
      {title:'Novos pedidos', value:counts.new, detail:'Aguardando sua atenção', filter:'new'},
      {title:'Em preparação', value:counts.preparing + counts.ready, detail:'Em separação ou prontos', filter:'progress'},
      {title:'Em entrega', value:counts.dispatched, detail:'Já saíram com o entregador', filter:'dispatched'},
      {title:'Concluídos', value:counts.completed, detail:'Entregues ou retirados', filter:'completed'}
    ];
    $('admin-content').innerHTML = `
      <div class="admin-tabs" role="group" aria-label="Visão do administrador">
        <button data-admin-tab="orders" class="${adminTab === 'orders' ? 'active' : ''}" aria-pressed="${adminTab === 'orders'}">${icon('bag')} Pedidos <span class="tab-count">${orders.length}</span></button>
        <button data-admin-tab="users" class="${adminTab === 'users' ? 'active' : ''}" aria-pressed="${adminTab === 'users'}">${icon('user')} Clientes <span class="tab-count">${users.length}</span></button>
      </div>
      ${adminTab === 'orders' ? `
        <div class="admin-stats" aria-label="Resumo dos pedidos">
          ${stats.map(s => `<button class="admin-stat ${s.filter === 'new' ? 'new-stat' : ''}" data-admin-summary="${s.filter}" aria-label="${s.title}: ${s.value}"><span class="stat-label">${s.title}</span><strong class="stat-value">${s.value}</strong><small class="stat-description">${s.detail}</small></button>`).join('')}
        </div>` : ''}
      <div class="admin-toolbar">
        <label class="admin-search">${icon('search')}<input id="admin-search" type="search" placeholder="${adminTab === 'orders' ? 'Buscar por pedido ou cliente' : 'Buscar por nome, e-mail ou celular'}" value="${esc(adminQuery)}" maxlength="100" aria-label="${adminTab === 'orders' ? 'Buscar pedidos' : 'Buscar clientes'}"></label>
        ${adminTab === 'orders' ? `<label class="admin-delivery-label">Recebimento<select id="admin-delivery-filter"><option value="all">Entrega e retirada</option><option value="delivery">Somente entregas</option><option value="pickup">Somente retiradas</option></select></label>` : `<span class="admin-client-total">${users.length} ${users.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}</span>`}
      </div>
      ${adminTab === 'orders' ? `
        <div class="admin-status-tabs" role="group" aria-label="Filtrar pedidos por situação">
          ${statusTabs.map(([key, label]) => `<button data-admin-status="${key}" aria-pressed="${adminStatus === key}" class="${adminStatus === key ? 'active' : ''}">${label}${key === 'new' && counts.new ? `<span class="new-filter-count">${counts.new}</span>` : ''}</button>`).join('')}
          ${adminStatus === 'progress' ? '<button data-admin-status="progress" aria-pressed="true" class="active">Em preparação + prontos</button>' : ''}
        </div>
        <p class="admin-list-meta" role="status">${visible.length} ${visible.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}${adminStatus === 'new' ? ' · Inicie a preparação para retirar do alerta de novos pedidos.' : ''}</p>
        <div class="admin-list-head" aria-hidden="true"><span>Pedido</span><span>Cliente / situação</span><span>Recebimento</span><span>Total</span><span></span></div>
        <div class="admin-order-list">
          ${visible.length ? visible.map(o => `<article class="admin-order-row ${A.status(o) === 'new' ? 'is-new' : ''}">
            <div class="order-reference"><strong>${esc(o.id)}</strong><small>${dateLabel(o.date)}</small></div>
            <div class="order-client"><strong>${esc(o.name)}</strong><span class="fulfillment-pill status-${A.status(o)}">${esc(A.labels[A.status(o)])}</span></div>
            <div class="order-delivery">${icon(o.delivery === 'delivery' ? 'truck' : 'bag')}<span>${o.delivery === 'delivery' ? 'Entrega local' : 'Retirada na loja'}</span></div>
            <strong class="order-amount">${C.money(o.total)}</strong>
            <button class="button secondary" data-manage-order="${esc(o.id)}" aria-label="Abrir pedido ${esc(o.id)}">Abrir pedido ${icon('arrow')}</button>
          </article>`).join('') : `<div class="empty-state">${icon('bag')}<h3>${orders.length ? 'Nenhum pedido neste filtro.' : 'Os pedidos novos aparecem aqui.'}</h3><p>${orders.length ? 'Ajuste a busca ou escolha outra situação.' : 'Conclua um pedido de teste na loja para acompanhar a preparação e a entrega.'}</p></div>`}
        </div>` : `
        <p class="admin-list-meta" role="status">${clients.length} ${clients.length === 1 ? 'cliente encontrado' : 'clientes encontrados'} · Perfis rápidos de demonstração não criam cadastro.</p>
        <div class="admin-client-list">${clients.length ? clients.map(u => `<article class="admin-client"><div class="client-avatar" aria-hidden="true">${esc(u.name.charAt(0).toUpperCase())}</div><div class="client-profile"><strong>${esc(u.name)}</strong><p>${esc(u.email)}</p><p>${esc(u.phone)}</p></div><div class="client-order-count"><strong>${orders.filter(o => o.userId === u.id).length}</strong><span>pedidos</span></div></article>`).join('') : '<div class="empty-state"><h3>Nenhum cliente encontrado.</h3><p>Os cadastros de teste aparecerão nesta lista.</p></div>'}</div>`}`;
    if (adminTab === 'orders') {
      $('admin-delivery-filter').value = adminDelivery;
      $('admin-delivery-filter').addEventListener('change', e => { adminDelivery = e.target.value; renderAdmin(); $('admin-delivery-filter').focus(); });
    }
    $('admin-search').addEventListener('input', e => {
      adminQuery = e.target.value;
      const start = e.target.selectionStart;
      renderAdmin();
      $('admin-search').focus();
      if (start !== null) $('admin-search').setSelectionRange(start, start);
    });
  }
  function openAdmin() {
    if (!A.isStoreOwner(user)) return;
    hideDialog('account-dialog');
    if (adminUnlocked) { renderAdmin(); showDialog('admin-dialog'); return; }
    $('admin-password').value = '';
    $('admin-login-error').textContent = '';
    $('admin-password').removeAttribute('aria-invalid');
    showDialog('admin-login-dialog');
    $('admin-password').focus();
  }
  function lockAdmin() {
    adminUnlocked = false;
    managedOrder = null;
    hideDialog('admin-order-dialog');
    $('admin-order-content').replaceChildren();
    $('admin-content').replaceChildren();
  }
  function submitAdminAccess(e) {
    e.preventDefault();
    if (!A.isStoreOwner(user)) { lockAdmin(); hideDialog('admin-login-dialog'); return; }
    if ($('admin-password').value !== 'admin123') {
      $('admin-login-error').textContent = 'Senha incorreta. Confira e tente novamente.';
      $('admin-password').setAttribute('aria-invalid', 'true');
      $('admin-password').focus();
      return;
    }
    adminUnlocked = true;
    $('admin-password').value = '';
    hideDialog('admin-login-dialog');
    adminTab = 'orders'; adminStatus = 'all'; adminDelivery = 'all'; adminQuery = '';
    renderAdmin();
    showDialog('admin-dialog');
  }

  function renderAdminOrder(id){
    if(!A.isStoreOwner(user)||!adminUnlocked)return;
    const o=orders.find(o=>o.id===id);if(!o)return;
    managedOrder=id;const state=A.status(o),next=A.transitions(o),history=Array.isArray(o.history)?o.history.filter(h=>h&&typeof h.date==='string'&&Number.isFinite(Date.parse(h.date))&&typeof h.status==='string'&&Object.hasOwn(A.labels,h.status)):[];
    $('admin-order-content').innerHTML=`<p class="eyebrow">GESTÃO DO PEDIDO · DEMONSTRAÇÃO</p><h2 id="admin-order-title">${esc(o.id)}</h2><div class="admin-detail-heading"><span class="fulfillment-pill status-${state}">${esc(A.labels[state])}</span><span class="muted small">${dateLabel(o.date)}</span></div><div class="admin-customer"><div><span>Cliente</span><strong>${esc(o.name)}</strong><p>${esc(o.email)}${o.phone?'<br>'+esc(o.phone):''}</p></div><div><span>${o.delivery==='delivery'?'Endereço de entrega':'Recebimento'}</span><strong>${esc(o.address)}</strong></div></div>${summaryItems(o.items)}${totalsHTML(o)}<div class="dispatch-guide"><h3>${icon(o.delivery==='delivery'?'truck':'bag')} ${o.delivery==='delivery'?'Preparar e despachar':'Preparar para retirada'}</h3><p>${o.delivery==='delivery'?'Confira o pagamento com o cliente, separe as peças e chame o Uber ou o entregador por fora do site. Depois de entregar o pacote ao motorista, registre o despacho abaixo.':'Confira a preferência de pagamento, prepare as peças e avise o cliente. Registre a retirada quando o pedido for entregue na loja.'}</p><p class="small muted">Preferência: ${o.payment==='pix'?'Pix a combinar':'cartão no recebimento'}. O site não confirma pagamento nem solicita corridas.</p></div><div class="admin-next-actions">${next.filter(s=>s!=='cancelled').map(s=>`<button class="button primary full" data-transition="${s}" data-order-id="${esc(o.id)}">${esc(A.actionLabel(o,s))} ${icon('arrow')}</button>`).join('')}${next.includes('cancelled')?`<details class="cancel-order"><summary>Cancelar este pedido de teste</summary><p>O pedido ficará cancelado e sairá da contagem de novos pedidos. Esta ação encerra o fluxo deste pedido.</p><button class="button danger" data-transition="cancelled" data-order-id="${esc(o.id)}">Confirmar cancelamento</button></details>`:''}${!next.length?`<p class="demo-notice">${state==='completed'?'Pedido concluído.':'Pedido cancelado.'} O registro continua disponível no histórico.</p>`:''}</div><div class="admin-history"><h3>Histórico do pedido</h3><p><span class="history-dot"></span> ${dateLabel(o.date)} · Novo pedido de teste</p>${history.map(h=>`<p><span class="history-dot"></span> ${dateLabel(h.date)} · ${esc(A.labels[h.status])}</p>`).join('')}</div><p class="small muted" id="admin-save-status">${unsavedOrders.has(id)?'Alterações disponíveis somente nesta página. Copie os dados antes de sair.':'Acompanhamento salvo neste navegador.'}</p>`;
  }
  function manageOrder(id){if(!A.isStoreOwner(user)||!adminUnlocked){openAdmin();return;}renderAdminOrder(id);showDialog('admin-order-dialog');}
  function transitionOrder(id,next){
    if(!A.isStoreOwner(user)||!adminUnlocked)return;
    const index=orders.findIndex(o=>o.id===id);if(index<0)return;
    try{const changed=A.transition(orders[index],next);const history=Array.isArray(orders[index].history)?orders[index].history:[];changed.history=[...history,{date:changed.updatedAt,status:next}].slice(-10);orders[index]=changed;if(persist('orders',orders))unsavedOrders.clear();else unsavedOrders.add(id);refreshAdmin();renderAdminOrder(id);$('admin-order-title').tabIndex=-1;$('admin-order-title').focus();toast(A.labels[next]+'.');}catch(error){toast(error.message);}
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('button,a');if(!button)return;
    if(button.hasAttribute('data-close')){button.closest('dialog').close();return;}
    if(button.dataset.category){category=button.dataset.category;renderProducts();return;}
    if(button.dataset.product){openProduct(button.dataset.product);return;}
    if(button.dataset.gallery){const i=Number(button.dataset.gallery);const names=['Foto completa','Ampliação da foto','Detalhe da foto'];$('gallery-image').style.transform=`scale(${[1,1.45,1.9][i]})`;$('gallery-image').alt=currentProduct.name+' — '+names[i];$('gallery-label').textContent=names[i];document.querySelectorAll('[data-gallery]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});return;}
    if(button.dataset.size){chosenSize=button.dataset.size;document.querySelectorAll('[data-size]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});$('size-error').textContent='';return;}
    if(button.dataset.quantity){try{cart=C.changeQuantity(cart,products,button.dataset.id,button.dataset.itemSize,Number(button.dataset.quantity));const selector=`[data-quantity="${button.dataset.quantity}"][data-id="${button.dataset.id}"][data-item-size="${button.dataset.itemSize}"]:not(:disabled)`;updateCart();(document.querySelector(selector)||document.querySelector('#cart-content [data-quantity]:not(:disabled)')||$('cart-title')).focus();}catch(error){toast(error.message);}return;}
    if(button.dataset.remove){cart=cart.filter(i=>!(i.id===button.dataset.remove&&i.size===button.dataset.itemSize));updateCart();(document.querySelector('#cart-content [data-quantity]')||$('cart-title')).focus();toast('Peça removida da sacola.');return;}
    if(button.dataset.authTab){switchAuth(button.dataset.authTab);return;}
    if(button.dataset.order){showOrder(button.dataset.order);return;}
    if(button.dataset.copyOrder){copyOrder(button.dataset.copyOrder);return;}
    if(button.dataset.adminTab){if(!A.isStoreOwner(user)||!adminUnlocked)return;adminTab=button.dataset.adminTab;adminQuery='';renderAdmin();document.querySelector(`[data-admin-tab="${adminTab}"]`).focus();return;}
    if(button.dataset.adminStatus||button.dataset.adminSummary){if(!A.isStoreOwner(user)||!adminUnlocked)return;adminStatus=button.dataset.adminStatus||button.dataset.adminSummary;renderAdmin();(document.querySelector(`[data-admin-status="${adminStatus}"]`)||document.querySelector(`[data-admin-summary="${adminStatus}"]`))?.focus();return;}
    if(button.dataset.manageOrder){manageOrder(button.dataset.manageOrder);return;}
    if(button.dataset.transition){transitionOrder(button.dataset.orderId,button.dataset.transition);return;}
    switch(button.dataset.action){
      case 'about':showDialog('info-dialog');break;
      case 'admin':openAdmin();break;
      case 'admin-logout':lockAdmin();hideDialog('admin-dialog');break;
      case 'account':openAccount();break;
      case 'cart':updateCart(false);showDialog('cart-dialog');break;
      case 'continue-shopping':hideDialog('cart-dialog');$('catalogo').scrollIntoView();break;
      case 'clear-filters':category='Todos';$('search').value='';$('sort').value='featured';renderProducts();break;
      case 'add':try{cart=C.addItem(cart,products,currentProduct.id,chosenSize);updateCart();hideDialog('detail-dialog');showDialog('cart-dialog');toast('Sua escolha foi adicionada à sacola.');}catch(error){$('size-error').textContent=error.message;document.querySelector('[data-size]')?.focus();}break;
      case 'checkout':openCheckout();break;
      case 'demo-account':if(!authBusy)login(DEMO);break;
      case 'password':{const show=$('auth-password').type==='password';$('auth-password').type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');break;}
      case 'logout':user=null;try{session?.removeItem(PREFIX+'session');}catch(_){}greeting();hideDialog('account-dialog');toast('Você saiu da conta. Sua sacola continua aqui.');break;
      case 'lookup-cep':lookupCep();break;
      case 'demo-address':cancelCep();verifiedAddress={cep:'14400000',city:'Franca',state:'SP',example:true};$('address-cep').value='14400-000';$('address-street').value='Rua de Demonstração';$('address-number').value='123';$('address-neighborhood').value='Bairro de Exemplo';$('address-complement').value='';$('address-city').value='Franca / SP';$('cep-status').textContent='Endereço fictício preenchido apenas para testar o fluxo.';break;
    }
  });
  document.addEventListener('error',e=>{
    if(e.target.tagName!=='IMG'||e.target.dataset.fallback)return;e.target.dataset.fallback='true';
    e.target.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#eeeee6"/><text x="300" y="360" text-anchor="middle" font-family="Georgia" font-size="65" fill="#9b8760">MM</text><text x="300" y="415" text-anchor="middle" font-family="Arial" font-size="18" fill="#77796d">Imagem indisponível</text></svg>');
  },true);
  $('admin-access-form').addEventListener('submit',submitAdminAccess);
  $('search').addEventListener('input',renderProducts);$('sort').addEventListener('change',renderProducts);$('auth-form').addEventListener('submit',submitAuth);$('checkout-form').addEventListener('submit',submitCheckout);
  document.querySelectorAll('[name="delivery"]').forEach(radio=>radio.addEventListener('change',()=>{cancelCep();$('address-fields').hidden=delivery()==='pickup';$('checkout-error').textContent='';renderCheckoutSummary();}));
  $('address-cep').addEventListener('input',()=>{const digits=$('address-cep').value.replace(/\D/g,'').slice(0,8);$('address-cep').value=digits.length>5?digits.slice(0,5)+'-'+digits.slice(5):digits;invalidateCep();});
  window.addEventListener('storage',e=>{
    if(e.key===PREFIX+'cart'){cart=C.sanitizeCart(read('cart',[]),products);updateCart(false);}
    if(e.key===PREFIX+'users'){const saved=read('users',[]);users=Array.isArray(saved)?saved.filter(validUser):[];if(user&&!user.demo){user=users.find(u=>u.id===user.id)||null;greeting();}refreshAdmin();}
    if(e.key===PREFIX+'orders'){const saved=read('orders',[]);orders=Array.isArray(saved)?saved.filter(validOrder).slice(0,200):[];refreshAdmin(true);}
  });
  $('cart-title').tabIndex=-1;icons();renderProducts();updateCart(false);greeting();switchAuth('login');refreshAdmin();
  if(storageUnavailable)setTimeout(()=>toast('Dados disponíveis somente nesta página: armazenamento local indisponível.'),400);
})();
