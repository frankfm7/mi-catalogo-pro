const SUPABASE_URL = 'https://lwhcwqbplcnpywlqaxmx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_laEXA-Sw0jVSHnlHkrjYeg_uSffZt7U';

let supabaseClient = null;
try {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) { console.error('Supabase error:', e); }

const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3ebf9'/%3E%3Cg transform='translate(60,50)'%3E%3Crect x='10' y='30' width='60' height='50' rx='4' fill='%237c43ba' opacity='0.3'/%3E%3Cpath d='M0 30 L40 0 L80 30' fill='%237c43ba' opacity='0.5'/%3E%3Crect x='30' y='55' width='20' height='25' rx='2' fill='%237c43ba' opacity='0.6'/%3E%3Crect x='15' y='40' width='12' height='12' rx='1' fill='%237c43ba' opacity='0.4'/%3E%3Crect x='53' y='40' width='12' height='12' rx='1' fill='%237c43ba' opacity='0.4'/%3E%3C/g%3E%3Ctext x='100' y='140' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%237c43ba' opacity='0.6'%3ESin imagen%3E%3C/text%3E%3C/svg%3E";
const fallbackCover = "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80";

const state = {
  records: [], catalogs: [], sales: [],
  currentCatalogId: null, currentView: 'catalogs',
  query: "", globalQuery: "", cart: [],
  editing: null, detail: null, editingCatalogId: null,
  pendingImageFile: null, pendingCatalogImage: null,
  saleProduct: null, fabOpen: false, clientMode: false,
  contactInfo: null, isProcessing: false,
  darkMode: localStorage.getItem('dark_mode') === 'true',
  soundEnabled: localStorage.getItem('sound_enabled') !== 'false',
  isOnline: navigator.onLine,
  pendingChanges: JSON.parse(localStorage.getItem('pending_changes') || '[]'),
  isSyncing: false,
  currentUser: JSON.parse(localStorage.getItem('current_user') || 'null'),
  selectedPaymentMethod: 'Efec.',
  // NUEVO: Sistema de escaneo rápido tipo supermercado
  quickScanMode: false,
  quickScanItems: [],
  quickScanDiscount: 0
};

const $ = id => document.getElementById(id);
const DB_KEY = 'catalog_pro_data_v12';
const CONTACT_KEY = 'catalog_pro_contact_v12';
const QR_KEY = 'catalog_pro_qr_v12';
const PENDING_KEY = 'pending_changes';

function updateConnectionIndicator() {
  // Actualizar indicador en el sidebar
  let indicator = document.getElementById('connection-status');
  if (indicator) {
    if (state.isSyncing) {
      indicator.innerHTML = '<i data-lucide="refresh-cw" class="w-3 h-3 animate-spin"></i> <span>Sincronizando...</span>';
      indicator.className = 'text-xs text-blue-600 flex items-center gap-1';
    } else if (state.isOnline) {
      indicator.innerHTML = '<i data-lucide="wifi" class="w-3 h-3"></i> <span>En línea</span>';
      indicator.className = 'text-xs text-green-600 flex items-center gap-1';
    } else {
      indicator.innerHTML = '<i data-lucide="wifi-off" class="w-3 h-3"></i> <span>Sin internet</span>';
      indicator.className = 'text-xs text-orange-600 flex items-center gap-1';
    }
  }
  
  // Actualizar indicador en la parte superior
  let topIndicator = document.getElementById('connection-status-indicator');
  if (topIndicator) {
    if (state.isSyncing) {
      topIndicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse"></span><span class="text-[10px] text-blue-600 font-semibold">Sincronizando...</span>';
    } else if (state.isOnline) {
      topIndicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span><span class="text-[10px] text-green-600 font-semibold">En línea</span>';
    } else {
      topIndicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-orange-500 inline-block"></span><span class="text-[10px] text-orange-600 font-semibold">Modo offline</span>';
    }
  }
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.addEventListener('online', () => { 
  state.isOnline = true; 
  updateConnectionIndicator(); 
  updateOfflineBanner();
  toast('✅ Conexión restaurada'); 
  syncPendingChanges();
  
  // Sincronizar datos completos cuando vuelve la conexión
  setTimeout(() => {
    if (state.currentUser) {
      refreshData();
    }
  }, 2000);
});

window.addEventListener('offline', () => { 
  state.isOnline = false; 
  updateConnectionIndicator(); 
  updateOfflineBanner();
  toast('⚠️ Sin conexión. Modo offline activado.');
  
  // Guardar estado actual inmediatamente
  DB.saveLocal();
});

// Mostrar/ocultar banner offline
function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    if (state.isOnline) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Verificar conexión periódicamente
setInterval(() => {
  const wasOnline = state.isOnline;
  state.isOnline = navigator.onLine;
  
  if (wasOnline !== state.isOnline) {
    updateConnectionIndicator();
    if (state.isOnline) {
      toast('✅ Conexión restaurada');
      syncPendingChanges();
    } else {
      toast('⚠️ Sin conexión');
      DB.saveLocal();
    }
  }
}, 5000); // Verificar cada 5 segundos

function addToPendingChanges(action, data) {
  state.pendingChanges.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2, 6), action: action, data: data, timestamp: new Date().toISOString() });
  localStorage.setItem(PENDING_KEY, JSON.stringify(state.pendingChanges));
}

async function syncPendingChanges() {
  if (!supabaseClient || state.pendingChanges.length === 0 || state.isSyncing || !state.isOnline) {
    return;
  }
  
  state.isSyncing = true; 
  updateConnectionIndicator();
  
  const totalChanges = state.pendingChanges.length;
  let successCount = 0;
  let errorCount = 0;
  
  console.log(`🔄 Sincronizando ${totalChanges} cambios pendientes...`);
  
  try {
    const remainingChanges = [];
    
    for (const change of state.pendingChanges) {
      try {
        if (change.action === 'createProduct' || change.action === 'updateProduct') {
          await supabaseClient.from('products').upsert([change.data]);
        }
        else if (change.action === 'deleteProduct') {
          await supabaseClient.from('products').delete().eq('id', change.data);
        }
        else if (change.action === 'createCatalog' || change.action === 'updateCatalog') {
          await supabaseClient.from('catalogs').upsert([change.data]);
        }
        else if (change.action === 'deleteCatalog') {
          await supabaseClient.from('catalogs').delete().eq('id', change.data.id);
          await supabaseClient.from('products').delete().eq('catalog_id', change.data.id);
        }
        else if (change.action === 'addSale') {
          await supabaseClient.from('sales').upsert([change.data]);
        }
        
        successCount++;
      } catch (e) {
        console.error('Error sincronizando cambio:', change.action, e);
        errorCount++;
        // Mantener el cambio pendiente para intentar de nuevo después
        remainingChanges.push(change);
      }
    }
    
    // Guardar solo los cambios que fallaron
    state.pendingChanges = remainingChanges;
    localStorage.setItem(PENDING_KEY, JSON.stringify(state.pendingChanges));
    
    if (successCount > 0) {
      toast(`✅ ${successCount} cambios sincronizados`);
      console.log(`✅ ${successCount} cambios sincronizados exitosamente`);
    }
    
    if (errorCount > 0) {
      toast(`⚠️ ${errorCount} cambios pendientes de sincronizar`);
      console.log(`⚠️ ${errorCount} cambios fallaron y se reintentarán después`);
    }
    
  } catch (e) { 
    console.error('Error en sync:', e);
    toast('❌ Error al sincronizar');
  }
  
  state.isSyncing = false; 
  updateConnectionIndicator();
}

let supabasePingInterval = null;
async function keepSupabaseAlive() {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.from('catalogs').select('id').limit(1);
    if (!error) console.log('🏓 Ping a Supabase exitoso');
  } catch (e) { console.log('⚠️ Ping falló'); }
}
function startSupabasePing() {
  keepSupabaseAlive();
  if (supabasePingInterval) clearInterval(supabasePingInterval);
  supabasePingInterval = setInterval(keepSupabaseAlive, 3600000);
}

const SoundEffects = {
  play(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      if (type === 'success') { osc.frequency.value = 800; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2); }
      else if (type === 'error') { osc.frequency.value = 200; gain.gain.setValueAtTime(0.3, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3); }
      else if (type === 'click') { osc.frequency.value = 600; gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1); }
    } catch (e) {}
  }
};

function applyDarkMode() {
  document.body.classList.toggle('dark-mode', state.darkMode);
  const btn = document.querySelector('[data-action="toggle-dark-mode"]');
  if (btn) { btn.innerHTML = state.darkMode ? '<i data-lucide="sun" class="w-4 h-4"></i> Modo claro' : '<i data-lucide="moon" class="w-4 h-4"></i> Modo oscuro'; if (typeof lucide !== 'undefined') lucide.createIcons(); }
}
function toggleDarkMode() { state.darkMode = !state.darkMode; localStorage.setItem('dark_mode', state.darkMode); applyDarkMode(); toast(state.darkMode ? "Modo oscuro 🌙" : "Modo claro ☀️"); SoundEffects.play('click'); }

function applySoundState() {
  const btn = document.querySelector('[data-action="toggle-sound"]');
  if (btn) { btn.innerHTML = state.soundEnabled ? '<i data-lucide="volume-2" class="w-4 h-4"></i> Sonido activado' : '<i data-lucide="volume-x" class="w-4 h-4"></i> Sonido silenciado'; if (typeof lucide !== 'undefined') lucide.createIcons(); }
}
function toggleSound() { state.soundEnabled = !state.soundEnabled; localStorage.setItem('sound_enabled', state.soundEnabled); applySoundState(); toast(state.soundEnabled ? "🔊 Sonido activado" : "🔇 Sonido silenciado"); if (state.soundEnabled) SoundEffects.play('click'); }

function formatUSD(n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD'; }
function formatUSDShort(n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(fallback);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// BASE DE DATOS
// ==========================================
const DB = {
  async init() {
    let cachedData = null;
    try { cachedData = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); } catch(e) {}
    if (supabaseClient && state.isOnline) {
      try {
        const { data: cats } = await supabaseClient.from('catalogs').select('*');
        const { data: prods } = await supabaseClient.from('products').select('*');
        const { data: sales } = await supabaseClient.from('sales').select('*');
        if (cats && cats.length > 0) {
          state.catalogs = cats; state.records = prods || []; state.sales = sales || [];
          this.saveLocal(); renderAll();
        } else if (cachedData && cachedData.catalogs && cachedData.catalogs.length > 0) {
          state.catalogs = cachedData.catalogs; state.records = cachedData.records || []; state.sales = cachedData.sales || [];
          await this.syncToSupabase();
        } else { await this.seedData(); }
      } catch (e) {
        console.error("Error DB init:", e);
        if (cachedData && cachedData.catalogs) {
          state.catalogs = cachedData.catalogs; state.records = cachedData.records || []; state.sales = cachedData.sales || [];
          renderAll();
        }
      }
    } else {
      if (cachedData && cachedData.catalogs) {
        state.catalogs = cachedData.catalogs; state.records = cachedData.records || []; state.sales = cachedData.sales || [];
        renderAll();
      } else { await this.seedData(); }
    }
    const contactData = localStorage.getItem(CONTACT_KEY);
    if (contactData) state.contactInfo = JSON.parse(contactData);
  },
  saveLocal() { try { localStorage.setItem(DB_KEY, JSON.stringify({ catalogs: state.catalogs, records: state.records, sales: state.sales })); } catch (e) {} },
  async syncToSupabase() {
    if (!supabaseClient || !state.isOnline) { this.saveLocal(); return; }
    try {
      if (state.catalogs.length) await supabaseClient.from('catalogs').upsert(state.catalogs);
      if (state.records.length) await supabaseClient.from('products').upsert(state.records);
      if (state.sales.length) await supabaseClient.from('sales').upsert(state.sales);
    } catch (e) { console.error('Error sync:', e); }
    this.saveLocal();
  },
  async seedData() {
    const seedCats = [
      { id: 'cosmetics', name: 'Cosméticos y perfumes', label: 'BELLEZA', color: '#7c43ba', cover: fallbackCover, favorite: false },
      { id: 'electronics', name: 'Electrónicos', label: 'TECNOLOGÍA', color: '#3875a5', cover: 'https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg', favorite: false }
    ];
    const seedProds = [
      { id: '1', name: 'Labial Matte Rojo', brand: 'L\'BEL', type: 'Maquillaje', category: 'Labios', cost_price: 7, sale_price: 15, min_price: 13, stock: 10, sold: false, catalog_id: 'cosmetics', image_url: '', description: 'Labial de larga duración.', barcode: '', offer_text: '' },
      { id: '2', name: 'Audífonos Bluetooth', brand: 'Sony', type: 'Electrónico', category: 'Audio', cost_price: 22, sale_price: 42, min_price: 35, stock: 5, sold: false, catalog_id: 'electronics', image_url: '', description: 'Sonido de alta calidad.', barcode: '', offer_text: '' }
    ];
    state.catalogs = seedCats; state.records = seedProds; state.sales = [];
    if (supabaseClient && state.isOnline) { try { await supabaseClient.from('catalogs').upsert(seedCats); await supabaseClient.from('products').upsert(seedProds); } catch (e) {} }
    this.saveLocal();
  },
  async createRecord(data) {
    data.id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    if (!data.barcode) data.barcode = '';
    state.records.push(data); 
    this.saveLocal();
    
    if (supabaseClient && state.isOnline) {
      try {
        const { error } = await supabaseClient.from('products').upsert([data]);
        if (error) { 
          console.error('Error en Supabase:', error);
          addToPendingChanges('createProduct', data);
          if (!state.isOnline) {
            toast('💾 Guardado localmente (sin conexión)');
          }
        } else {
          console.log('✅ Producto guardado en la nube');
        }
      } catch(e) { 
        console.log('⚠️ Error de conexión, guardando localmente');
        addToPendingChanges('createProduct', data);
        if (!state.isOnline) {
          toast('💾 Guardado localmente (sin conexión)');
        }
      }
    } else { 
      addToPendingChanges('createProduct', data);
      if (!state.isOnline) {
        toast('💾 Guardado localmente (sin conexión)');
      }
    }
    return { isOk: true };
  },
  async updateRecord(data) {
    const idx = state.records.findIndex(x => x.id === data.id);
    if (idx !== -1) {
      state.records[idx] = { ...state.records[idx], ...data }; this.saveLocal();
      if (supabaseClient && state.isOnline) {
        try {
          const { error } = await supabaseClient.from('products').upsert([state.records[idx]]);
          if (error) addToPendingChanges('updateProduct', state.records[idx]);
        } catch(e) { addToPendingChanges('updateProduct', state.records[idx]); }
      } else { addToPendingChanges('updateProduct', state.records[idx]); }
      return { isOk: true };
    }
    return { isOk: false };
  },
  async deleteRecord(id) {
    state.records = state.records.filter(x => x.id !== id); this.saveLocal();
    if (supabaseClient && state.isOnline) {
      try { const { error } = await supabaseClient.from('products').delete().eq('id', id); if (error) addToPendingChanges('deleteProduct', id); }
      catch(e) { addToPendingChanges('deleteProduct', id); }
    } else { addToPendingChanges('deleteProduct', id); }
    return { isOk: true };
  },
  async deleteMultipleRecords(ids) {
    state.records = state.records.filter(x => !ids.includes(x.id)); this.saveLocal();
    if (supabaseClient && state.isOnline) {
      try { const { error } = await supabaseClient.from('products').delete().in('id', ids); if (error) ids.forEach(id => addToPendingChanges('deleteProduct', id)); }
      catch(e) { ids.forEach(id => addToPendingChanges('deleteProduct', id)); }
    } else { ids.forEach(id => addToPendingChanges('deleteProduct', id)); }
    return { isOk: true };
  },
  async createCatalog(data) {
    data.id = 'cat_' + Date.now(); if (data.favorite === undefined) data.favorite = false;
    state.catalogs.push(data); this.saveLocal();
    if (supabaseClient && state.isOnline) {
      try { const { error } = await supabaseClient.from('catalogs').upsert([data]); if (error) addToPendingChanges('createCatalog', data); }
      catch(e) { addToPendingChanges('createCatalog', data); }
    } else { addToPendingChanges('createCatalog', data); }
    return { isOk: true };
  },
  async updateCatalog(id, data) {
    const idx = state.catalogs.findIndex(x => x.id === id);
    if (idx !== -1) {
      state.catalogs[idx] = { ...state.catalogs[idx], ...data }; this.saveLocal();
      if (supabaseClient && state.isOnline) {
        try { const { error } = await supabaseClient.from('catalogs').upsert([state.catalogs[idx]]); if (error) addToPendingChanges('updateCatalog', state.catalogs[idx]); }
        catch(e) { addToPendingChanges('updateCatalog', state.catalogs[idx]); }
      } else { addToPendingChanges('updateCatalog', state.catalogs[idx]); }
      return { isOk: true };
    }
    return { isOk: false };
  },
  async deleteCatalog(id) {
    state.catalogs = state.catalogs.filter(x => x.id !== id);
    state.records = state.records.filter(x => x.catalog_id !== id); this.saveLocal();
    if (supabaseClient && state.isOnline) {
      try { await supabaseClient.from('catalogs').delete().eq('id', id); await supabaseClient.from('products').delete().eq('catalog_id', id); }
      catch(e) { addToPendingChanges('deleteCatalog', { id: id }); }
    } else { addToPendingChanges('deleteCatalog', { id: id }); }
    return { isOk: true };
  },
  async addSale(sale) {
    sale.id = 'sale_' + Date.now(); 
    sale.date = new Date().toISOString();
    state.sales.unshift(sale); 
    this.saveLocal();
    
    if (supabaseClient && state.isOnline) {
      try { 
        // Solo enviar datos esenciales para evitar errores de columnas
        const saleData = {
          id: sale.id,
          date: sale.date,
          product_id: sale.product_id,
          product_name: sale.product_name,
          actual_price: sale.actual_price,
          quantity: sale.quantity,
          profit: sale.profit,
          payment_method: sale.payment_method,
          seller_name: sale.seller_name
        };
        
        const { error } = await supabaseClient.from('sales').upsert([saleData]); 
        if (error) {
          console.error('Error guardando venta en Supabase:', error);
          addToPendingChanges('addSale', sale);
        }
      } catch(e) { 
        console.error('Excepción guardando venta:', e);
        addToPendingChanges('addSale', sale); 
      }
    } else { 
      addToPendingChanges('addSale', sale); 
    }
  },
  async clearSales() {
    state.sales = []; this.saveLocal();
    if (supabaseClient && state.isOnline) { try { await supabaseClient.from('sales').delete().neq('id', 'none'); } catch(e) {} }
  }
};

// ==========================================
// FUNCIONES DE UI
// ==========================================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
  $(id).classList.add("active"); window.scrollTo(0, 0);
  document.querySelectorAll('.sidebar-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.currentView));
  document.querySelectorAll('.nav-action').forEach(btn => btn.classList.toggle('active-nav', btn.dataset.view === state.currentView));
  updateFAB();
}

function updateFAB() {
  const fabMenu = $('fab-menu'), fabOptions = $('fab-options'), fabBtn = $('fab-button');
  if (!fabMenu || !fabOptions || !fabBtn) return;
  if (state.currentUser && state.currentUser.role === 'vendedor') { fabMenu.style.display = 'none'; return; }
  if (state.currentView !== 'products' && state.currentView !== 'catalogs') {
    fabMenu.style.display = 'none'; fabOptions.classList.remove('open'); fabBtn.classList.remove('rotated'); state.fabOpen = false; return;
  }
  if ($("welcome-screen") && $("welcome-screen").classList.contains("hidden-welcome")) { fabMenu.style.display = 'flex'; }
  else { fabMenu.style.display = 'none'; return; }
  fabOptions.style.display = 'flex';
}

function toast(msg, duration = 2600) {
  const t = $("toast"); if(!t) return; t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), duration);
}

// ==========================================
// FIX CRÍTICO: SISTEMA DE MODALES ROBUSTO
// ==========================================
let modalOpenTimeout = null;

function openModal(id) {
  // Cancelar cualquier timeout previo que pudiera cerrar el modal
  if (modalOpenTimeout) { clearTimeout(modalOpenTimeout); modalOpenTimeout = null; }
  
  const el = document.getElementById(id);
  if (!el) { console.error('Modal no encontrado:', id); return; }
  
  // Usar requestAnimationFrame para asegurar que el DOM está listo
  requestAnimationFrame(() => {
    el.classList.add("open");
    if (typeof lucide !== 'undefined') lucide.createIcons();
    SoundEffects.play('click');
  });
}

function closeModal(id) { 
  const el = $(id); 
  if(el) { 
    el.classList.remove("open"); 
    const dd = el.querySelector('.dropdown-menu'); 
    if (dd) dd.classList.remove('open'); 
  } 
}

// FIX: Función segura para navegar desde el sidebar
// Primero cierra el sidebar, luego abre el modal con delay
function navigateFromSidebar(callback) {
  closeSidebar();
  // Delay para asegurar que el sidebar se cerró antes de abrir el modal
  setTimeout(() => {
    requestAnimationFrame(() => {
      callback();
    });
  }, 150);
}

function currentProducts() {
  if (state.currentView === 'products' && state.currentCatalogId) return state.records.filter(x => x.catalog_id === state.currentCatalogId);
  if (state.currentView === 'products' && state.query.trim()) return state.records;
  return state.records;
}

function filteredProducts() {
  let q = state.query.trim().toLowerCase();
  let products = currentProducts();
  if (!q) return products;
  return products.filter(x => {
    const name = (x.name || '').toLowerCase();
    const brand = (x.brand || '').toLowerCase();
    const type = (x.type || '').toLowerCase();
    const category = (x.category || '').toLowerCase();
    return name.includes(q) || brand.includes(q) || type.includes(q) || category.includes(q);
  }).sort((a, b) => {
    const aStarts = (a.name || '').toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = (b.name || '').toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts;
  });
}

function globalFilteredProducts() {
  let q = state.globalQuery.trim().toLowerCase();
  if (!q) return [];
  return state.records.filter(x => {
    const name = (x.name || '').toLowerCase();
    const brand = (x.brand || '').toLowerCase();
    const type = (x.type || '').toLowerCase();
    const category = (x.category || '').toLowerCase();
    return name.includes(q) || brand.includes(q) || type.includes(q) || category.includes(q);
  }).sort((a, b) => {
    const aStarts = (a.name || '').toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = (b.name || '').toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts;
  });
}

function cardImage(r) { return r.image_url || fallback; }
function openSidebar() { $('sidebar').classList.add('open'); $('sidebar-overlay').classList.add('open'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebar-overlay').classList.remove('open'); }

function enterStore() {
  try {
    localStorage.setItem('welcome_seen_v12', 'true');
    const welcome = document.getElementById('welcome-screen');
    if (welcome) welcome.classList.add('hidden-welcome');
    document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
    const catalogScreen = document.getElementById('catalog-screen');
    if (catalogScreen) catalogScreen.classList.add('active');
    state.currentView = 'catalogs'; updateFAB();
    SoundEffects.play('success');
  } catch(e) { console.error('Error enterStore:', e); }
}

function renderCatalogs() {
  const grid = $("catalog-grid"); if(!grid) return; grid.innerHTML = "";
  grid.classList.toggle('searching-active', !!state.globalQuery.trim());
  const sortedCatalogs = [...state.catalogs].sort((a, b) => (a.favorite === b.favorite) ? 0 : (a.favorite ? -1 : 1));
  sortedCatalogs.forEach(cat => {
    const productsCount = state.records.filter(p => p.catalog_id === cat.id).length;
    const tile = document.createElement('article');
    tile.className = 'catalog-tile' + (cat.favorite ? ' favorite' : '');
    tile.innerHTML = `<img src="${cat.cover || fallbackCover}" loading="lazy" alt="${cat.name}" onerror="this.src='${fallbackCover}'">
      <div class="p-5">
        <div class="flex justify-between gap-3 items-start">
          <div class="min-w-0 flex-1">
            <p class="text-[11px] uppercase tracking-[.13em] font-bold text-[#756c7e]">${cat.label || 'CATÁLOGO'}</p>
            <h2 class="font-bold text-xl mt-1 break-words">${cat.name}</h2>
          </div>
          <div class="flex items-center gap-2">
            <button class="favorite-btn w-8 h-8 rounded-full grid place-items-center hover:bg-gray-100 transition" title="${cat.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}">
              <i data-lucide="star" class="w-4 h-4 ${cat.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}"></i>
            </button>
            <span class="rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm" style="background:${cat.color}">${productsCount}</span>
          </div>
        </div>
        <button class="open-catalog mt-5 text-sm font-bold inline-flex items-center gap-1" style="color:${cat.color}" type="button">Ver catálogo <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
      </div>`;
    tile.onclick = (e) => { if (e.target.closest('button')) return; openCatalog(cat.id); };
    tile.querySelector('.open-catalog').onclick = (e) => { e.stopPropagation(); openCatalog(cat.id); };
    
    // Event listener para el botón de favorito
    const favoriteBtn = tile.querySelector('.favorite-btn');
    if (favoriteBtn) {
      favoriteBtn.onclick = async (e) => {
        e.stopPropagation();
        const newFavoriteState = !cat.favorite;
        await DB.updateCatalog(cat.id, { favorite: newFavoriteState });
        toast(newFavoriteState ? '⭐ Añadido a favoritos' : 'Quitado de favoritos');
        renderCatalogs();
      };
    }
    
    grid.appendChild(tile);
  });
  const isAdminUser = state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'coadmin');
  if (isAdminUser) {
    const addTile = document.createElement('article'); 
    addTile.className = 'catalog-tile add-new';
    addTile.innerHTML = `<div class="text-center p-5"><div class="w-14 h-14 mx-auto rounded-full bg-white shadow-md grid place-items-center mb-3"><i data-lucide="plus" class="w-6 h-6 text-[#7c43ba]"></i></div><p class="font-bold text-[#7c43ba]">Añadir catálogo</p><p class="text-xs text-[#756c7e] mt-1">Crea una nueva categoría</p></div>`;
    addTile.onclick = () => openModal('create-catalog-modal');
    grid.appendChild(addTile);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function clearCatalogProducts(catalogId) {
  const cat = state.catalogs.find(c => c.id === catalogId);
  const productsCount = state.records.filter(r => r.catalog_id === catalogId).length;
  if (productsCount === 0) { toast("No hay productos para eliminar"); return; }
  if (!confirm(`¿Eliminar los ${productsCount} productos de "${cat.name}"?`)) return;
  const idsToDelete = state.records.filter(r => r.catalog_id === catalogId).map(r => r.id);
  await DB.deleteMultipleRecords(idsToDelete);
  toast(`${productsCount} productos eliminados ✓`); SoundEffects.play('success'); renderAll();
}

async function deleteCatalogWithConfirm(catalogId) {
  const cat = state.catalogs.find(c => c.id === catalogId);
  const productsCount = state.records.filter(r => r.catalog_id === catalogId).length;
  if (!confirm(`¿Eliminar "${cat.name}" y sus ${productsCount} productos?`)) return;
  await DB.deleteCatalog(catalogId);
  if (state.currentCatalogId === catalogId) { state.currentCatalogId = null; state.currentView = 'catalogs'; showScreen("catalog-screen"); }
  toast("Catálogo eliminado"); SoundEffects.play('success'); renderAll();
}

function openCatalog(id) { state.currentCatalogId = id; state.currentView = 'products'; state.query = ""; const searchInput = $("search-input"); if(searchInput) searchInput.value = ""; showScreen("products-screen"); renderProductsScreen(); closeSidebar(); }

function goBack() { state.currentView = 'catalogs'; state.currentCatalogId = null; state.query = ""; state.globalQuery = ""; state.fabOpen = false; const fabOptions = $("fab-options"); const fabButton = $("fab-button"); if (fabOptions) fabOptions.classList.remove("open"); if (fabButton) fabButton.classList.remove("rotated"); const gsi = $("global-search-input"); if (gsi) gsi.value = ""; showScreen("catalog-screen"); renderAll(); }

function getTodaySales() { const today = new Date().toDateString(); return state.sales.filter(s => new Date(s.date).toDateString() === today); }

function renderSummary() {
  const items = currentProducts();
  const available = items.filter(x => !x.sold && Number(x.stock) > 0);
  const catalogSales = state.currentCatalogId ? state.sales.filter(s => { const prod = state.records.find(r => r.id === s.product_id); return prod && prod.catalog_id === state.currentCatalogId; }) : state.sales;
  const totalSold = catalogSales.reduce((sum, s) => sum + (s.quantity || 1), 0);
  const pc = $("product-count"); if(pc) pc.textContent = `${items.length} ${items.length === 1 ? "producto" : "productos"}`;
  const st = $("stock-total"); if(st) st.textContent = available.reduce((a, x) => a + Number(x.stock || 0), 0);
  const so = $("sold-total"); if(so) so.textContent = totalSold;
  const pt = $("profit-total"); if(pt) pt.textContent = formatUSDShort(available.reduce((a, x) => a + (Number(x.sale_price || 0) - Number(x.cost_price || 0)) * Number(x.stock || 0), 0));
  const todaySales = getTodaySales();
  const catalogTodaySales = state.currentCatalogId ? todaySales.filter(s => { const prod = state.records.find(r => r.id === s.product_id); return prod && prod.catalog_id === state.currentCatalogId; }) : todaySales;
  const ts = $("today-sales"); if(ts) ts.textContent = catalogTodaySales.length;
  const tr = $("today-revenue"); if(tr) tr.textContent = formatUSDShort(catalogTodaySales.reduce((a, s) => a + Number(s.actual_price || 0), 0));
  const rp = $("realized-profit"); if(rp) rp.textContent = formatUSDShort(catalogSales.reduce((a, s) => a + Number(s.profit || 0), 0));
}

function populateCard(el, r) {
  el.dataset.id = r.id;
  const img = el.querySelector(".product-image");
  img.src = cardImage(r); img.alt = r.name; img.onerror = function() { this.src = fallback; };
  const cb = el.querySelector(".card-brand"); if(cb) cb.textContent = r.brand;
  const cn = el.querySelector(".card-name"); if(cn) cn.textContent = r.name;
  const cc = el.querySelector(".card-category"); if(cc) cc.textContent = `${r.type} · ${r.category || ''}`;
  const cs = el.querySelector(".card-stock"); if(cs) cs.textContent = Number(r.stock) < 1 ? "Agotado" : `${r.stock} u.`;
  const cp = el.querySelector(".card-price"); if(cp) cp.textContent = formatUSD(r.sale_price);
  const offerEl = el.querySelector(".card-offer");
  if (offerEl && r.offer_text) { offerEl.textContent = r.offer_text; offerEl.classList.remove('hidden'); }
  else if (offerEl) { offerEl.classList.add('hidden'); }
  el.classList.remove('low-stock', 'out-of-stock');
  if (Number(r.stock) < 1) el.classList.add('out-of-stock');
  else if (Number(r.stock) <= 3) el.classList.add('low-stock');
  el.classList.toggle("opacity-50", Number(r.stock) < 1);
}

function createCard(r) {
  let f = $("product-template").content.cloneNode(true);
  let el = f.querySelector("article");
  populateCard(el, r);
  el.addEventListener("click", () => openDetail(r));
  el.querySelector(".quick-cart").addEventListener("click", e => { e.stopPropagation(); addCart(r); });
  return el;
}

function renderProducts() {
  let records = filteredProducts(), list = $("product-list"); if(!list) return;
  let existing = new Map([...list.children].map(x => [x.dataset.id, x]));
  records.forEach(r => {
    if (existing.has(r.id)) { populateCard(existing.get(r.id), r); existing.delete(r.id); }
    else { list.appendChild(createCard(r)); }
  });
  existing.forEach(x => x.remove());
  $("empty-products").classList.toggle("hidden", currentProducts().length !== 0);
  $("no-results").classList.toggle("hidden", currentProducts().length === 0 || records.length !== 0);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderProductsScreen() {
  const cat = state.catalogs.find(c => c.id === state.currentCatalogId);
  if (!cat && state.currentCatalogId !== null) return;
  const act = $("active-catalog-title"); if(act) act.textContent = cat ? cat.name : "Todos los productos";
  const acl = $("active-catalog-label"); if(acl) acl.textContent = cat ? (cat.label || 'CATÁLOGO') : 'INVENTARIO COMPLETO';
  renderSummary(); renderProducts(); renderCartBadges(); updateOutOfStockBadge(); updateLowStockBadge();
  const clearCount = $('clear-catalog-count');
  if (clearCount && cat) { const count = state.records.filter(r => r.catalog_id === state.currentCatalogId).length; clearCount.textContent = `Borrar ${count} productos`; }
}

function renderGlobalSearch() {
  const results = globalFilteredProducts(), container = $("global-search-results"), list = $("global-product-list");
  const clearBtn = $("global-search-clear");
  if (clearBtn) clearBtn.classList.toggle('hidden', !state.globalQuery.trim());
  if (!state.globalQuery.trim()) { container.classList.remove("active"); $("catalog-grid").classList.remove('searching-active'); return; }
  container.classList.add("active"); $("catalog-grid").classList.add('searching-active');
  if(list) list.innerHTML = "";
  if (results.length === 0) { $("global-no-results").classList.remove("hidden"); if (typeof lucide !== 'undefined') lucide.createIcons(); return; }
  $("global-no-results").classList.add("hidden");
  results.forEach(r => list.appendChild(createCard(r)));
  if (typeof lucide !== 'undefined') lucide.createIcons();
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderReports() {
  // Ordenar ventas por fecha descendente (más recientes primero)
  const sales = [...state.sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const rsc = $("report-sales-count"); if(rsc) rsc.textContent = sales.length;
  const rtr = $("report-total-revenue"); if(rtr) rtr.textContent = formatUSD(sales.reduce((a, s) => a + Number(s.actual_price || 0), 0));
  const rtp = $("report-total-profit"); if(rtp) rtp.textContent = formatUSD(sales.reduce((a, s) => a + Number(s.profit || 0), 0));
  const rap = $("report-avg-profit"); if(rap) rap.textContent = formatUSD(sales.length ? sales.reduce((a, s) => a + Number(s.profit || 0), 0) / sales.length : 0);
  const list = $("sales-list"); if(list) list.innerHTML = "";
  if (sales.length === 0) { $("no-sales").classList.remove("hidden"); return; }
  $("no-sales").classList.add("hidden");
  sales.forEach(s => {
    const row = document.createElement('div'); row.className = 'sale-row rounded-xl p-3 flex items-center gap-3 shadow-sm';
    const date = new Date(s.date);
    const dateStr = date.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' ' + date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const sellerInfo = s.seller_name ? `<p class="text-[10px] text-[#7c43ba] font-bold">Vendido por: ${s.seller_name}</p>` : '';
    const payInfo = s.payment_method ? `<p class="text-[10px] text-[#23805d] font-bold">${s.payment_method}</p>` : '';
    row.innerHTML = `<div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${s.product_name}</p>${sellerInfo}${payInfo}<p class="text-xs text-[#756c7e]">${dateStr}</p></div>
      <div class="text-right flex-shrink-0"><p class="font-bold text-sm text-[#7c43ba]">${formatUSD(s.actual_price)}</p><p class="text-xs text-[#166534] font-bold">+${formatUSD(s.profit)}</p></div>`;
    list.appendChild(row);
  });
  setTimeout(() => renderSalesChart(), 100);
}

function renderSalesChart() {
  const canvas = $('sales-chart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') { canvas.parentElement.innerHTML = '<p class="text-center text-sm text-[#756c7e] py-8">Gráfico no disponible</p>'; return; }
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const daySales = state.sales.filter(s => new Date(s.date).toDateString() === date.toDateString());
    const revenue = daySales.reduce((sum, s) => sum + Number(s.actual_price || 0), 0);
    last7Days.push({ label: date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }), revenue: revenue, count: daySales.length });
  }
  if (window.salesChartInstance) { try { window.salesChartInstance.destroy(); } catch(e) {} window.salesChartInstance = null; }
  const ctx = canvas.getContext('2d');
  window.salesChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: last7Days.map(d => d.label), datasets: [{ label: 'Ingresos (USD)', data: last7Days.map(d => d.revenue), backgroundColor: 'rgba(124, 67, 186, 0.7)', borderColor: 'rgba(124, 67, 186, 1)', borderWidth: 2, borderRadius: 8, maxBarThickness: 50 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { const idx = context.dataIndex; return `Ingresos: ${formatUSD(context.raw)} (${last7Days[idx].count} ventas)`; } } } }, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return '$' + value; } }, grid: { color: 'rgba(0, 0, 0, 0.05)' } }, x: { grid: { display: false } } }, layout: { padding: { top: 10, bottom: 10, left: 10, right: 10 } } }
  });
}

function getOutOfStockProducts() { return state.records.filter(r => Number(r.stock) < 1); }
function getLowStockProducts() { return state.records.filter(r => Number(r.stock) > 0 && Number(r.stock) <= 3); }
function updateLowStockBadge() { const count = getLowStockProducts().length; const badge = $('low-stock-badge'); if (badge) { badge.textContent = count; badge.classList.toggle("hidden", count === 0); } }

function renderLowStock() {
  const list = $("low-stock-list"); if (!list) return;
  const products = getLowStockProducts(); list.innerHTML = "";
  if (products.length === 0) { $("no-low-stock").classList.remove("hidden"); return; }
  $("no-low-stock").classList.add("hidden");
  products.forEach(r => {
    const cat = state.catalogs.find(c => c.id === r.catalog_id);
    const row = document.createElement('div');
    row.className = 'out-of-stock-card rounded-2xl p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:shadow-md transition';
    row.innerHTML = `<img src="${cardImage(r)}" alt="" class="w-16 h-16 rounded-xl object-cover flex-shrink-0" onerror="this.src='${fallbackCover}'">
      <div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${r.name}</p><p class="text-xs text-[#756c7e] truncate">${r.brand} · ${cat ? cat.name : ''}</p><p class="text-xs text-[#d97706] font-bold mt-1">Stock: ${r.stock} unidades</p></div>
      <div class="text-right flex-shrink-0"><span class="inline-block px-2 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-xs font-bold">Stock bajo</span></div>`;
    row.onclick = () => openDetail(r); list.appendChild(row);
  });
  updateLowStockBadge(); if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderOutOfStock() {
  const list = $("out-of-stock-list"), products = getOutOfStockProducts(); if(!list) return; list.innerHTML = "";
  if (products.length === 0) { $("no-out-of-stock").classList.remove("hidden"); $("export-out-of-stock").classList.add("hidden"); return; }
  $("no-out-of-stock").classList.add("hidden"); $("export-out-of-stock").classList.remove("hidden");
  products.forEach(r => {
    const cat = state.catalogs.find(c => c.id === r.catalog_id);
    const row = document.createElement('div'); row.className = 'out-of-stock-card rounded-2xl p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:shadow-md transition';
    row.innerHTML = `<img src="${cardImage(r)}" alt="" class="w-16 h-16 rounded-xl object-cover flex-shrink-0" onerror="this.src='${fallbackCover}'">
      <div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${r.name}</p><p class="text-xs text-[#756c7e] truncate">${r.brand} · ${cat ? cat.name : ''}</p><p class="text-xs text-[#a43658] font-bold mt-1">Último costo: ${formatUSD(r.cost_price)}</p></div>
      <div class="text-right flex-shrink-0"><span class="inline-block px-2 py-1 rounded-full bg-[#fff0f3] text-[#a43658] text-xs font-bold">Agotado</span></div>`;
    row.onclick = () => openDetail(r); list.appendChild(row);
  });
  updateOutOfStockBadge(); if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateOutOfStockBadge() { const count = getOutOfStockProducts().length, badge = $('out-of-stock-badge'); if (badge) { badge.textContent = count; badge.classList.toggle("hidden", count === 0); } }

function exportOutOfStock() {
  if (typeof XLSX === 'undefined') { toast("Librería Excel no disponible"); return; }
  const products = getOutOfStockProducts();
  if (products.length === 0) { toast("No hay productos agotados"); return; }
  const wb = XLSX.utils.book_new();
  const data = products.map(r => { const cat = state.catalogs.find(c => c.id === r.catalog_id); return { 'Nombre': r.name, 'Marca': r.brand, 'Costo': Number(r.cost_price) || 0, 'Precio Máx': Number(r.sale_price) || 0, 'Catálogo': cat ? cat.name : '' }; });
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Productos Agotados");
  XLSX.writeFile(wb, `productos_agotados_${Date.now()}.xlsx`);
  toast("Lista exportada ✓"); SoundEffects.play('success');
}

async function refreshData() {
  if (!state.isOnline) { 
    toast('⚠️ Sin conexión. Usando datos locales.'); 
    return; 
  }
  
  if (!supabaseClient) {
    toast('⚠️ Base de datos no disponible');
    return;
  }
  
  toast('🔄 Actualizando datos...');
  try {
    const { data: cats, error: catError } = await supabaseClient.from('catalogs').select('*');
    const { data: prods, error: prodError } = await supabaseClient.from('products').select('*');
    const { data: sales, error: salesError } = await supabaseClient.from('sales').select('*');
    
    if (catError || prodError || salesError) {
      throw new Error('Error al sincronizar con la nube');
    }
    
    if (cats) state.catalogs = cats; 
    if (prods) state.records = prods; 
    if (sales) state.sales = sales;
    
    DB.saveLocal(); 
    renderAll(); 
    toast('✅ Datos actualizados desde la nube'); 
    SoundEffects.play('success');
  } catch (e) { 
    console.error('Error refresh:', e); 
    toast('❌ Error al actualizar. Usando datos locales.');
    DB.saveLocal();
  }
}

function renderAll() {
  renderCatalogs();
  if (state.currentView === 'products' || state.currentCatalogId) renderProductsScreen();
  if (state.currentView === 'reports') renderReports();
  if (state.currentView === 'out-of-stock') renderOutOfStock();
  if (state.currentView === 'low-stock') renderLowStock();
  if (state.currentView === 'daily-sales') renderDailySales();
  renderCartBadges(); renderGlobalSearch(); updateOutOfStockBadge(); updateLowStockBadge();
}

let syncInterval = null;
function startAutoSync() {
  if (syncInterval) clearInterval(syncInterval);
  
  // Sincronización automática cada 30 segundos (más frecuente)
  syncInterval = setInterval(async () => {
    if (!state.currentUser || !state.isOnline || !supabaseClient) {
      return; // No intentar sincronizar si no hay conexión o usuario
    }
    
    try {
      // Primero sincronizar cambios pendientes
      if (state.pendingChanges.length > 0) {
        await syncPendingChanges();
      }
      
      // Luego obtener datos actualizados
      const { data: prods, error: prodError } = await supabaseClient.from('products').select('*');
      const { data: cats, error: catError } = await supabaseClient.from('catalogs').select('*');
      const { data: sales, error: salesError } = await supabaseClient.from('sales').select('*');
      
      if (!prodError && !catError) {
        if (prods) state.records = prods; 
        if (cats) state.catalogs = cats;
        if (sales) state.sales = sales;
        DB.saveLocal(); 
        renderAll();
        console.log('✅ Auto-sync completado');
      }
    } catch (e) { 
      console.log('⚠️ Auto-sync falló (posible problema de conexión)');
      // No mostrar error al usuario, solo registrar
    }
  }, 30000); // Cada 30 segundos
  
  // Sincronización inmediata al iniciar
  setTimeout(() => {
    if (state.currentUser && state.isOnline && supabaseClient) {
      refreshData();
    }
  }, 2000);
}

function addCart(r) {
  if (Number(r.stock) < 1) { toast("Este producto está agotado."); SoundEffects.play('error'); return; }
  let line = state.cart.find(x => x.id === r.id);
  if (line) { if (line.qty < r.stock) { line.qty++; toast(`Cantidad: ${line.qty}`); } else toast("Stock máximo."); }
  else { state.cart.push({ id: r.id, qty: 1 }); toast("Añadido al pedido ✓"); SoundEffects.play('success'); }
  renderCartBadges();
  if ($("cart-modal") && $("cart-modal").classList.contains("open")) renderCart();
}

function renderCartBadges() {
  const totalQty = state.cart.reduce((a, x) => a + x.qty, 0);
  ["cart-badge-a", "cart-badge-b", "sidebar-cart-badge"].forEach(id => { const el = $(id); if (!el) return; el.textContent = totalQty; el.classList.toggle("hidden", totalQty === 0); });
}

function renderCart() {
  const list = $("cart-list"); if (!list) return;
  list.innerHTML = ""; let total = 0;
  state.cart = state.cart.filter(line => state.records.some(r => r.id === line.id));
  if (state.cart.length === 0) { $("cart-empty").classList.remove("hidden"); $("cart-footer").classList.add("hidden"); return; }
  $("cart-empty").classList.add("hidden"); $("cart-footer").classList.remove("hidden");
  state.cart.forEach(line => {
    const r = state.records.find(x => x.id === line.id); if (!r) return;
    total += Number(r.sale_price) * line.qty;
    const row = document.createElement("div"); row.className = "flex items-center gap-3 border border-[#eee7f1] rounded-2xl p-3 bg-white shadow-sm";
    const img = document.createElement("img"); img.src = cardImage(r); img.alt = r.name; img.className = "w-12 h-12 rounded-xl object-cover flex-shrink-0";
    const infoDiv = document.createElement("div"); infoDiv.className = "min-w-0 flex-1";
    const nameP = document.createElement("p"); nameP.className = "font-bold text-sm truncate"; nameP.textContent = r.name;
    const priceP = document.createElement("p"); priceP.className = "text-xs text-[#756c7e]"; priceP.textContent = formatUSD(r.sale_price);
    infoDiv.appendChild(nameP); infoDiv.appendChild(priceP);
    const controlsDiv = document.createElement("div"); controlsDiv.className = "flex items-center gap-2 flex-shrink-0";
    const minusBtn = document.createElement("button"); minusBtn.className = "w-7 h-7 rounded-full bg-[#f1ebf5] grid place-items-center hover:bg-[#e8dfec]"; minusBtn.type = "button"; minusBtn.textContent = "−";
    minusBtn.onclick = () => { line.qty--; if (line.qty < 1) state.cart = state.cart.filter(x => x !== line); renderCart(); renderCartBadges(); };
    const qtySpan = document.createElement("span"); qtySpan.className = "text-sm font-bold w-4 text-center"; qtySpan.textContent = line.qty;
    const plusBtn = document.createElement("button"); plusBtn.className = "w-7 h-7 rounded-full bg-[#f1ebf5] grid place-items-center hover:bg-[#e8dfec]"; plusBtn.type = "button"; plusBtn.textContent = "+";
    plusBtn.onclick = () => { if (line.qty < r.stock) { line.qty++; renderCart(); renderCartBadges(); } else toast("Stock máximo."); };
    controlsDiv.append(minusBtn, qtySpan, plusBtn); row.append(img, infoDiv, controlsDiv); list.appendChild(row);
  });
  const ct = $("cart-total"); if(ct) ct.textContent = formatUSD(total);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openDetail(r) {
  state.detail = r;
  const detailImg = $("detail-image");
  detailImg.src = cardImage(r); detailImg.alt = r.name; detailImg.onerror = function() { this.src = fallback; };
  const db = $("detail-brand"); if(db) db.textContent = r.brand;
  const dn = $("detail-name"); if(dn) dn.textContent = r.name;
  const dm = $("detail-meta"); if(dm) dm.textContent = `${r.type} · ${r.category || ''} · ${r.stock} unidades disponibles`;
  const dd = $("detail-description"); if(dd) dd.textContent = r.description || "Sin descripción.";
  const dcp = $("detail-cost-price"); if(dcp) dcp.textContent = formatUSD(r.cost_price);
  const dsp = $("detail-sale-price"); if(dsp) dsp.innerHTML = `${formatUSDShort(r.sale_price)} <span class="currency-tag">USD</span>`;
  const dmp = $("detail-min-price"); if(dmp) dmp.innerHTML = `<span class="text-xs text-[#756c7e]">Mínimo:</span> <span class="font-bold text-sm text-[#a43658]">${formatUSD(r.min_price || 0)}</span>`;
  const dp = $("detail-profit"); if(dp) dp.textContent = formatUSD(Number(r.sale_price) - Number(r.cost_price));
  const offerEl = $("detail-offer");
  if (offerEl && r.offer_text) { offerEl.textContent = r.offer_text; offerEl.classList.remove('hidden'); } else if (offerEl) { offerEl.classList.add('hidden'); }
  const soldBtn = $("detail-sold");
  if (soldBtn) {
    if (Number(r.stock) < 1) { soldBtn.disabled = true; soldBtn.style.opacity = '0.4'; soldBtn.style.cursor = 'not-allowed'; soldBtn.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4"></i> Agotado'; }
    else { soldBtn.disabled = false; soldBtn.style.opacity = '1'; soldBtn.style.cursor = 'pointer'; soldBtn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Vender'; }
  }
  openModal("detail-modal");
}

function openSaleModal(r) {
  if (Number(r.stock) < 1) { toast("No hay stock disponible"); SoundEffects.play('error'); return; }
  state.saleProduct = r;
  const spn = $("sale-product-name"); if(spn) spn.textContent = r.name;
  const sap = $("sale-actual-price"); if(sap) sap.value = r.sale_price;
  const sq = $("sale-quantity"); if(sq) sq.value = 1;
  state.selectedPaymentMethod = 'Efec.';
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    if (btn.dataset.method === 'Efec.') btn.className = 'pay-method-btn py-2 rounded-xl border-2 border-[#7c43ba] bg-[#f6f1f8] font-bold text-sm';
    else btn.className = 'pay-method-btn py-2 rounded-xl border-2 border-[#e8dfec] text-[#756c7e] font-bold text-sm';
  });
  updateSaleDisplay(); openModal("sale-modal");
  setTimeout(() => { if(sap) sap.focus(); }, 300);
}

function updateSaleDisplay() {
  const r = state.saleProduct; if (!r) return;
  const qty = parseInt($("sale-quantity").value) || 1;
  const actual = Number($("sale-actual-price").value) || Number(r.sale_price) || 0;
  const total = actual * qty;
  const profit = (actual - Number(r.cost_price)) * qty;
  const displayTotal = $("sale-display-total");
  if (displayTotal) displayTotal.textContent = '$' + formatUSDShort(total);
  const spv = $("sale-profit-value");
  if (spv) { spv.textContent = formatUSD(profit); spv.className = profit >= 0 ? "font-bold text-lg text-[#166534]" : "font-bold text-lg text-[#a43658]"; }
}

async function confirmSale() {
  if (state.isProcessing) return;
  state.isProcessing = true;
  const confirmBtn = $("confirm-sale");
  if(confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Procesando...'; }
  const r = state.saleProduct;
  if (!r) { resetConfirmBtn(); return; }
  const qty = parseInt($("sale-quantity").value) || 1;
  const actual = Number($("sale-actual-price").value);
  if (isNaN(actual) || actual <= 0) { toast("Ingresa un precio válido"); SoundEffects.play('error'); resetConfirmBtn(); return; }
  if (r.stock < qty) { toast("No hay suficiente stock"); SoundEffects.play('error'); resetConfirmBtn(); return; }
  const total = actual * qty;
  const profit = (actual - Number(r.cost_price)) * qty;
  const saleData = {
    product_id: r.id, product_name: r.name, brand: r.brand || '', catalog_id: r.catalog_id || '',
    cost_price: Number(r.cost_price), actual_price: total, unit_price: actual, profit: profit, quantity: qty,
    payment_method: state.selectedPaymentMethod || 'Efec.',
    seller_id: state.currentUser ? state.currentUser.id : 'unknown',
    seller_name: state.currentUser ? state.currentUser.name : 'Desconocido'
  };
  try {
    // Registrar venta
    await DB.addSale(saleData);
    
    // Actualizar stock inmediatamente
    const newStock = Number(r.stock) - qty;
    const updatedProduct = { ...r, stock: newStock };
    
    // Actualizar en estado local
    const idx = state.records.findIndex(x => x.id === r.id);
    if (idx !== -1) {
      state.records[idx].stock = newStock;
    }
    
    // Guardar localmente
    DB.saveLocal();
    
    // Actualizar en Supabase
    await DB.updateRecord(updatedProduct);
    
    // Forzar sincronización inmediata si hay conexión
    if (state.isOnline && supabaseClient) {
      try {
        await supabaseClient.from('products').update({ stock: newStock }).eq('id', r.id);
        console.log('✅ Stock actualizado en Supabase:', newStock);
      } catch (e) {
        console.error('Error sincronizando stock:', e);
      }
    }
    
    closeModal("sale-modal"); closeModal("detail-modal");
    toast(`¡Venta registrada! ${qty}x ${r.name} - Ganancia: ${formatUSD(profit)} 🎉`, 3000);
    SoundEffects.play('success');
    
    // Actualizar toda la UI inmediatamente
    renderAll();
  } catch (e) { 
    console.error('❌ Error al procesar la venta:', e); 
    toast('❌ Error al registrar la venta'); 
  }
  resetConfirmBtn();
}

function resetConfirmBtn() {
  state.isProcessing = false;
  const confirmBtn = $("confirm-sale");
  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Confirmar'; }
}

function toggleClientMode() {
  state.clientMode = !state.clientMode;
  document.body.classList.toggle('client-mode', state.clientMode);
  const btn = $('client-mode-btn');
  if (btn) {
    if (state.clientMode) { btn.innerHTML = '<i data-lucide="eye" class="w-5 h-5"></i>'; btn.title = 'Salir del modo cliente'; toast("Modo cliente activado."); }
    else { btn.innerHTML = '<i data-lucide="eye-off" class="w-5 h-5"></i>'; btn.title = 'Modo cliente'; toast("Modo dueño activado."); }
  }
  SoundEffects.play('click'); if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateProfitPreview() {
  const sale = Number($("sale-price").value) || 0, cost = Number($("cost-price").value) || 0, profit = sale - cost;
  const ppv = $("profit-preview-value");
  if(ppv) { ppv.textContent = formatUSD(profit); ppv.className = profit >= 0 ? "font-bold text-[#166534]" : "font-bold text-[#a43658]"; }
}

function openForm(r = null) {
  state.editing = r; state.pendingImageFile = null; $("product-form").reset(); $("image-preview").style.display = "none";
  $("form-message").classList.add("hidden"); $("form-title").textContent = r ? "Editar producto" : "Añadir producto";
  let catalogSelector = document.getElementById('catalog-selector');
  if (!catalogSelector) {
    catalogSelector = document.createElement('div'); catalogSelector.id = 'catalog-selector';
    catalogSelector.innerHTML = `<label class="block font-bold text-sm mb-1.5">Catálogo *</label><select id="product-catalog-select" class="w-full input-field rounded-xl p-3"><option value="">Selecciona un catálogo</option></select>`;
    const categoryField = $("product-category").parentElement;
    categoryField.parentElement.insertBefore(catalogSelector, categoryField.nextSibling);
  }
  const select = document.getElementById('product-catalog-select');
  select.innerHTML = '<option value="">Selecciona un catálogo</option>';
  state.catalogs.forEach(cat => { const option = document.createElement('option'); option.value = cat.id; option.textContent = cat.name; select.appendChild(option); });
  if (r) {
    $("product-name").value = r.name; $("product-brand").value = r.brand; $("product-type").value = r.type;
    $("product-category").value = r.category || ""; $("product-description").value = r.description || "";
    $("product-barcode").value = r.barcode || ""; $("sale-price").value = r.sale_price;
    $("min-price").value = r.min_price || 0; $("cost-price").value = r.cost_price; $("product-stock").value = r.stock;
    $("product-offer").value = r.offer_text || ""; $("image-preview").src = cardImage(r); $("image-preview").style.display = "block";
    select.value = r.catalog_id;
  } else { if (state.currentCatalogId) select.value = state.currentCatalogId; $("product-barcode").value = ""; $("product-offer").value = ""; }
  updateProfitPreview(); $("drawer-backdrop").classList.add("open"); $("form-drawer").classList.add("open");
}

function closeForm() { $("drawer-backdrop").classList.remove("open"); $("form-drawer").classList.remove("open"); }

function openCatalogForm(id = null) {
  document.querySelectorAll('.modal.open').forEach(el => { el.classList.remove('open'); });
  state.editingCatalogId = id; state.pendingCatalogImage = null;
  const form = $("catalog-form"); if(form) form.reset();
  const preview = $("catalog-image-preview"); if(preview) preview.style.display = "none";
  const deleteBtn = $("delete-catalog-btn"); if(deleteBtn) deleteBtn.classList.toggle("hidden", !id);
  const title = $("catalog-modal-title"); if(title) title.textContent = id ? "Editar Catálogo" : "Nuevo Catálogo";
  if (id) {
    const cat = state.catalogs.find(c => c.id === id);
    if (cat) {
      const nameInput = $("catalog-name"); if(nameInput) nameInput.value = cat.name;
      const labelInput = $("catalog-label"); if(labelInput) labelInput.value = cat.label || "";
      const colorRadio = document.querySelector(`input[name="cat-color"][value="${cat.color}"]`);
      if (colorRadio) colorRadio.checked = true;
      if(preview) { preview.src = cat.cover || fallbackCover; preview.style.display = "block"; }
    }
  }
  openModal("catalog-modal");
}

// ==========================================
// EXPORTACIONES
// ==========================================
function exportXLSX(catalogId = null) {
  console.log('🚀 Iniciando exportXLSX, catalogId:', catalogId);
  
  if (typeof XLSX === 'undefined') { 
    console.error('❌ XLSX no está definido');
    toast("Librería Excel no cargó. Recarga la página."); 
    return; 
  }
  
  console.log('✅ XLSX está disponible');
  
  const records = catalogId ? state.records.filter(r => r.catalog_id === catalogId) : state.records;
  console.log('📊 Registros a exportar:', records.length);
  
  if (records.length === 0) {
    console.warn('⚠️ No hay productos para exportar');
    toast("No hay productos para exportar");
    return;
  }
  
  try {
    console.log('📊 Creando libro de Excel...');
    
    const wb = XLSX.utils.book_new();
    console.log('✅ Libro creado');
    
    const productsData = records.map(r => ({ 
      'Nombre': r.name, 
      'Marca': r.brand, 
      'Tipo': r.type, 
      'Categoría': r.category, 
      'Código Barras': r.barcode || '', 
      'Costo': Number(r.cost_price) || 0, 
      'Precio Venta Máx': Number(r.sale_price) || 0, 
      'Precio Venta Mín': Number(r.min_price) || 0, 
      'Stock': Number(r.stock) || 0, 
      'Descripción': r.description || '', 
      'Oferta': r.offer_text || '', 
      'Catálogo': r.catalog_id 
    }));
    
    console.log('✅ Datos preparados:', productsData.length, 'productos');
    
    const ws1 = XLSX.utils.json_to_sheet(productsData);
    console.log('✅ Hoja creada');
    
    XLSX.utils.book_append_sheet(wb, ws1, "Productos");
    console.log('✅ Hoja agregada al libro');
    
    const filename = catalogId ? `catalogo_${catalogId}_${Date.now()}.xlsx` : `todos_los_catalogos_${Date.now()}.xlsx`;
    
    console.log('📥 Llamando a XLSX.writeFile con nombre:', filename);
    
    // Usar writeFile de XLSX
    XLSX.writeFile(wb, filename);
    
    console.log('✅ XLSX.writeFile completado');
    
    toast(`✅ Excel descargado: ${records.length} productos`);
    SoundEffects.play('success');
  } catch (e) { 
    console.error('❌ Error al exportar Excel:', e);
    console.error('❌ Stack:', e.stack);
    toast("Error al exportar: " + e.message, 4000); 
  }
}

function exportJSON(catalogId = null) {
  let data;
  let filename;
  
  if (catalogId) { 
    const cat = state.catalogs.find(c => c.id === catalogId);
    const records = state.records.filter(r => r.catalog_id === catalogId);
    
    if (records.length === 0) {
      toast("No hay productos para exportar");
      return;
    }
    
    data = { 
      catalogs: [cat], 
      records: records, 
      sales: state.sales.filter(s => s.catalog_id === catalogId) 
    };
    filename = `catalogo_${catalogId}_${Date.now()}.json`;
  } else { 
    if (state.records.length === 0) {
      toast("No hay productos para exportar");
      return;
    }
    
    data = { 
      catalogs: state.catalogs, 
      records: state.records, 
      sales: state.sales 
    };
    filename = `todos_los_catalogos_${Date.now()}.json`;
  }
  
  try {
    console.log('📊 Exportando JSON:', data.records.length, 'productos');
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, filename);
    
    console.log('📥 Descargando archivo:', filename);
    toast(`✅ JSON descargado: ${data.records.length} productos`);
    SoundEffects.play('success');
  } catch (e) {
    console.error('❌ Error al exportar JSON:', e);
    toast("Error al exportar: " + e.message, 4000);
  }
}

function exportCSV(catalogId = null) {
  const records = catalogId ? state.records.filter(r => r.catalog_id === catalogId) : state.records;
  
  if (records.length === 0) {
    toast("No hay productos para exportar");
    return;
  }
  
  try {
    console.log('📊 Exportando CSV:', records.length, 'productos');
    
    const headers = ['nombre','marca','tipo','categoria','codigo_barras','costo','precio_venta_max','precio_venta_min','stock','descripcion','oferta','catalogo_id'];
    const rows = [headers.join(',')];
    
    records.forEach(r => { 
      rows.push([
        csvEscape(r.name), 
        csvEscape(r.brand), 
        csvEscape(r.type), 
        csvEscape(r.category), 
        csvEscape(r.barcode || ''), 
        r.cost_price || 0, 
        r.sale_price || 0, 
        r.min_price || 0, 
        r.stock || 0, 
        csvEscape(r.description || ''), 
        csvEscape(r.offer_text || ''), 
        r.catalog_id || ''
      ].join(',')); 
    });
    
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const filename = catalogId ? `catalogo_${catalogId}_${Date.now()}.csv` : `todos_los_catalogos_${Date.now()}.csv`;
    
    console.log('📥 Descargando archivo:', filename);
    downloadBlob(blob, filename);
    
    toast(`✅ CSV descargado: ${records.length} productos`);
    SoundEffects.play('success');
  } catch (e) {
    console.error('❌ Error al exportar CSV:', e);
    toast("Error al exportar: " + e.message, 4000);
  }
}

function exportSalesXLSX() {
  if (typeof XLSX === 'undefined') { toast("Librería Excel no cargó."); return; }
  if (state.sales.length === 0) { toast("No hay ventas para exportar"); return; }
  try {
    const wb = XLSX.utils.book_new();
    const data = state.sales.map(s => ({ 'Fecha': new Date(s.date).toLocaleString('es'), 'Producto': s.product_name, 'Marca': s.brand || '', 'Cantidad': s.quantity || 1, 'Costo Unit.': s.cost_price, 'Precio Real': s.actual_price, 'Método': s.payment_method || 'Efec.', 'Vendedor': s.seller_name || '', 'Ganancia': s.profit }));
    const ws = XLSX.utils.json_to_sheet(data); XLSX.utils.book_append_sheet(wb, ws, "Informe Ventas");
    XLSX.writeFile(wb, `informe_ventas_${Date.now()}.xlsx`); toast("Informe Excel descargado ✓"); SoundEffects.play('success');
  } catch (e) { toast("Error: " + e.message, 3000); }
}

function exportSalesCSV() {
  if (state.sales.length === 0) { toast("No hay ventas"); return; }
  const headers = ['fecha','producto','marca','cantidad','costo','precio_real','metodo','vendedor','ganancia'];
  const rows = [headers.join(',')];
  state.sales.forEach(s => { rows.push([new Date(s.date).toLocaleString('es'), csvEscape(s.product_name), csvEscape(s.brand || ''), s.quantity || 1, s.cost_price, s.actual_price, s.payment_method || 'Efec.', csvEscape(s.seller_name || ''), s.profit].join(',')); });
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `informe_ventas_${Date.now()}.csv`); toast("Informe CSV descargado ✓"); SoundEffects.play('success');
}

function csvEscape(str) { if (str == null) return ''; str = String(str); if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`; return str; }
function downloadBlob(blob, filename) {
  console.log('📥 Iniciando descarga:', filename, 'Tamaño:', blob.size, 'bytes');
  
  try {
    // Crear URL del blob
    const url = URL.createObjectURL(blob);
    console.log('✅ URL creada:', url.substring(0, 50) + '...');
    
    // Crear elemento de enlace
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename);
    
    // Agregar al documento
    document.body.appendChild(a);
    console.log('✅ Elemento <a> agregado al DOM');
    
    // Hacer clic en el enlace
    a.click();
    console.log('✅ Click ejecutado');
    
    // Limpiar después de un tiempo
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
      console.log('✅ Limpieza completada');
    }, 500);
    
    console.log('✅ Descarga iniciada correctamente:', filename);
    return true;
  } catch (e) {
    console.error('❌ Error al descargar:', e);
    console.error('❌ Stack:', e.stack);
    toast('Error al descargar: ' + e.message, 4000);
    return false;
  }
}

function exportCartToPDF() {
  if (state.cart.length === 0) { toast("El carrito está vacío"); return; }
  if (typeof window.jspdf === 'undefined') { toast("Librería PDF no cargó"); return; }
  try {
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    const businessName = state.contactInfo?.business || 'Mi Tienda';
    doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text(businessName, 105, 20, { align: 'center' });
    doc.setDrawColor(124, 67, 186); doc.setLineWidth(0.5); doc.line(20, 35, 190, 35);
    doc.setFontSize(14); doc.setTextColor(124, 67, 186); doc.text('PEDIDO', 105, 45, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal');
    doc.text(`Fecha: ${new Date().toLocaleString('es')}`, 20, 55);
    let y = 70; doc.setFont(undefined, 'bold'); doc.setFillColor(124, 67, 186); doc.setTextColor(255, 255, 255);
    doc.rect(20, y - 5, 170, 8, 'F'); doc.text('Producto', 25, y); doc.text('Cant.', 120, y); doc.text('P. Unit.', 140, y); doc.text('Subtotal', 170, y);
    y += 10; doc.setTextColor(0, 0, 0); doc.setFont(undefined, 'normal'); let total = 0;
    state.cart.forEach(line => {
      const r = state.records.find(x => x.id === line.id); if (!r) return;
      const subtotal = Number(r.sale_price) * line.qty; total += subtotal;
      if (y > 260) { doc.addPage(); y = 20; }
      const name = r.name.length > 35 ? r.name.substring(0, 35) + '...' : r.name;
      doc.text(name, 25, y); doc.text(String(line.qty), 125, y); doc.text(formatUSDShort(r.sale_price), 140, y); doc.text(formatUSDShort(subtotal), 170, y); y += 8;
    });
    y += 5; doc.setDrawColor(124, 67, 186); doc.line(20, y, 190, y); y += 10;
    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(124, 67, 186);
    doc.text('TOTAL:', 130, y); doc.text(formatUSD(total), 170, y);
    doc.save(`pedido_${Date.now()}.pdf`); toast("Pedido PDF descargado ✓"); SoundEffects.play('success');
  } catch (e) { toast("Error al generar PDF: " + e.message, 3000); }
}

function shareCatalogByLink(catalogId) {
  const cat = state.catalogs.find(c => c.id === catalogId); if (!cat) return;
  const products = state.records.filter(r => r.catalog_id === catalogId);
  if (products.length === 0) { toast("Este catálogo no tiene productos"); return; }
  let shareText = `🛍️ *${cat.name}*\n\n`;
  products.forEach(p => { if (Number(p.stock) > 0) { shareText += `▪️ *${p.name}* (${p.brand})\n   ${formatUSD(p.sale_price)}\n`; if (p.offer_text) shareText += `   ️ ${p.offer_text}\n`; if (p.description) shareText += `   ${p.description}\n`; shareText += `\n`; } });
  shareText += `📱 _Catálogo compartido desde Catálogo Pro_`;
  const linkInput = $('share-catalog-link'); if (linkInput) linkInput.value = shareText.substring(0, 200) + '...';
  window.currentShareText = shareText; window.currentShareCatalog = cat; openModal('share-catalog-modal');
}
function copyShareLink() { const linkInput = $('share-catalog-link'); if (linkInput && window.currentShareText) { navigator.clipboard.writeText(window.currentShareText).then(() => { toast('Texto copiado ✓'); }).catch(() => { linkInput.select(); document.execCommand('copy'); toast('Texto copiado ✓'); }); } }
function shareCatalogWhatsApp() { if (!window.currentShareText) return; window.open(`https://wa.me/?text=${encodeURIComponent(window.currentShareText)}`, '_blank'); }
function shareCatalogEmail() { if (!window.currentShareText || !window.currentShareCatalog) return; window.open(`mailto:?subject=${encodeURIComponent('Catálogo: ' + window.currentShareCatalog.name)}&body=${encodeURIComponent(window.currentShareText)}`, '_blank'); }

// ==========================================
// ESCÁNER
// ==========================================
let html5QrCode = null;
function openBarcodeScanner() { openModal('barcode-scanner-modal'); setTimeout(() => startBarcodeScanner(), 300); }
async function startBarcodeScanner() {
  if (typeof Html5Qrcode === 'undefined') { toast("Librería de escáner no disponible"); return; }
  try {
    const readerDiv = $('barcode-reader'); if (!readerDiv) return; readerDiv.innerHTML = '';
    html5QrCode = new Html5Qrcode("barcode-reader");
    await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 }, (decodedText) => { handleBarcodeScanned(decodedText); }, () => {});
  } catch (e) { toast("No se pudo acceder a la cámara", 3000); }
}
async function stopBarcodeScanner() { if (html5QrCode) { try { await html5QrCode.stop(); html5QrCode.clear(); } catch (e) {} html5QrCode = null; } }
function handleBarcodeScanned(barcode) {
  console.log('📊 Código escaneado:', barcode.substring(0, 50));
  
  // Si estamos en modo escaneo rápido o el target es quick-scan
  if (state.quickScanMode || window.barcodeScanTarget === 'quick-scan') {
    // Intentar decodificar como QR de la app
    const qrData = decodeProductQR(barcode);
    
    if (qrData) {
      // Es un QR de la app, buscar producto por ID
      const product = state.records.find(r => r.id === qrData.private.id);
      if (product) {
        addToQuickScan(product, 1);
        // Reiniciar escáner para continuar escaneando
        setTimeout(() => startBarcodeScanner(), 500);
        return;
      }
    } else {
      // Es un código de barras normal, buscar en la base de datos
      const product = state.records.find(r => r.barcode === barcode);
      if (product) {
        addToQuickScan(product, 1);
        // Reiniciar escáner para continuar escaneando
        setTimeout(() => startBarcodeScanner(), 500);
        return;
      } else {
        toast(`Producto no encontrado: ${barcode}`, 3000);
        // Reiniciar escáner para continuar escaneando
        setTimeout(() => startBarcodeScanner(), 500);
        return;
      }
    }
  }
  
  // Si el target es quick-scan pero no está en modo quickScanMode
  if (window.barcodeScanTarget === 'quick-scan') {
    window.barcodeScanTarget = null;
    stopBarcodeScanner();
    closeModal('barcode-scanner-modal');
    return;
  }
  
  // Si estamos escaneando para el formulario
  if (window.barcodeScanTarget === 'form') { 
    stopBarcodeScanner(); 
    const barcodeInput = $('product-barcode'); 
    if (barcodeInput) { barcodeInput.value = barcode; toast(`Código: ${barcode}`); } 
    window.barcodeScanTarget = null; 
    closeModal('barcode-scanner-modal'); 
    return; 
  }
  
  // Intentar decodificar como QR de la app
  const qrData = decodeProductQR(barcode);
  
  if (qrData) {
    // Es un QR de la app
    stopBarcodeScanner(); 
    closeModal('barcode-scanner-modal');
    
    // Buscar producto en la base de datos por ID
    const product = state.records.find(r => r.id === qrData.private.id);
    
    if (product) {
      // Si es vendedor/admin, mostrar detalle completo
      if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'coadmin' || state.currentUser.role === 'supervisor')) {
        toast(`Producto: ${product.name}`);
        openDetail(product);
      } else {
        // Si es vendedor normal o comprador, mostrar solo info pública
        showPublicProductInfo(qrData.public);
      }
    } else {
      // Producto no encontrado en base de datos, mostrar solo info pública del QR
      showPublicProductInfo(qrData.public);
    }
  } else {
    // Es un código de barras normal
    stopBarcodeScanner(); 
    closeModal('barcode-scanner-modal');
    const product = state.records.find(r => r.barcode === barcode);
    
    if (product) { 
      toast(`Producto: ${product.name}`); 
      openDetail(product); 
    } else { 
      if (confirm(`Código "${barcode}" no encontrado.\n\n¿Crear nuevo producto?`)) { 
        openForm(); 
        setTimeout(() => { 
          const barcodeInput = $('product-barcode'); 
          if (barcodeInput) barcodeInput.value = barcode; 
        }, 300); 
      } 
    }
  }
}

// Mostrar información pública del producto (para compradores)
function showPublicProductInfo(publicData) {
  const modal = document.createElement('div');
  modal.className = 'modal fixed inset-0 z-50 bg-[#1e1427]/60 p-4 grid place-items-center backdrop-blur-sm open';
  modal.style.display = 'grid';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';
  modal.style.pointerEvents = 'auto';
  
  modal.innerHTML = `
    <article class="modal-card w-full max-w-md bg-white rounded-3xl p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="font-bold text-xl hero-title">Información del Producto</h2>
        <button onclick="this.closest('.modal').remove()" class="w-9 h-9 rounded-full bg-[#f1ecf4] grid place-items-center hover:bg-[#e8dfec]">
          <i data-lucide="x"></i>
        </button>
      </div>
      ${publicData.img ? `<img src="${publicData.img}" alt="${publicData.n}" class="w-full h-48 object-cover rounded-xl mb-4">` : ''}
      <div class="space-y-3">
        <div>
          <p class="text-xs text-[#756c7e] uppercase tracking-wide">Producto</p>
          <p class="font-bold text-lg">${publicData.n}</p>
        </div>
        <div>
          <p class="text-xs text-[#756c7e] uppercase tracking-wide">Marca</p>
          <p class="font-semibold">${publicData.b}</p>
        </div>
        <div>
          <p class="text-xs text-[#756c7e] uppercase tracking-wide">Tipo</p>
          <p>${publicData.t}</p>
        </div>
        ${publicData.c ? `<div>
          <p class="text-xs text-[#756c7e] uppercase tracking-wide">Categoría</p>
          <p>${publicData.c}</p>
        </div>` : ''}
        ${publicData.d ? `<div>
          <p class="text-xs text-[#756c7e] uppercase tracking-wide">Descripción</p>
          <p class="text-sm text-gray-600">${publicData.d}</p>
        </div>` : ''}
        ${publicData.o ? `<div class="p-3 rounded-xl bg-[#fef3c7] border border-[#fde68a]">
          <p class="text-xs text-[#92400e] font-bold uppercase tracking-wide">Oferta</p>
          <p class="font-bold text-[#92400e]">${publicData.o}</p>
        </div>` : ''}
      </div>
      <div class="mt-4 p-3 rounded-xl bg-[#f6f1f8]">
        <p class="text-xs text-[#756c7e] text-center"><i data-lucide="info" class="w-3 h-3 inline"></i> Para ver precios y más detalles, contacta al vendedor</p>
      </div>
    </article>
  `;
  
  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function printProductBarcode(product) {
  if (!product) return; const barcode = product.barcode || product.id;
  const bpn = $('barcode-product-name'); if(bpn) bpn.textContent = product.name;
  try { JsBarcode("#barcode-svg", barcode, { format: "CODE128", width: 2, height: 80, displayValue: true, fontSize: 14, margin: 10 }); }
  catch (e) { try { JsBarcode("#barcode-svg", barcode, { format: "CODE39", width: 1.5, height: 60, displayValue: true, fontSize: 12, margin: 10 }); } catch (e2) { toast("No se pudo generar código"); return; } }
  window.currentBarcodeProduct = product; openModal('barcode-print-modal');
}
function doPrintBarcode() { window.print(); }
function downloadBarcode() {
  const svg = $('barcode-svg'); if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new Image();
  img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); canvas.toBlob(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `codigo_${window.currentBarcodeProduct?.name || 'producto'}.png`; a.click(); URL.revokeObjectURL(url); toast('Código descargado ✓'); }); };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

// ==========================================
// RESPALDOS
// ==========================================
function createBackup() {
  const backup = { version: '1.0', date: new Date().toISOString(), catalogs: state.catalogs, records: state.records, sales: state.sales, contactInfo: state.contactInfo, qrImage: localStorage.getItem(QR_KEY) };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `respaldo_catalogo_${Date.now()}.json`); toast("Respaldo creado ✓"); SoundEffects.play('success');
}
async function restoreBackup(file) {
  try {
    const text = await file.text(); const backup = JSON.parse(text);
    if (!backup.catalogs || !backup.records) { toast("Archivo no válido"); return; }
    if (!confirm("¿Restaurar? Se reemplazarán tus datos.")) return;
    state.catalogs = backup.catalogs; state.records = backup.records; state.sales = backup.sales || [];
    if (backup.contactInfo) { state.contactInfo = backup.contactInfo; localStorage.setItem(CONTACT_KEY, JSON.stringify(backup.contactInfo)); }
    if (backup.qrImage) localStorage.setItem(QR_KEY, backup.qrImage);
    await DB.syncToSupabase(); renderAll(); closeModal("backup-modal"); toast("Respaldo restaurado ✓"); SoundEffects.play('success');
  } catch (e) { toast("Error: " + e.message, 3000); }
}

// ==========================================
// QR SYSTEM
// ==========================================
const QR_TABLE = 'qrs'; let currentQrMenuId = null;
async function loadUserQRs() { 
  if (!state.currentUser || !supabaseClient) return [];
  
  if (!state.isOnline) {
    // En modo offline, devolver QRs guardados localmente
    const localQRs = JSON.parse(localStorage.getItem('local_qrs') || '[]');
    return localQRs.filter(qr => qr.user_id === state.currentUser.id);
  }
  
  try { 
    const { data, error } = await supabaseClient.from(QR_TABLE).select('*').eq('user_id', state.currentUser.id).order('is_primary', { ascending: false }); 
    
    if (!error && data) {
      // Guardar localmente para uso offline
      localStorage.setItem('local_qrs', JSON.stringify(data));
    }
    
    return error ? [] : (data || []); 
  } catch (e) { 
    // Si falla, usar datos locales
    const localQRs = JSON.parse(localStorage.getItem('local_qrs') || '[]');
    return localQRs.filter(qr => qr.user_id === state.currentUser.id);
  } 
}
async function loadOwnerPrimaryQR() { if (!supabaseClient) return null; try { const { data } = await supabaseClient.from(QR_TABLE).select('*').eq('role_owner', true).eq('is_primary', true).limit(1).maybeSingle(); return data || null; } catch (e) { return null; } }
async function createQR(image, label, isPrimary) { 
  if (!state.currentUser || !supabaseClient) return null;
  
  const qr = { 
    user_id: state.currentUser.id, 
    image, 
    label: label || 'Mi QR', 
    is_primary: isPrimary, 
    role_owner: state.currentUser.role === 'admin' || state.currentUser.role === 'coadmin',
    id: 'qr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  };
  
  if (!state.isOnline) {
    // Guardar localmente si está offline
    const localQRs = JSON.parse(localStorage.getItem('local_qrs') || '[]');
    localQRs.push(qr);
    localStorage.setItem('local_qrs', JSON.stringify(localQRs));
    
    // Agregar a cambios pendientes
    addToPendingChanges('createQR', qr);
    
    toast('💾 QR guardado localmente');
    return qr;
  }
  
  try { 
    const { data, error } = await supabaseClient.from(QR_TABLE).insert([qr]).select().single(); 
    
    if (!error && data) {
      // Guardar localmente para uso offline
      const localQRs = JSON.parse(localStorage.getItem('local_qrs') || '[]');
      localQRs.push(data);
      localStorage.setItem('local_qrs', JSON.stringify(localQRs));
    }
    
    return error ? null : data; 
  } catch (e) { 
    // Si falla, guardar localmente
    const localQRs = JSON.parse(localStorage.getItem('local_qrs') || '[]');
    localQRs.push(qr);
    localStorage.setItem('local_qrs', JSON.stringify(localQRs));
    addToPendingChanges('createQR', qr);
    toast('💾 QR guardado localmente');
    return qr;
  } 
}
async function updateQR(id, updates) { if (!supabaseClient) return false; try { const { error } = await supabaseClient.from(QR_TABLE).update(updates).eq('id', id); return !error; } catch (e) { return false; } }
async function deleteQRById(id) { if (!supabaseClient) return false; try { const { error } = await supabaseClient.from(QR_TABLE).delete().eq('id', id); return !error; } catch (e) { return false; } }
async function setPrimaryQR(id) { if (!state.currentUser || !supabaseClient) return false; try { await supabaseClient.from(QR_TABLE).update({ is_primary: false }).eq('user_id', state.currentUser.id); await supabaseClient.from(QR_TABLE).update({ is_primary: true }).eq('id', id); return true; } catch (e) { return false; } }
async function showQRView() {
  const listContainer = $('qr-list-container'); 
  const emptyState = $('qr-empty-state'); 
  if (!listContainer || !emptyState) return;
  
  listContainer.innerHTML = ''; 
  let allQrs = [];
  
  // Mostrar mensaje si está offline
  if (!state.isOnline) {
    const offlineMsg = document.createElement('div');
    offlineMsg.className = 'p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-800 mb-4';
    offlineMsg.innerHTML = '<i data-lucide="wifi-off" class="w-4 h-4 inline mr-2"></i>Modo offline - Mostrando QRs guardados localmente';
    listContainer.appendChild(offlineMsg);
  }
  
  try {
    if (state.currentUser && (state.currentUser.role === 'vendedor' || state.currentUser.role === 'supervisor')) {
      const ownerPrimary = await loadOwnerPrimaryQR(); 
      if (ownerPrimary) allQrs.push(Object.assign({}, ownerPrimary, { _isOwnerQR: true }));
      const myQrs = await loadUserQRs(); 
      myQrs.forEach(qr => allQrs.push(Object.assign({}, qr, { _isOwnerQR: false })));
    } else if (state.currentUser) { 
      const myQrs = await loadUserQRs(); 
      myQrs.forEach(qr => allQrs.push(Object.assign({}, qr, { _isOwnerQR: false }))); 
    }
  } catch (e) { 
    console.error('Error cargando QRs:', e);
    if (!state.isOnline) {
      toast('⚠️ Usando QRs guardados localmente');
    }
  }
  
  if (allQrs.length === 0) { 
    emptyState.classList.remove('hidden'); 
  } else { 
    emptyState.classList.add('hidden'); 
    allQrs.forEach(qr => listContainer.appendChild(createQrCard(qr))); 
  }
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function createQrCard(qr) {
  const card = document.createElement('div'); const isPrimary = qr.is_primary; const isOwnerQR = qr._isOwnerQR; const canEdit = !isOwnerQR;
  let headerLabel = ''; if (isOwnerQR) headerLabel = '<span class="text-[10px] uppercase tracking-wider font-bold text-[#7c43ba]">QR del Negocio</span>';
  else if (state.currentUser.role === 'vendedor') headerLabel = '<span class="text-[10px] uppercase tracking-wider font-bold text-[#23805d]">Mi QR Personal</span>';
  else headerLabel = '<span class="text-[10px] uppercase tracking-wider font-bold text-[#756c7e]">Mi QR</span>';
  const primaryBadge = isPrimary ? '<span class="absolute top-2 left-2 bg-[#7c43ba] text-white text-[10px] font-bold px-2 py-1 rounded-full">Principal</span>' : '';
  card.className = 'relative rounded-2xl border-2 ' + (isPrimary ? 'border-[#7c43ba]' : 'border-[#ede7f0]') + ' overflow-hidden bg-white cursor-pointer';
  card.innerHTML = primaryBadge + '<div class="flex items-center gap-3 p-3"><img src="' + qr.image + '" alt="' + qr.label + '" class="w-20 h-20 rounded-xl object-cover bg-[#f6f1f8] flex-shrink-0"><div class="flex-1 min-w-0">' + headerLabel + '<p class="font-bold text-sm mt-1 truncate">' + qr.label + '</p></div>' + (canEdit ? '<button class="qr-menu-btn w-9 h-9 rounded-full hover:bg-[#f1ecf4] grid place-items-center flex-shrink-0" data-qr-id="' + qr.id + '"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>' : '') + '</div>';
  card.onclick = (e) => { if (e.target.closest('.qr-menu-btn')) return; openQrLightbox(qr.image, qr.label); };
  if (canEdit) { const menuBtn = card.querySelector('.qr-menu-btn'); if (menuBtn) menuBtn.onclick = (e) => { e.stopPropagation(); openQrItemMenu(qr); }; }
  return card;
}
function openQrLightbox(imageSrc, label) { const lightbox = $('qr-lightbox'); const img = $('qr-lightbox-img'); const lbl = $('qr-lightbox-label'); if (lightbox && img && lbl) { img.src = imageSrc; lbl.textContent = label || ''; lightbox.classList.remove('hidden'); lightbox.classList.add('flex'); } }
function openQrItemMenu(qr) { currentQrMenuId = qr.id; const preview = $('qr-item-menu-preview'); if (preview) preview.innerHTML = '<img src="' + qr.image + '" class="w-24 h-24 rounded-xl object-cover mx-auto mb-2"><p class="font-bold text-sm">' + qr.label + '</p>'; const setPrimaryBtn = $('qr-menu-set-primary'); if (setPrimaryBtn) setPrimaryBtn.style.display = qr.is_primary ? 'none' : 'flex'; openModal('qr-item-menu-modal'); }
async function handleNewQrUpload() { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; const label = prompt('Nombre del QR:', 'Mi QR'); if (label === null) return; const base64 = await compressImage(file, 600, 0.9); const existingQrs = await loadUserQRs(); const newQr = await createQR(base64, label || 'Mi QR', existingQrs.length === 0); if (newQr) { toast('QR agregado'); showQRView(); } }; input.click(); }
async function qrMenuSetPrimary() { if (!currentQrMenuId) return; if (await setPrimaryQR(currentQrMenuId)) { toast('QR establecido como principal'); closeModal('qr-item-menu-modal'); showQRView(); } }
async function qrMenuChange() { if (!currentQrMenuId) return; const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = async (e) => { const file = e.target.files[0]; if (!file) return; const base64 = await compressImage(file, 600, 0.9); if (await updateQR(currentQrMenuId, { image: base64 })) { toast('QR actualizado'); closeModal('qr-item-menu-modal'); showQRView(); } }; input.click(); }
async function qrMenuRename() { if (!currentQrMenuId) return; const newLabel = prompt('Nuevo nombre:'); if (newLabel === null || newLabel.trim() === '') return; if (await updateQR(currentQrMenuId, { label: newLabel.trim() })) { toast('Nombre actualizado'); closeModal('qr-item-menu-modal'); showQRView(); } }
function qrMenuShare() { if (!currentQrMenuId) return; loadUserQRs().then(qrs => { const qr = qrs.find(q => q.id === currentQrMenuId); if (qr) window.open('https://wa.me/?text=' + encodeURIComponent('Te comparto mi codigo QR: ' + qr.label), '_blank'); }); }
function qrMenuDownload() { if (!currentQrMenuId) return; loadUserQRs().then(qrs => { const qr = qrs.find(q => q.id === currentQrMenuId); if (qr) { const link = document.createElement('a'); link.download = 'qr_' + qr.label + '.png'; link.href = qr.image; link.click(); toast('QR descargado'); } }); }
async function qrMenuDelete() { if (!currentQrMenuId || !confirm('¿Eliminar este QR?')) return; if (await deleteQRById(currentQrMenuId)) { toast('QR eliminado'); closeModal('qr-item-menu-modal'); showQRView(); } }

// ==========================================
// VENTAS DEL DÍA
// ==========================================
function renderDailySales() {
  // Ordenar ventas por fecha descendente (más recientes primero)
  const todaySales = getTodaySales().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const count = todaySales.length;
  const revenue = todaySales.reduce((a, s) => a + Number(s.actual_price || 0), 0);
  const profit = todaySales.reduce((a, s) => a + Number(s.profit || 0), 0);
  const cash = todaySales.filter(s => s.payment_method === 'Efec.').reduce((a, s) => a + Number(s.actual_price || 0), 0);
  const qr = todaySales.filter(s => s.payment_method === 'QR').reduce((a, s) => a + Number(s.actual_price || 0), 0);
  const dsc = $("daily-sales-count"); if(dsc) dsc.textContent = count;
  const dsr = $("daily-sales-revenue"); if(dsr) dsr.textContent = formatUSDShort(revenue);
  const dsp = $("daily-sales-profit"); if(dsp) dsp.textContent = formatUSDShort(profit);
  const dscash = $("daily-sales-cash"); if(dscash) dscash.textContent = formatUSDShort(cash);
  const dsqr = $("daily-sales-qr"); if(dsqr) dsqr.textContent = formatUSDShort(qr);
  const list = $("daily-sales-list"); if(list) list.innerHTML = "";
  if (todaySales.length === 0) { $("no-daily-sales").classList.remove("hidden"); return; }
  $("no-daily-sales").classList.add("hidden");
  todaySales.forEach(s => {
    const row = document.createElement('div'); row.className = 'sale-row rounded-xl p-3 flex items-center gap-3 shadow-sm bg-white';
    const date = new Date(s.date); const dateStr = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const sellerInfo = s.seller_name ? `<p class="text-[10px] text-[#7c43ba] font-bold">${s.seller_name}</p>` : '';
    const payInfo = s.payment_method ? `<span class="text-[9px] px-2 py-0.5 rounded-full ${s.payment_method === 'QR' ? 'bg-[#f6f1f8] text-[#7c43ba]' : 'bg-[#f0fdf4] text-[#166534]'} font-bold">${s.payment_method}</span>` : '';
    const qtyInfo = s.quantity && s.quantity > 1 ? `<span class="text-[10px] text-[#756c7e]">x${s.quantity}</span>` : '';
    row.innerHTML = `<div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${s.product_name} ${qtyInfo}</p>${sellerInfo}<div class="flex items-center gap-1 mt-1">${payInfo}<p class="text-xs text-[#756c7e]">${dateStr}</p></div></div>
      <div class="text-right flex-shrink-0"><p class="font-bold text-sm text-[#7c43ba]">${formatUSD(s.actual_price)}</p><p class="text-xs text-[#166534] font-bold">+${formatUSD(s.profit)}</p></div>`;
    list.appendChild(row);
  });
}

// ==========================================
// LOGIN Y EQUIPO
// ==========================================
function checkMidnightReset() {
  const cachedUserStr = localStorage.getItem('current_user');
  const lastLoginDate = localStorage.getItem('last_login_date');
  const today = new Date().toDateString();
  if (cachedUserStr && lastLoginDate !== today) { localStorage.removeItem('current_user'); localStorage.removeItem('last_login_date'); state.currentUser = null; }
  else if (cachedUserStr) { state.currentUser = JSON.parse(cachedUserStr); }
}

async function handleLogin(usernameOrEmail, password) {
  const errorDiv = $('login-error'); const submitBtn = $('login-submit');
  if(errorDiv) errorDiv.classList.add('hidden');
  if(submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Verificando...'; }
  try {
    const isOnline = navigator.onLine; const inputVal = usernameOrEmail.trim().toLowerCase();
    
    // MODO OFFLINE: Usar credenciales guardadas localmente
    if (!isOnline) {
      const offlineUsers = JSON.parse(localStorage.getItem('offline_users') || '[]');
      const user = offlineUsers.find(u => 
        u.username.toLowerCase() === inputVal || 
        u.email.toLowerCase() === inputVal
      );
      
      if (!user) {
        throw new Error('Usuario no encontrado. Inicia sesión con internet primero.');
      }
      
      if (user.password !== password) {
        throw new Error('Contraseña incorrecta.');
      }
      
      if (user.status === 'blocked') {
        throw new Error('Tu cuenta está bloqueada.');
      }
      
      // Login offline exitoso
      const sessionUser = { id: user.id, name: user.name, username: user.username, email: user.email, phone: user.phone, role: user.role, status: user.status };
      state.currentUser = sessionUser;
      localStorage.setItem('current_user', JSON.stringify(sessionUser));
      localStorage.setItem('last_login_date', new Date().toDateString());
      finalizeLogin();
      toast('✅ Sesión iniciada (modo offline)');
      return;
    }
    
    // MODO ONLINE: Verificar en Supabase
    const { data: users, error } = await supabaseClient.from('users').select('*').or(`username.eq.${inputVal},email.eq.${inputVal}`).limit(1);
    if (error || !users || users.length === 0) throw new Error('Usuario o contraseña incorrectos');
    const user = users[0];
    if (user.status === 'blocked') throw new Error('Tu cuenta ha sido bloqueada.');
    if (user.password !== password) {
      const attempts = (user.login_attempts || 0) + 1;
      if (attempts >= 5) { const blockUntil = new Date(Date.now() + 15 * 60000); await supabaseClient.from('users').update({ login_attempts: attempts, blocked_until: blockUntil.toISOString() }).eq('id', user.id); throw new Error('Cuenta bloqueada por 15 minutos.'); }
      else { await supabaseClient.from('users').update({ login_attempts: attempts }).eq('id', user.id); throw new Error(`Usuario o contraseña incorrectos. Intento ${attempts}/5.`); }
    }
    await supabaseClient.from('users').update({ login_attempts: 0, blocked_until: null, last_login: new Date().toISOString(), last_activity: new Date().toISOString() }).eq('id', user.id);
    const sessionUser = { id: user.id, name: user.name, username: user.username, email: user.email, phone: user.phone, role: user.role, status: user.status };
    state.currentUser = sessionUser;
    localStorage.setItem('current_user', JSON.stringify(sessionUser));
    localStorage.setItem('last_login_date', new Date().toDateString());
    
    // Guardar credenciales para modo offline
    saveUserForOfflineLogin(user);
    
    finalizeLogin();
  } catch (err) {
    if(errorDiv) { errorDiv.textContent = '❌ ' + err.message; errorDiv.classList.remove('hidden'); }
    if(submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> Iniciar sesión'; }
    SoundEffects.play('error');
  }
}

// Guardar usuario para login offline
function saveUserForOfflineLogin(user) {
  const offlineUsers = JSON.parse(localStorage.getItem('offline_users') || '[]');
  const existingIndex = offlineUsers.findIndex(u => u.id === user.id);
  
  const userData = {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    password: user.password // En producción, esto debería estar encriptado
  };
  
  if (existingIndex >= 0) {
    offlineUsers[existingIndex] = userData;
  } else {
    offlineUsers.push(userData);
  }
  
  localStorage.setItem('offline_users', JSON.stringify(offlineUsers));
}

function finalizeLogin() {
  const errorDiv = $('login-error'); const submitBtn = $('login-submit');
  if(errorDiv) errorDiv.classList.add('hidden');
  if(submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> Iniciar sesión'; }
  SoundEffects.play('success'); toast(`¡Bienvenido, ${state.currentUser.name}! 🎉`);
  $('login-screen').classList.add('hidden-login');
  if (!localStorage.getItem('welcome_seen_v12')) { const ws = $('welcome-screen'); if(ws) ws.classList.remove('hidden-welcome'); }
  else { document.querySelectorAll('.screen').forEach(x => x.classList.remove('active')); const catalogScreen = document.getElementById('catalog-screen'); if (catalogScreen) catalogScreen.classList.add('active'); }
  applyUserPermissions(); startHeartbeat(); renderAll();
  if (typeof lucide !== 'undefined') lucide.createIcons(); startAutoSync();
}

var heartbeatInterval = null;
function startHeartbeat() { if (heartbeatInterval) clearInterval(heartbeatInterval); if (!state.currentUser || !supabaseClient) return; heartbeatInterval = setInterval(async function() { try { await supabaseClient.from('users').update({ last_activity: new Date().toISOString() }).eq('id', state.currentUser.id); } catch (e) {} }, 30000); }
function stopHeartbeat() { if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; } }
function logout() { if (!confirm('¿Cerrar sesión?')) return; stopHeartbeat(); state.currentUser = null; localStorage.removeItem('current_user'); localStorage.removeItem('last_login_date'); location.reload(); }

async function handleChangePassword(e) {
  e.preventDefault();
  const newPass = $('new-password').value; const confirmPass = $('confirm-new-password').value;
  if (newPass.length < 6) { toast('Mínimo 6 caracteres'); return; }
  if (newPass !== confirmPass) { toast('Las contraseñas no coinciden'); return; }
  try { await supabaseClient.from('users').update({ password: newPass }).eq('id', state.currentUser.id); toast('Contraseña actualizada'); closeModal('change-password-modal'); $('change-password-form').reset(); }
  catch (err) { toast('Error al actualizar contraseña'); }
}

let currentTeamUserId = null; let teamFilter = 'today';
async function loadTeamUsers(filter) { if (!supabaseClient) return []; try { const { data, error } = await supabaseClient.from('users').select('*').order('last_login', { ascending: false }); if (error) return []; let users = data || []; if (filter === 'today') { const today = new Date(); today.setHours(0, 0, 0, 0); users = users.filter(u => u.last_login && new Date(u.last_login) >= today); } return users; } catch (e) { return []; } }
async function showTeamModal() { 
  if (!state.isOnline) {
    toast('⚠️ La gestión de equipo requiere conexión a internet');
    return;
  }
  openModal('team-modal'); 
  await renderTeamList(); 
}
async function renderTeamList() {
  const list = $('team-list'); const empty = $('team-empty'); if (!list || !empty) return; list.innerHTML = '';
  const users = await loadTeamUsers(teamFilter);
  if (users.length === 0) { empty.classList.remove('hidden'); } else { empty.classList.add('hidden'); users.forEach(user => list.appendChild(createTeamUserCard(user))); }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
function createTeamUserCard(user) {
  const card = document.createElement('div'); const isCurrentUser = state.currentUser && state.currentUser.id === user.id; const isBlocked = user.status === 'blocked';
  let roleText = 'Vendedor', roleIcon = '👤', roleColor = '#23805d';
  if (user.role === 'admin') { roleText = 'Administrador'; roleIcon = '👑'; roleColor = '#7c43ba'; }
  else if (user.role === 'coadmin') { roleText = 'Co-Administrador'; roleIcon = '⭐'; roleColor = '#d97706'; }
  else if (user.role === 'supervisor') { roleText = 'Supervisor'; roleIcon = '📊'; roleColor = '#3875a5'; }
  const currentBadge = isCurrentUser ? '<span class="text-[10px] bg-[#7c43ba] text-white px-2 py-0.5 rounded-full font-bold">Tú</span>' : '';
  const statusBadge = isBlocked ? '<span class="text-[10px] bg-[#a43658] text-white px-2 py-0.5 rounded-full font-bold">Bloqueado</span>' : '';
  card.className = 'rounded-2xl border-2 ' + (isBlocked ? 'border-[#a43658] opacity-60' : 'border-[#ede7f0]') + ' overflow-hidden bg-white';
  card.innerHTML = '<div class="flex items-center gap-3 p-3"><div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style="background:' + roleColor + '20">' + roleIcon + '</div><div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap"><p class="font-bold text-sm truncate">' + user.name + '</p>' + currentBadge + statusBadge + '</div><p class="text-[11px] text-[#756c7e] truncate">' + (user.username || user.email) + '</p></div>' + (!isCurrentUser ? '<button class="team-user-menu-btn w-9 h-9 rounded-full hover:bg-[#f1ecf4] grid place-items-center flex-shrink-0" data-user-id="' + user.id + '"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>' : '') + '</div>';
  if (!isCurrentUser) { const menuBtn = card.querySelector('.team-user-menu-btn'); if (menuBtn) menuBtn.onclick = (e) => { e.stopPropagation(); openTeamUserMenu(user); }; }
  return card;
}
function openTeamUserMenu(user) {
  currentTeamUserId = user.id; const preview = $('team-user-preview');
  if (preview) { const rText = user.role === 'admin' ? 'Administrador' : user.role === 'coadmin' ? 'Co-Administrador' : user.role === 'supervisor' ? 'Supervisor' : 'Vendedor'; preview.innerHTML = '<p class="font-bold text-sm">' + user.name + '</p><p class="text-xs text-[#756c7e]">' + (user.username || user.email) + '</p><p class="text-xs text-[#756c7e] mt-1">Rol: ' + rText + '</p>'; }
  openModal('team-user-menu-modal');
}
async function teamUserToggleStatus() { if (!currentTeamUserId || !supabaseClient) return; try { const { data } = await supabaseClient.from('users').select('status').eq('id', currentTeamUserId).single(); const newStatus = data.status === 'blocked' ? 'active' : 'blocked'; await supabaseClient.from('users').update({ status: newStatus }).eq('id', currentTeamUserId); toast(newStatus === 'blocked' ? 'Usuario bloqueado' : 'Usuario desbloqueado'); closeModal('team-user-menu-modal'); renderTeamList(); } catch (e) { toast('Error'); } }
function teamUserChangeRole() { if (!currentTeamUserId) return; loadTeamUsers('all').then(users => { const user = users.find(u => u.id === currentTeamUserId); if (!user) return; const preview = $('team-change-role-preview'); if (preview) preview.innerHTML = '<p class="font-bold text-sm">' + user.name + '</p>'; const select = $('team-role-select'); if (select) select.value = user.role; closeModal('team-user-menu-modal'); openModal('team-change-role-modal'); }); }
async function confirmTeamChangeRole() { if (!currentTeamUserId || !supabaseClient) return; const select = $('team-role-select'); if (!select) return; const newRole = select.value; try { await supabaseClient.from('users').update({ role: newRole }).eq('id', currentTeamUserId); toast('Rol actualizado'); closeModal('team-change-role-modal'); renderTeamList(); } catch (e) { toast('Error'); } }
async function teamUserResetPassword() { if (!currentTeamUserId || !supabaseClient) return; const newPassword = prompt('Nueva contraseña:'); if (!newPassword || newPassword.length < 6) { toast('Mínimo 6 caracteres'); return; } try { await supabaseClient.from('users').update({ password: newPassword.trim() }).eq('id', currentTeamUserId); toast('Contraseña restablecida'); closeModal('team-user-menu-modal'); } catch (e) { toast('Error'); } }
async function teamUserDelete() { if (!currentTeamUserId || !supabaseClient) return; if (!confirm('¿Eliminar este usuario?')) return; try { await supabaseClient.from('users').delete().eq('id', currentTeamUserId); toast('Usuario eliminado'); closeModal('team-user-menu-modal'); renderTeamList(); } catch (e) { toast('Error'); } }
function showCreateUserModal() { $('new-user-name').value = ''; $('new-user-username').value = ''; $('new-user-email').value = ''; $('new-user-phone').value = ''; $('new-user-password').value = ''; $('new-user-role').value = 'vendedor'; openModal('create-user-modal'); }
async function handleCreateUser(e) {
  e.preventDefault(); 
  
  if (!state.isOnline) {
    toast('⚠️ La creación de usuarios requiere conexión a internet');
    return;
  }
  
  const submitBtn = $('submit-create-user');
  const name = $('new-user-name').value.trim(); const username = $('new-user-username').value.trim().toLowerCase();
  const email = $('new-user-email').value.trim().toLowerCase(); const phone = $('new-user-phone').value.trim();
  const password = $('new-user-password').value.trim(); const role = $('new-user-role').value;
  if (!name || !username || !password) { toast('Nombre, Usuario y Contraseña son obligatorios'); return; }
  if (password.length < 6) { toast('Mínimo 6 caracteres'); return; }
  submitBtn.disabled = true; submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Creando...';
  try {
    const { data: existing } = await supabaseClient.from('users').select('id').or(`username.eq.${username},email.eq.${email}`).limit(1);
    if (existing && existing.length > 0) { toast('Usuario o correo ya registrado'); submitBtn.disabled = false; submitBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Crear usuario'; return; }
    const newUser = { name, username, email, phone, password, role, status: 'active', login_attempts: 0 };
    const { error } = await supabaseClient.from('users').insert([newUser]);
    if (error) { toast('Error: ' + error.message); } else { toast('Usuario creado ✓'); closeModal('create-user-modal'); renderTeamList(); }
  } catch (err) { toast('Error de conexión'); }
  submitBtn.disabled = false; submitBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Crear usuario';
}

function applyUserPermissions() {
  if (!state.currentUser) return;
  const role = state.currentUser.role; const isAdmin = (role === 'admin' || role === 'coadmin');
  const isVendedor = (role === 'vendedor');
  if (isVendedor) document.body.classList.add('modo-vendedor'); else document.body.classList.remove('modo-vendedor');
  const clientModeBtn = $('client-mode-btn'); if (clientModeBtn) clientModeBtn.style.display = isVendedor ? 'none' : '';
  document.querySelectorAll('.admin-only').forEach(el => { if (el) el.style.display = isAdmin ? '' : 'none'; });
  document.querySelectorAll('.sensitive-data').forEach(el => { el.style.display = isAdmin ? '' : 'none'; });
  // FIX: Usar detail-pencil en vez de detail-edit
  const detailPencil = $('detail-pencil'); if (detailPencil) detailPencil.style.display = isAdmin ? '' : 'none';
  const sidebarSubtitle = $('sidebar-user-info');
  if (sidebarSubtitle) {
    let roleText = 'Vendedor'; if (isAdmin) roleText = 'Administrador'; else if (role === 'coadmin') roleText = 'Co-Administrador'; else if (role === 'supervisor') roleText = 'Supervisor';
    sidebarSubtitle.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span><span>${state.currentUser.name} (${roleText})</span>`;
  }
}

function openUserProfile() {
  if (!state.currentUser) { toast('No hay sesión'); return; }
  const isAdmin = state.currentUser.role === 'admin' || state.currentUser.role === 'coadmin';
  const pName = $('profile-name'); if(pName) pName.value = state.currentUser.name || '';
  const pEmail = $('profile-email'); if(pEmail) pEmail.value = state.currentUser.email || '';
  const pPhone = $('profile-phone'); if(pPhone) pPhone.value = state.currentUser.phone || '';
  const pUser = $('profile-username'); if(pUser) pUser.value = state.currentUser.username || '';
  const pRole = $('profile-role'); if(pRole) pRole.value = state.currentUser.role || '';
  const content = $('user-profile-content'); const vendorMsg = $('user-profile-vendor-message');
  if (content && vendorMsg) { if (isAdmin) { content.classList.remove('hidden'); vendorMsg.classList.add('hidden'); } else { content.classList.add('hidden'); vendorMsg.classList.remove('hidden'); } }
  openModal('user-profile-modal');
}

async function saveUserProfile() {
  if (!state.currentUser) return;
  const name = $('profile-name').value.trim(); const email = $('profile-email').value.trim(); const phone = $('profile-phone').value.trim();
  if (!name) { toast('El nombre es obligatorio'); return; }
  try { await supabaseClient.from('users').update({ name, email, phone }).eq('id', state.currentUser.id); state.currentUser.name = name; state.currentUser.email = email; state.currentUser.phone = phone; localStorage.setItem('current_user', JSON.stringify(state.currentUser)); applyUserPermissions(); toast('Perfil actualizado ✓'); closeModal('user-profile-modal'); }
  catch (e) { toast('Error al actualizar perfil'); }
}

// FIX: Función que faltaba - requestProfileChange
function requestProfileChange() {
  const contactWhatsapp = state.contactInfo?.whatsapp || '';
  const userName = state.currentUser?.name || 'Usuario';
  const msg = `Hola, soy ${userName}. Necesito actualizar mis datos de perfil. Por favor, ayúdame con los siguientes cambios:`;
  if (contactWhatsapp) { window.open(`https://wa.me/${contactWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); }
  else { navigator.clipboard.writeText(msg); toast('Mensaje copiado. Envíalo al administrador.'); }
}

// ==========================================
// IMPORTAR ARCHIVOS
// ==========================================
function findOrCreateCatalog(catalogName) {
  if (!catalogName) return state.catalogs[0]?.id || 'default';
  const normalized = String(catalogName).trim().toLowerCase();
  let cat = state.catalogs.find(c => c.name.toLowerCase() === normalized);
  if (cat) return cat.id;
  cat = state.catalogs.find(c => c.name.toLowerCase().includes(normalized) || normalized.includes(c.name.toLowerCase()));
  if (cat) return cat.id;
  const newCat = { id: 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), name: String(catalogName).trim(), label: String(catalogName).trim().toUpperCase().slice(0, 15), color: '#7c43ba', cover: fallbackCover, favorite: false };
  state.catalogs.push(newCat); return newCat.id;
}

async function importFile(file, targetCatalogId = null) {
  toast("Importando...", 3000);
  try {
    if (file.name.endsWith('.json')) {
      const text = await file.text(); const data = JSON.parse(text);
      if (data.catalogs && data.records) {
        let importedRecords = 0;
        data.catalogs.forEach(c => { if (targetCatalogId) c.id = targetCatalogId; if (!c.favorite) c.favorite = false; if (!state.catalogs.find(x => x.id === c.id)) state.catalogs.push(c); });
        data.records.forEach(r => { if (targetCatalogId) r.catalog_id = targetCatalogId; else if (r.catalog_id) r.catalog_id = findOrCreateCatalog(r.catalog_id); if (!r.id) r.id = Date.now().toString() + Math.random().toString(36).slice(2, 6); if (!r.barcode) r.barcode = ''; if (!state.records.find(x => x.id === r.id)) { state.records.push(r); importedRecords++; } });
        if (data.sales) data.sales.forEach(s => { if (!state.sales.find(x => x.id === s.id)) state.sales.push(s); });
        await DB.syncToSupabase(); renderAll(); toast(`Importado: ${importedRecords} productos ✓`); SoundEffects.play('success');
      } else toast("JSON no válido");
    } else if (file.name.endsWith('.csv')) {
      const text = await file.text(); const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast("CSV vacío"); return; }
      const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase()); let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]); const obj = {};
        headers.forEach((h, idx) => obj[h] = values[idx]);
        const catalogId = targetCatalogId || findOrCreateCatalog(obj.catalogo || obj.catalogo_id);
        state.records.push({ id: Date.now().toString() + i, name: obj.nombre || '', brand: obj.marca || '', type: obj.tipo || 'Otro', category: obj.categoria || '', barcode: obj.codigo_barras || '', cost_price: Number(obj.costo) || 0, sale_price: Number(obj.precio_venta_max || obj.precio_venta) || 0, min_price: Number(obj.precio_venta_min) || 0, stock: Number(obj.stock) || 1, sold: false, description: obj.descripcion || '', catalog_id: catalogId, image_url: '', offer_text: obj.oferta || '' });
        imported++;
      }
      await DB.syncToSupabase(); renderAll(); toast(`Importados ${imported} productos ✓`); SoundEffects.play('success');
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      if (typeof XLSX === 'undefined') { toast("Librería Excel no disponible"); return; }
      const data = await file.arrayBuffer(); const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(ws); let imported = 0;
      rows.forEach((r, i) => {
        const catalogId = targetCatalogId || findOrCreateCatalog(r.Catálogo || r.catalogo);
        state.records.push({ id: Date.now().toString() + i, name: r.Nombre || '', brand: r.Marca || '', type: r.Tipo || 'Otro', category: r.Categoría || '', barcode: r['Código Barras'] || '', cost_price: Number(r.Costo) || 0, sale_price: Number(r['Precio Venta Máx'] || r['Precio Venta']) || 0, min_price: Number(r['Precio Venta Mín']) || 0, stock: Number(r.Stock) || 1, sold: false, description: r.Descripción || '', catalog_id: catalogId, image_url: '', offer_text: r.Oferta || '' });
        imported++;
      });
      await DB.syncToSupabase(); renderAll(); toast(`Importados ${imported} productos ✓`); SoundEffects.play('success');
    } else toast("Formato no soportado");
  } catch (e) { toast("Error: " + e.message, 3000); SoundEffects.play('error'); }
}

function parseCSVLine(line) { const result = []; let current = ''; let inQuotes = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; } else if (ch === ',' && !inQuotes) { result.push(current); current = ''; } else current += ch; } result.push(current); return result; }

// Búsqueda por imagen
function getAverageColor(imgElement) { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const size = 40; canvas.width = size; canvas.height = size; try { ctx.drawImage(imgElement, 0, 0, size, size); const data = ctx.getImageData(0, 0, size, size).data; let r = 0, g = 0, b = 0, count = 0; for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; } return [r / count, g / count, b / count]; } catch (e) { return [128, 128, 128]; } }
function colorDistance(c1, c2) { return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2) + Math.pow(c1[2] - c2[2], 2)); }
function searchByImage(file) {
  toast("Buscando productos similares...", 3000);
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const targetColor = getAverageColor(img);
      const scored = state.records.map(r => { const prodImg = new Image(); prodImg.src = cardImage(r); return { record: r, img: prodImg }; });
      Promise.all(scored.map(s => new Promise(resolve => { if (s.img.complete && s.img.naturalWidth > 0) { s.color = getAverageColor(s.img); resolve(s); } else { s.img.onload = () => { s.color = getAverageColor(s.img); resolve(s); }; s.img.onerror = () => { s.color = [128, 128, 128]; resolve(s); }; } }))).then(results => {
        const sorted = results.map(s => ({ record: s.record, distance: colorDistance(targetColor, s.color) })).sort((a, b) => a.distance - b.distance).slice(0, 6);
        showSimilarProducts(sorted);
      });
    };
    img.src = e.target.result; $("image-search-preview").src = e.target.result; $("image-search-preview").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}
function showSimilarProducts(scored) {
  const list = $("similar-products-list"); list.innerHTML = ""; $("image-search-results").classList.remove("hidden");
  if (scored.length === 0) { list.innerHTML = '<p class="text-sm text-[#756c7e] text-center py-4">No hay productos.</p>'; return; }
  scored.forEach(({ record, distance }) => {
    const similarity = Math.max(0, Math.min(100, Math.round((1 - distance / 441) * 100)));
    const item = document.createElement('button'); item.type = 'button';
    item.className = 'w-full flex items-center gap-3 p-3 rounded-2xl bg-[#f6f1f8] hover:bg-[#eee1f8] transition text-left shadow-sm';
    item.innerHTML = `<img src="${cardImage(record)}" alt="" class="w-14 h-14 rounded-xl object-cover"><div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${record.name}</p><p class="text-xs text-[#756c7e] truncate">${record.brand}</p></div><div class="text-right flex-shrink-0"><p class="text-xs text-[#756c7e]">Similitud</p><p class="font-bold text-[#7c43ba]">${similarity}%</p></div>`;
    item.onclick = () => { closeModal("image-search-modal"); openDetail(record); };
    list.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// SISTEMA DE QR PARA PRODUCTOS (NUEVO)
// ==========================================

// Generar datos encriptados para el QR del producto
function generateProductQRData(product) {
  // Datos públicos (visibles para todos)
  const publicData = {
    v: 1, // versión
    n: product.name,
    b: product.brand,
    t: product.type,
    c: product.category,
    d: product.description || '',
    o: product.offer_text || '',
    img: product.image_url || ''
  };
  
  // Datos privados (solo para vendedores) - encriptados con base64
  const privateData = {
    cp: product.cost_price,
    sp: product.sale_price,
    mp: product.min_price,
    st: product.stock,
    bc: product.barcode || '',
    id: product.id
  };
  
  // Combinar y codificar
  const combined = {
    pub: publicData,
    priv: btoa(JSON.stringify(privateData)) // Encriptar datos privados
  };
  
  return 'CATPRO:' + btoa(JSON.stringify(combined));
}

// Decodificar QR de producto
function decodeProductQR(qrData) {
  try {
    if (!qrData.startsWith('CATPRO:')) return null;
    
    const encoded = qrData.substring(7);
    const decoded = JSON.parse(atob(encoded));
    
    // Decodificar datos privados
    const privateData = JSON.parse(atob(decoded.priv));
    
    return {
      public: decoded.pub,
      private: privateData
    };
  } catch (e) {
    console.error('Error decodificando QR:', e);
    return null;
  }
}

// Generar imagen QR para un producto
async function generateProductQRImage(product, size = 300) {
  const qrData = generateProductQRData(product);
  
  // Crear canvas para el QR
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  
  // Usar QRCode.js si está disponible, sino usar una librería CDN
  if (typeof QRCode === 'undefined') {
    // Cargar librería QRCode dinámicamente
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // Generar QR
  await QRCode.toCanvas(canvas, qrData, {
    width: size,
    margin: 2,
    color: {
      dark: '#201728',
      light: '#ffffff'
    }
  });
  
  return canvas.toDataURL('image/png');
}

// Mostrar modal de QR del producto
async function showProductQRModal(product) {
  try {
    toast('Generando QR...', 2000);
    const qrImage = await generateProductQRImage(product);
    
    // Mostrar modal con el QR
    const modal = $('product-qr-modal');
    const qrImg = $('product-qr-image');
    const qrName = $('product-qr-name');
    const qrPrice = $('product-qr-price');
    
    if (qrImg) qrImg.src = qrImage;
    if (qrName) qrName.textContent = product.name;
    if (qrPrice) qrPrice.textContent = formatUSD(product.sale_price);
    
    // Guardar referencia al producto
    window.currentQRProduct = product;
    
    openModal('product-qr-modal');
  } catch (e) {
    console.error('Error generando QR:', e);
    toast('Error al generar QR: ' + e.message, 4000);
  }
}

// Descargar QR individual
function downloadProductQR() {
  const product = window.currentQRProduct;
  if (!product) return;
  
  const qrImg = $('product-qr-image');
  if (!qrImg) return;
  
  const link = document.createElement('a');
  link.download = `QR_${product.name.replace(/[^a-z0-9]/gi, '_')}.png`;
  link.href = qrImg.src;
  link.click();
  
  toast('QR descargado ✓');
  SoundEffects.play('success');
}

// Imprimir QR individual
function printProductQR() {
  const product = window.currentQRProduct;
  if (!product) return;
  
  const qrImg = $('product-qr-image');
  if (!qrImg) return;
  
  const printWindow = window.open('', '', 'width=400,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>QR - ${product.name}</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
          img { max-width: 300px; margin: 20px 0; }
          h2 { margin: 10px 0; }
          p { margin: 5px 0; color: #666; }
        </style>
      </head>
      <body>
        <h2>${product.name}</h2>
        <p>${product.brand}</p>
        <img src="${qrImg.src}" alt="QR Code">
        <p><strong>Precio: ${formatUSD(product.sale_price)}</strong></p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// Generar y descargar todos los QR de un catálogo
async function downloadAllCatalogQR(catalogId) {
  const products = state.records.filter(r => r.catalog_id === catalogId);
  
  if (products.length === 0) {
    toast('No hay productos en este catálogo');
    return;
  }
  
  toast(`Generando ${products.length} QRs...`, 5000);
  
  try {
    // Crear un HTML con todos los QRs para imprimir
    let html = `
      <html>
        <head>
          <title>Códigos QR - Catálogo</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .qr-card { 
              display: inline-block; 
              width: 200px; 
              margin: 10px; 
              text-align: center; 
              border: 1px solid #ddd; 
              padding: 10px;
              page-break-inside: avoid;
            }
            .qr-card img { width: 150px; height: 150px; }
            .qr-card h3 { font-size: 12px; margin: 5px 0; }
            .qr-card p { font-size: 10px; color: #666; margin: 2px 0; }
            @media print {
              .qr-card { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
    `;
    
    for (const product of products) {
      const qrImage = await generateProductQRImage(product, 200);
      html += `
        <div class="qr-card">
          <img src="${qrImage}" alt="QR">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
          <p><strong>${formatUSD(product.sale_price)}</strong></p>
        </div>
      `;
    }
    
    html += `
        </body>
      </html>
    `;
    
    // Abrir en nueva ventana para imprimir
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
    
    toast('QRs generados. Usa Ctrl+P para imprimir');
    SoundEffects.play('success');
  } catch (e) {
    console.error('Error generando QRs:', e);
    toast('Error al generar QRs: ' + e.message, 4000);
  }
}

// ==========================================
// SISTEMA DE ESCANEO RÁPIDO (TIPO SUPERMERCADO)
// ==========================================

// Iniciar modo de escaneo rápido
function startQuickScanMode() {
  state.quickScanMode = true;
  state.quickScanItems = [];
  state.quickScanDiscount = 0;
  
  // Abrir modal de escaneo rápido
  openModal('quick-scan-modal');
  updateQuickScanDisplay();
  
  // NO iniciar escáner automáticamente - el usuario debe presionar "Escanear"
  toast('Modo lista de ventas activado');
}

// Mostrar lista de productos para agregar manualmente
function showManualProductList(query) {
  const resultsDiv = $('manual-product-results');
  if (!resultsDiv) return;
  
  resultsDiv.innerHTML = '';
  
  let products = state.records;
  
  // Filtrar por búsqueda
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }
  
  // Limitar a 20 resultados
  products = products.slice(0, 20);
  
  if (products.length === 0) {
    resultsDiv.innerHTML = '<p class="text-center text-gray-500 py-4">No se encontraron productos</p>';
    return;
  }
  
  products.forEach(product => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer transition';
    div.innerHTML = `
      <img src="${cardImage(product)}" alt="" class="w-12 h-12 rounded-lg object-cover flex-shrink-0">
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm truncate">${product.name}</p>
        <p class="text-xs text-gray-500">${product.brand} · Stock: ${product.stock}</p>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="font-bold text-sm text-[#7c43ba]">${formatUSD(product.sale_price)}</p>
        <button class="mt-1 px-3 py-1 rounded-lg bg-[#7c43ba] text-white text-xs font-bold">+ Agregar</button>
      </div>
    `;
    
    const addBtn = div.querySelector('button');
    addBtn.onclick = (e) => {
      e.stopPropagation();
      if (product.stock < 1) {
        toast('❌ Producto agotado');
        return;
      }
      addToQuickScan(product, 1);
      closeModal('quick-scan-manual-modal');
    };
    
    div.onclick = () => {
      if (product.stock < 1) {
        toast('❌ Producto agotado');
        return;
      }
      addToQuickScan(product, 1);
      closeModal('quick-scan-manual-modal');
    };
    
    resultsDiv.appendChild(div);
  });
}

// Detener modo de escaneo rápido
function stopQuickScanMode() {
  state.quickScanMode = false;
  state.quickScanItems = [];
  state.quickScanDiscount = 0;
  closeModal('quick-scan-modal');
  toast('Modo escaneo rápido desactivado');
}

// Agregar producto al escaneo rápido
function addToQuickScan(product, quantity = 1) {
  // Buscar si ya existe en la lista
  const existingItem = state.quickScanItems.find(item => item.product.id === product.id);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    state.quickScanItems.push({
      product: product,
      quantity: quantity,
      price: product.sale_price
    });
  }
  
  updateQuickScanDisplay();
  SoundEffects.play('success');
  toast(`${product.name} agregado`);
}

// Actualizar display del escaneo rápido
function updateQuickScanDisplay() {
  const list = $('quick-scan-list');
  const totalEl = $('quick-scan-total');
  const itemsEl = $('quick-scan-items-count');
  const discountEl = $('quick-scan-discount');
  const emptyMsg = $('quick-scan-empty');
  
  if (!list) return;
  
  // Limpiar lista
  list.innerHTML = '';
  
  // Mostrar/ocultar mensaje de vacío
  if (emptyMsg) {
    if (state.quickScanItems.length === 0) {
      emptyMsg.classList.remove('hidden');
    } else {
      emptyMsg.classList.add('hidden');
    }
  }
  
  // Agregar items
  state.quickScanItems.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200';
    div.innerHTML = `
      <img src="${cardImage(item.product)}" alt="" class="w-12 h-12 rounded-lg object-cover flex-shrink-0">
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm truncate">${item.product.name}</p>
        <p class="text-xs text-gray-500">${formatUSD(item.price)} x ${item.quantity}</p>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="font-bold text-sm">${formatUSD(subtotal)}</p>
        <button onclick="removeQuickScanItem(${index})" class="text-xs text-red-500 hover:underline">Eliminar</button>
      </div>
    `;
    list.appendChild(div);
  });
  
  // Calcular totales
  const subtotal = state.quickScanItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = state.quickScanDiscount;
  const total = subtotal - discount;
  const totalItems = state.quickScanItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // Actualizar display
  if (totalEl) totalEl.textContent = formatUSD(total);
  if (itemsEl) itemsEl.textContent = `${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`;
  if (discountEl) discountEl.textContent = discount > 0 ? `-${formatUSD(discount)}` : 'Sin descuento';
}

// Eliminar item del escaneo rápido
function removeQuickScanItem(index) {
  state.quickScanItems.splice(index, 1);
  updateQuickScanDisplay();
  SoundEffects.play('click');
}

// Aplicar descuento
function applyQuickScanDiscount() {
  const discountInput = $('quick-scan-discount-input');
  if (!discountInput) return;
  
  const discountType = $('quick-scan-discount-type').value;
  const discountValue = parseFloat(discountInput.value) || 0;
  
  if (discountValue <= 0) {
    toast('Ingresa un valor de descuento válido');
    return;
  }
  
  const subtotal = state.quickScanItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (discountType === 'percent') {
    // Descuento porcentual
    if (discountValue > 100) {
      toast('El descuento no puede ser mayor al 100%');
      return;
    }
    state.quickScanDiscount = subtotal * (discountValue / 100);
  } else {
    // Descuento fijo
    if (discountValue > subtotal) {
      toast('El descuento no puede ser mayor al subtotal');
      return;
    }
    state.quickScanDiscount = discountValue;
  }
  
  updateQuickScanDisplay();
  toast(`Descuento aplicado: ${formatUSD(state.quickScanDiscount)}`);
  SoundEffects.play('success');
}

// Finalizar escaneo rápido y registrar venta
async function finalizeQuickScan() {
  console.log('🔘 Botón Finalizar clickeado - INICIO');
  
  try {
    // Verificar si hay productos
    if (!state.quickScanItems || state.quickScanItems.length === 0) {
      console.log('⚠️ No hay productos en la lista');
      toast('No hay productos para vender');
      return;
    }
    
    console.log('✅ Productos en lista:', state.quickScanItems.length);
    
    const subtotal = state.quickScanItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal - state.quickScanDiscount;
    
    console.log('💰 Subtotal:', subtotal, 'Total:', total);
    
    // Confirmar venta
    if (!confirm(`¿Registrar venta por ${formatUSD(total)}?`)) {
      console.log('❌ Venta cancelada por usuario');
      return;
    }
    
    console.log('✅ Usuario confirmó la venta');
    
    // Guardar datos para el recibo antes de limpiar
    const receiptData = {
      date: new Date().toLocaleString('es'),
      seller: state.currentUser ? state.currentUser.name : 'Desconocido',
      payment: state.selectedPaymentMethod || 'Efec.',
      items: [...state.quickScanItems],
      subtotal: subtotal,
      discount: state.quickScanDiscount,
      total: total
    };
    
    console.log('📝 Procesando', state.quickScanItems.length, 'productos...');
    
    // Registrar cada producto como venta
    for (let i = 0; i < state.quickScanItems.length; i++) {
      const item = state.quickScanItems[i];
      console.log(`📦 Procesando producto ${i + 1}:`, item.product.name);
      
      const saleData = {
        product_id: item.product.id,
        product_name: item.product.name,
        brand: item.product.brand || '',
        catalog_id: item.product.catalog_id || '',
        cost_price: Number(item.product.cost_price),
        actual_price: item.price * item.quantity,
        unit_price: item.price,
        profit: (item.price - Number(item.product.cost_price)) * item.quantity,
        quantity: item.quantity,
        payment_method: state.selectedPaymentMethod || 'Efec.',
        seller_id: state.currentUser ? state.currentUser.id : 'unknown',
        seller_name: state.currentUser ? state.currentUser.name : 'Desconocido',
        discount: state.quickScanDiscount > 0 ? (state.quickScanDiscount / state.quickScanItems.length) : 0
      };
      
      console.log('💾 Guardando venta en BD...');
      await DB.addSale(saleData);
      
      // Actualizar stock inmediatamente
      const newStock = Number(item.product.stock) - item.quantity;
      console.log('📊 Actualizando stock de', item.product.name, 'de', item.product.stock, 'a', newStock);
      
      const updatedProduct = { ...item.product, stock: newStock };
      
      // Actualizar en estado local
      const idx = state.records.findIndex(x => x.id === item.product.id);
      if (idx !== -1) {
        state.records[idx].stock = newStock;
        console.log('✅ Stock actualizado en estado local');
      }
      
      // Guardar localmente
      DB.saveLocal();
      console.log('✅ Guardado en localStorage');
      
      // Actualizar en Supabase
      console.log('🔄 Actualizando en Supabase...');
      await DB.updateRecord(updatedProduct);
      
      // Forzar sincronización inmediata si hay conexión
      if (state.isOnline && supabaseClient) {
        try {
          await supabaseClient.from('products').update({ stock: newStock }).eq('id', item.product.id);
          console.log('✅ Stock actualizado en Supabase:', newStock);
        } catch (e) {
          console.error('⚠️ Error sincronizando stock:', e);
        }
      }
    }
    
    console.log('✅ Todos los productos procesados');
    SoundEffects.play('success');
    
    // Limpiar lista
    state.quickScanItems = [];
    state.quickScanDiscount = 0;
    console.log('🧹 Lista limpiada');
    
    // Cerrar modal de lista de ventas
    console.log('🚪 Cerrando modal de lista...');
    closeModal('quick-scan-modal');
    
    // Actualizar toda la UI inmediatamente
    console.log('🔄 Actualizando UI...');
    renderAll();
    
    // Mostrar recibo de venta exitosa
    console.log('📄 Mostrando recibo...');
    showSaleReceipt(receiptData);
    
    // Forzar sincronización completa
    if (state.isOnline && supabaseClient) {
      setTimeout(() => {
        syncPendingChanges();
      }, 500);
    }
    
    console.log('✅ Venta completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en finalizeQuickScan:', error);
    console.error('❌ Stack:', error.stack);
    toast('Error al procesar la venta: ' + error.message, 5000);
  }
}

// Mostrar recibo de venta exitosa
function showSaleReceipt(receiptData) {
  console.log('📄 Mostrando recibo de venta');
  
  // Llenar información del recibo
  const receiptDate = $('receipt-date');
  const receiptSeller = $('receipt-seller');
  const receiptPayment = $('receipt-payment');
  const receiptItems = $('receipt-items');
  const receiptSubtotal = $('receipt-subtotal');
  const receiptDiscount = $('receipt-discount');
  const receiptTotal = $('receipt-total');
  
  if (receiptDate) receiptDate.textContent = receiptData.date;
  if (receiptSeller) receiptSeller.textContent = receiptData.seller;
  if (receiptPayment) receiptPayment.textContent = receiptData.payment;
  
  // Llenar lista de productos
  if (receiptItems) {
    receiptItems.innerHTML = '';
    receiptData.items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'flex justify-between items-start py-2 border-b border-gray-100';
      itemDiv.innerHTML = `
        <div class="flex-1">
          <p class="font-bold text-sm">${item.product.name}</p>
          <p class="text-xs text-gray-600">${item.product.brand} · ${item.quantity} x ${formatUSD(item.price)}</p>
        </div>
        <div class="text-right">
          <p class="font-bold text-sm">${formatUSD(item.price * item.quantity)}</p>
        </div>
      `;
      receiptItems.appendChild(itemDiv);
    });
  }
  
  // Llenar totales
  if (receiptSubtotal) receiptSubtotal.textContent = formatUSD(receiptData.subtotal);
  if (receiptDiscount) receiptDiscount.textContent = receiptData.discount > 0 ? `-${formatUSD(receiptData.discount)}` : 'Sin descuento';
  if (receiptTotal) receiptTotal.textContent = formatUSD(receiptData.total);
  
  // Guardar datos del recibo para compartir/guardar
  window.currentReceiptData = receiptData;
  
  // Abrir modal de recibo
  openModal('sale-receipt-modal');
  
  // Actualizar iconos de Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Mostrar vista previa de imagen
function showImagePreview(imageDataUrl, filename) {
  const previewImg = $('image-preview-img');
  if (previewImg) {
    previewImg.src = imageDataUrl;
  }
  
  // Guardar datos para las acciones
  window.currentPreviewImage = {
    dataUrl: imageDataUrl,
    filename: filename
  };
  
  openModal('image-preview-modal');
}

// Guardar imagen desde vista previa
function savePreviewImage() {
  const previewData = window.currentPreviewImage;
  if (!previewData) return;
  
  const a = document.createElement('a');
  a.href = previewData.dataUrl;
  a.download = previewData.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  toast('Imagen guardada ✓');
  SoundEffects.play('success');
  closeModal('image-preview-modal');
}

// Compartir imagen desde vista previa
async function sharePreviewImage() {
  const previewData = window.currentPreviewImage;
  if (!previewData) return;
  
  try {
    // Convertir dataUrl a blob
    const response = await fetch(previewData.dataUrl);
    const blob = await response.blob();
    const file = new File([blob], previewData.filename, { type: 'image/png' });
    
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Recibo de Venta',
        text: 'Recibo de venta'
      });
      toast('Imagen compartida ✓');
      closeModal('image-preview-modal');
    } else {
      // Fallback: descargar si no se puede compartir
      savePreviewImage();
      toast('Imagen guardada (compartir no disponible)');
    }
  } catch (error) {
    console.error('Error al compartir:', error);
    // Fallback: descargar
    savePreviewImage();
  }
}

// Generar imagen del recibo y mostrar vista previa
async function generateReceiptImage() {
  const receiptData = window.currentReceiptData;
  if (!receiptData) return;
  
  try {
    toast('Generando imagen del recibo...', 2000);
    
    // Crear elemento temporal solo con el contenido del recibo
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;background:white;padding:30px;font-family:Arial,sans-serif;';
    
    let itemsHtml = '';
    receiptData.items.forEach(item => {
      itemsHtml += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
        <div style="flex:1;">
          <div style="font-weight:bold;font-size:14px;">${item.product.name}</div>
          <div style="font-size:12px;color:#666;">${item.product.brand} · ${item.quantity} x ${formatUSD(item.price)}</div>
        </div>
        <div style="font-weight:bold;color:#7c43ba;">${formatUSD(item.price * item.quantity)}</div>
      </div>`;
    });
    
    tempDiv.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="color:#7c43ba;margin:0;font-size:24px;">🧾 RECIBO DE VENTA</h1>
        <p style="color:#666;margin:5px 0;">¡Venta Exitosa!</p>
      </div>
      
      <div style="background:#f6f1f8;padding:15px;border-radius:12px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#666;">Fecha:</span>
          <span style="font-weight:bold;">${receiptData.date}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#666;">Vendedor:</span>
          <span style="font-weight:bold;">${receiptData.seller}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#666;">Método de pago:</span>
          <span style="font-weight:bold;">${receiptData.payment}</span>
        </div>
      </div>
      
      <h2 style="font-size:16px;margin-bottom:10px;color:#201728;">Productos vendidos:</h2>
      ${itemsHtml}
      
      <div style="margin-top:20px;padding-top:15px;border-top:2px solid #e8dfec;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#666;">Subtotal:</span>
          <span style="font-weight:bold;">${formatUSD(receiptData.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#666;">Descuento:</span>
          <span style="font-weight:bold;color:#d97706;">${receiptData.discount > 0 ? '-' + formatUSD(receiptData.discount) : 'Sin descuento'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #7c43ba;">
          <span style="font-weight:bold;font-size:18px;">TOTAL:</span>
          <span style="font-weight:bold;font-size:18px;color:#7c43ba;">${formatUSD(receiptData.total)}</span>
        </div>
      </div>
      
      <div style="text-align:center;margin-top:20px;padding-top:15px;border-top:2px solid #e8dfec;">
        <p style="color:#666;font-size:12px;">¡Gracias por su compra!</p>
      </div>
    `;
    
    document.body.appendChild(tempDiv);
    
    // Usar html2canvas para convertir el elemento a imagen
    const canvas = await html2canvas(tempDiv, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false
    });
    
    // Limpiar elemento temporal
    document.body.removeChild(tempDiv);
    
    // Convertir canvas a data URL
    const imageDataUrl = canvas.toDataURL('image/png', 1.0);
    
    // Mostrar vista previa
    showImagePreview(imageDataUrl, `recibo_venta_${Date.now()}.png`);
    
  } catch (error) {
    console.error('Error al generar imagen:', error);
    toast('Error al generar la imagen del recibo');
  }
}

// Compartir recibo
function shareReceipt() {
  const receiptData = window.currentReceiptData;
  if (!receiptData) return;
  
  // Crear texto del recibo para compartir
  let shareText = `🧾 *RECIBO DE VENTA*\n\n`;
  shareText += `📅 Fecha: ${receiptData.date}\n`;
  shareText += `👤 Vendedor: ${receiptData.seller}\n`;
  shareText += `💳 Método: ${receiptData.payment}\n\n`;
  shareText += `*Productos:*\n`;
  
  receiptData.items.forEach(item => {
    shareText += `• ${item.product.name}\n`;
    shareText += `  ${item.quantity} x ${formatUSD(item.price)} = ${formatUSD(item.price * item.quantity)}\n`;
  });
  
  shareText += `\n*Subtotal:* ${formatUSD(receiptData.subtotal)}\n`;
  shareText += `*Descuento:* ${receiptData.discount > 0 ? '-' + formatUSD(receiptData.discount) : 'Sin descuento'}\n`;
  shareText += `*TOTAL: ${formatUSD(receiptData.total)}*\n\n`;
  shareText += `¡Gracias por su compra! 🎉`;
  
  // Intentar compartir
  if (navigator.share) {
    navigator.share({
      title: 'Recibo de Venta',
      text: shareText
    }).catch(() => {
      // Si falla, copiar al portapapeles
      navigator.clipboard.writeText(shareText).then(() => {
        toast('Recibo copiado al portapapeles ✓');
      }).catch(() => {
        toast('No se pudo compartir');
      });
    });
  } else {
    // Si no hay API de compartir, abrir WhatsApp
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  try {
    checkMidnightReset();
    
    // Sidebar
    document.addEventListener('click', (e) => { const btn = e.target.closest('.open-sidebar-btn'); if (btn) openSidebar(); });
    const cs = $("close-sidebar"); if(cs) cs.onclick = closeSidebar;
    const so = $("sidebar-overlay"); if(so) so.onclick = closeSidebar;

    // ==========================================
    // FIX CRÍTICO: NAVEGACIÓN DEL SIDEBAR
    // ==========================================
    document.querySelectorAll('.sidebar-item').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const view = btn.dataset.view;
        const action = btn.dataset.action;
        
        // Cerrar sidebar PRIMERO
        closeSidebar();
        
        // Navegación de vistas
        if (view === 'catalogs') { state.currentView = 'catalogs'; state.currentCatalogId = null; showScreen("catalog-screen"); }
        else if (view === 'all-products') { state.currentView = 'products'; state.currentCatalogId = null; showScreen("products-screen"); renderProductsScreen(); }
        else if (view === 'out-of-stock') { state.currentView = 'out-of-stock'; showScreen("out-of-stock-screen"); renderOutOfStock(); }
        else if (view === 'low-stock') { state.currentView = 'low-stock'; showScreen("low-stock-screen"); renderLowStock(); }
        else if (view === 'cart') { renderCart(); openModal("cart-modal"); }
        else if (view === 'reports') { state.currentView = 'reports'; showScreen("reports-screen"); renderReports(); }
        else if (view === 'daily-sales') { state.currentView = 'daily-sales'; showScreen("daily-sales-screen"); renderDailySales(); }
        // Acciones - usar navigateFromSidebar para modales
        else if (action === 'show-qr') { navigateFromSidebar(() => { openModal("qr-modal"); if (state.currentUser) showQRView(); }); }
        else if (action === 'search-image') { navigateFromSidebar(() => { openModal("image-search-modal"); }); }
        else if (action === 'scan-barcode') { navigateFromSidebar(() => { openBarcodeScanner(); }); }
        else if (action === 'import-export') { navigateFromSidebar(() => { openModal("import-export-modal"); }); }
        else if (action === 'backup') { navigateFromSidebar(() => { openModal("backup-modal"); }); }
        else if (action === 'show-team') { navigateFromSidebar(() => { openModal("team-modal"); if (state.currentUser) showTeamModal(); }); }
        else if (action === 'show-help') { navigateFromSidebar(() => { openModal("help-modal"); }); }
        else if (action === 'show-contacts') {
          navigateFromSidebar(() => {
            if (state.contactInfo) { const cn = $("contact-name"); if(cn) cn.value = state.contactInfo.name || ''; const cw = $("contact-whatsapp"); if(cw) cw.value = state.contactInfo.whatsapp || ''; const ce = $("contact-email"); if(ce) ce.value = state.contactInfo.email || ''; const cb = $("contact-business"); if(cb) cb.value = state.contactInfo.business || ''; }
            openModal("contacts-modal");
          });
        }
        else if (action === 'show-welcome') { const ws = $("welcome-screen"); if(ws) ws.classList.remove("hidden-welcome"); localStorage.removeItem('welcome_seen_v12'); document.querySelectorAll('.screen').forEach(x => x.classList.remove('active')); updateFAB(); }
        else if (action === 'toggle-dark-mode') { toggleDarkMode(); }
        else if (action === 'toggle-sound') { toggleSound(); }
        else if (action === 'logout') { logout(); }
      };
    });

    // Si hay usuario, mostrar app
    if (state.currentUser) {
      const loginScreen = $('login-screen'); if (loginScreen) loginScreen.classList.add('hidden-login');
      const welcomeScreen = $('welcome-screen'); if (welcomeScreen) welcomeScreen.classList.add('hidden-welcome');
      const catalogScreen = $('catalog-screen'); if (catalogScreen) catalogScreen.classList.add('active');
      applyUserPermissions(); startHeartbeat();
    }
    applyDarkMode(); applySoundState(); updateConnectionIndicator(); updateOfflineBanner();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    DB.init();
    if (localStorage.getItem('welcome_seen_v12')) { const ws = $("welcome-screen"); if(ws) ws.classList.add("hidden-welcome"); }
    updateFAB();
    
    // Login
    const loginForm = $('login-form');
    if (loginForm) { loginForm.onsubmit = (e) => { e.preventDefault(); handleLogin($('login-email').value, $('login-password').value); }; }
    const togglePass = $('toggle-password');
    if (togglePass) { togglePass.onclick = () => { const passInput = $('login-password'); if (passInput.type === 'password') { passInput.type = 'text'; togglePass.innerHTML = '<i data-lucide="eye-off" class="w-5 h-5"></i>'; } else { passInput.type = 'password'; togglePass.innerHTML = '<i data-lucide="eye" class="w-5 h-5"></i>'; } if (typeof lucide !== 'undefined') lucide.createIcons(); }; }
    
    // Welcome
    const enterButton = $("enter-store"); if(enterButton) enterButton.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); enterStore(); });
    
    // Menú usuario
    const userMenuBtn = $('user-menu-btn'); const userMenuDropdown = $('user-menu-dropdown');
    if (userMenuBtn && userMenuDropdown) { userMenuBtn.onclick = (e) => { e.stopPropagation(); userMenuDropdown.classList.toggle('hidden'); }; document.addEventListener('click', (e) => { if (!e.target.closest('#user-menu-btn') && !e.target.closest('#user-menu-dropdown')) userMenuDropdown.classList.add('hidden'); }); }
    const userProfileBtn = $('user-menu-profile'); if (userProfileBtn) userProfileBtn.onclick = () => { userMenuDropdown.classList.add('hidden'); openUserProfile(); };
    const userPasswordBtn = $('user-menu-password'); if (userPasswordBtn) userPasswordBtn.onclick = () => { userMenuDropdown.classList.add('hidden'); openModal('change-password-modal'); };
    const userRefreshBtn = $('user-menu-refresh'); if (userRefreshBtn) userRefreshBtn.onclick = () => { userMenuDropdown.classList.add('hidden'); refreshData(); };
    const userLogoutBtn = $('user-menu-logout'); if (userLogoutBtn) userLogoutBtn.onclick = () => { userMenuDropdown.classList.add('hidden'); logout(); };
    
    // Bottom nav
    document.querySelectorAll('.nav-action').forEach(btn => {
      btn.onclick = () => {
        const view = btn.dataset.view, action = btn.dataset.action;
        if (view === 'catalogs') { state.currentView = 'catalogs'; state.currentCatalogId = null; showScreen("catalog-screen"); }
        else if (view === 'daily-sales') { state.currentView = 'daily-sales'; showScreen("daily-sales-screen"); renderDailySales(); }
        else if (view === 'reports') { state.currentView = 'reports'; showScreen("reports-screen"); renderReports(); }
        else if (view === 'show-qr') { openModal("qr-modal"); showQRView(); }
        else if (view === 'quick-scan') { startQuickScanMode(); }
        else if (action === 'open-datos-menu') { const dd = $('bottom-datos-dropdown'); if (dd) dd.classList.toggle('hidden'); }
      };
    });
    
    // Search
    const bc = $("back-catalogs"); if(bc) bc.onclick = goBack;
    const si = $("search-input"); if(si) { si.oninput = e => { state.query = e.target.value; renderProducts(); const clearBtn = $("search-input-clear"); if (clearBtn) clearBtn.classList.toggle('hidden', !state.query.trim()); }; }
    const sic = $("search-input-clear"); if(sic) sic.onclick = () => { const inp = $("search-input"); if(inp) inp.value = ""; state.query = ""; renderProducts(); sic.classList.add('hidden'); };
    const cmb = $("client-mode-btn"); if(cmb) cmb.onclick = toggleClientMode;
    const gsi = $("global-search-input"); if(gsi) { gsi.oninput = e => { state.globalQuery = e.target.value; renderGlobalSearch(); const clearBtn = $("global-search-clear"); if (clearBtn) clearBtn.classList.toggle('hidden', !state.globalQuery.trim()); }; }
    const gsc = $("global-search-clear"); if(gsc) gsc.onclick = () => { const inp = $("global-search-input"); if(inp) inp.value = ""; state.globalQuery = ""; renderGlobalSearch(); };
    const cgs = $("clear-global-search"); if(cgs) cgs.onclick = () => { const inp = $("global-search-input"); if(inp) inp.value = ""; state.globalQuery = ""; renderGlobalSearch(); };
    
    // Botón de cámara en el buscador global - abre directamente la cámara
    const globalSearchCamera = $("global-search-camera");
    if (globalSearchCamera) {
      globalSearchCamera.onclick = async () => {
        try {
          // Intentar acceder directamente a la cámara
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          // Crear video element para mostrar la cámara
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;background:black;object-fit:cover;';
          document.body.appendChild(video);
          
          // Crear botón de captura
          const captureBtn = document.createElement('button');
          captureBtn.innerHTML = '📸 Tomar Foto';
          captureBtn.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:100000;padding:15px 30px;background:white;color:#7c43ba;border:none;border-radius:50px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
          document.body.appendChild(captureBtn);
          
          // Crear botón de cancelar
          const cancelBtn = document.createElement('button');
          cancelBtn.innerHTML = '❌ Cancelar';
          cancelBtn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:100000;padding:15px 25px;background:#a43658;color:white;border:none;border-radius:50px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
          document.body.appendChild(cancelBtn);
          
          // Función para limpiar
          const cleanup = () => {
            stream.getTracks().forEach(track => track.stop());
            video.remove();
            captureBtn.remove();
            cancelBtn.remove();
          };
          
          // Capturar foto
          captureBtn.onclick = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            
            canvas.toBlob(async (blob) => {
              const file = new File([blob], 'camera-search.jpg', { type: 'image/jpeg' });
              
              // Abrir el modal de búsqueda por imagen y mostrar la foto
              openModal("image-search-modal");
              setTimeout(() => {
                const preview = $("image-search-preview");
                if (preview) {
                  preview.src = URL.createObjectURL(file);
                  preview.classList.remove('hidden');
                }
                // Buscar productos similares
                searchByImage(file);
              }, 300);
              
              cleanup();
            }, 'image/jpeg', 0.9);
          };
          
          // Cancelar
          cancelBtn.onclick = cleanup;
          
        } catch (err) {
          console.error('Error accediendo a la cámara:', err);
          toast('No se pudo acceder a la cámara. Verifica los permisos.');
        }
      };
    }
    
    // Cart
    const cb = $("cart-button"); if(cb) cb.onclick = () => { renderCart(); openModal("cart-modal"); };
    const ocfc = $("open-cart-from-catalogs"); if(ocfc) ocfc.onclick = () => { renderCart(); openModal("cart-modal"); };
    const ccc2 = document.querySelector(".close-cart"); if(ccc2) ccc2.onclick = () => closeModal("cart-modal");
    const cwh = $("checkout-whatsapp"); if(cwh) { cwh.onclick = () => { if (state.cart.length === 0) return; let msg = "🛒 *NUEVO PEDIDO*\n\n", total = 0; state.cart.forEach(line => { const r = state.records.find(x => x.id === line.id); if (r) { const sub = Number(r.sale_price) * line.qty; total += sub; msg += `▪️ ${line.qty}x ${r.name}\n   ${formatUSD(sub)}\n`; } }); msg += `\n*TOTAL: ${formatUSD(total)}*`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); }; }
    const cpb = $("checkout-pdf"); if (cpb) cpb.onclick = () => exportCartToPDF();
    const ccl = $("checkout-clear"); if(ccl) { ccl.onclick = () => { if (confirm("¿Vaciar carrito?")) { state.cart = []; renderCart(); renderCartBadges(); toast("Carrito vaciado"); } }; }
    
    // Detail modal
    const cd = $("close-detail"); if(cd) cd.onclick = () => closeModal("detail-modal");
    const dmb = $("detail-more-btn"); if(dmb) { dmb.onclick = (e) => { e.stopPropagation(); $("detail-dropdown").classList.toggle("open"); }; document.addEventListener('click', (e) => { if (!e.target.closest('#detail-more-btn')) { const dd = $("detail-dropdown"); if(dd) dd.classList.remove("open"); } }); }
    document.querySelectorAll('#detail-dropdown .dropdown-item').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation(); const action = btn.dataset.action, r = state.detail; if (!r) return;
        if (action === 'duplicate') { const copy = { ...r, id: undefined, name: r.name + ' (copia)' }; DB.createRecord(copy); toast("Duplicado ✓"); renderAll(); }
        else if (action === 'print-barcode') { printProductBarcode(r); }
        else if (action === 'request-stock') { window.open(`https://wa.me/?text=${encodeURIComponent(`Necesito más stock de: ${r.name}`)}`, '_blank'); }
        else if (action === 'share') { const msg = `${r.name} - ${r.brand}\n${formatUSD(r.sale_price)}`; if (navigator.share) navigator.share({ title: r.name, text: msg }).catch(() => {}); else { navigator.clipboard.writeText(msg); toast("Copiado ✓"); } }
        else if (action === 'delete') { if (confirm("¿Eliminar?")) { DB.deleteRecord(r.id); closeModal("detail-modal"); toast("Eliminado"); renderAll(); } }
        $("detail-dropdown").classList.remove("open");
      };
    });
    const de = $("detail-pencil"); if(de) { de.onclick = () => { closeModal("detail-modal"); openForm(state.detail); }; }
    const dc = $("detail-cart"); if(dc) dc.onclick = () => { addCart(state.detail); closeModal("detail-modal"); };
    const ds = $("detail-sold"); if(ds) { ds.onclick = () => { if (Number(state.detail.stock) < 1) { toast("No hay stock"); return; } closeModal("detail-modal"); openSaleModal(state.detail); }; }
    
    // Sale modal
    const csm = $("close-sale-modal"); if(csm) csm.onclick = () => closeModal("sale-modal");
    const cas = $("cancel-sale"); if(cas) cas.onclick = () => closeModal("sale-modal");
    const sap = $("sale-actual-price"); if(sap) sap.oninput = updateSaleDisplay;
    const sq = $("sale-quantity"); if(sq) sq.oninput = updateSaleDisplay;
    const qtyMinus = $("sale-qty-minus"); if(qtyMinus) { qtyMinus.onclick = () => { const q = parseInt(sq.value) || 1; if (q > 1) { sq.value = q - 1; updateSaleDisplay(); } }; }
    const qtyPlus = $("sale-qty-plus"); if(qtyPlus) { qtyPlus.onclick = () => { const q = parseInt(sq.value) || 1; const maxStock = state.saleProduct ? Number(state.saleProduct.stock) : 999; if (q < maxStock) { sq.value = q + 1; updateSaleDisplay(); } else toast("Stock máximo"); }; }
    document.querySelectorAll('.pay-method-btn').forEach(btn => { btn.onclick = () => { state.selectedPaymentMethod = btn.dataset.method; document.querySelectorAll('.pay-method-btn').forEach(b => { b.className = 'pay-method-btn py-2 rounded-xl border-2 border-[#e8dfec] text-[#756c7e] font-bold text-sm'; }); btn.className = 'pay-method-btn py-2 rounded-xl border-2 border-[#7c43ba] bg-[#f6f1f8] font-bold text-sm'; }; });
    const csf = $("confirm-sale"); if(csf) csf.onclick = confirmSale;
    
    // Catalog form
    const ccm2 = $("close-catalog-modal"); if(ccm2) ccm2.onclick = () => closeModal("catalog-modal");
    
    // Cerrar modal de catálogo al hacer clic fuera
    const catalogModal = $("catalog-modal");
    if (catalogModal) {
      catalogModal.onclick = (e) => {
        if (e.target === catalogModal) {
          closeModal("catalog-modal");
        }
      };
    }
    
    const cf = $("catalog-form");
    if(cf) { cf.onsubmit = async e => { e.preventDefault(); const name = $("catalog-name").value.trim(); const label = $("catalog-label").value.trim() || name.toUpperCase().slice(0, 15); const color = document.querySelector('input[name="cat-color"]:checked').value; let cover = state.editingCatalogId ? (state.catalogs.find(c => c.id === state.editingCatalogId)?.cover || fallbackCover) : fallbackCover; if (state.pendingCatalogImage) { try { cover = await readFileAsBase64(state.pendingCatalogImage); } catch (err) { toast("Error imagen"); return; } } if (state.editingCatalogId) { await DB.updateCatalog(state.editingCatalogId, { name, label, color, cover }); toast("Catálogo actualizado ✓"); } else { await DB.createCatalog({ name, label, color, cover }); toast("Catálogo creado ✓"); } state.pendingCatalogImage = null; closeModal("catalog-modal"); renderAll(); }; }
    
    // Product form
    const cfo = $("close-form"); if(cfo) cfo.onclick = closeForm;
    const db = $("drawer-backdrop"); if(db) db.onclick = closeForm;
    ["sale-price", "cost-price"].forEach(id => { const el = $(id); if(el) el.addEventListener('input', updateProfitPreview); });
    const pf = $("product-form");
    if(pf) { pf.onsubmit = async e => { e.preventDefault(); const saveBtn = $("save-product"); saveBtn.disabled = true; saveBtn.textContent = "Guardando..."; const selectedCatalog = document.getElementById('product-catalog-select').value; if (!selectedCatalog) { toast("Selecciona un catálogo"); saveBtn.disabled = false; saveBtn.textContent = "Guardar producto"; return; } let finalImageUrl = state.editing ? state.editing.image_url : ''; if (state.pendingImageFile) { try { finalImageUrl = await compressImage(state.pendingImageFile); } catch (err) { toast("Error imagen"); saveBtn.disabled = false; saveBtn.textContent = "Guardar producto"; return; } } const data = { type: $("product-type").value, name: $("product-name").value.trim(), category: $("product-category").value.trim(), brand: $("product-brand").value.trim(), barcode: $("product-barcode").value.trim(), catalog_id: selectedCatalog, cost_price: Number($("cost-price").value), sale_price: Number($("sale-price").value), min_price: Number($("min-price").value), stock: Number($("product-stock").value), sold: state.editing ? state.editing.sold : false, image_url: finalImageUrl, description: $("product-description").value.trim(), offer_text: $("product-offer").value.trim() }; const result = state.editing ? await DB.updateRecord({ ...state.editing, ...data }) : await DB.createRecord(data); if (result.isOk) { state.pendingImageFile = null; closeForm(); toast(state.editing ? "Actualizado ✓" : "Guardado ✓"); renderAll(); } else { toast("No se pudo guardar"); } saveBtn.disabled = false; saveBtn.textContent = "Guardar producto"; }; }
    
    // ==========================================
    // EVENT LISTERS PARA IMÁGENES Y ESCÁNER (CORREGIDO)
    // ==========================================
    
    // Input de imagen del producto - cargar desde galería
    const productImageInput = $("product-image");
    if (productImageInput) {
      productImageInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          state.pendingImageFile = file;
          try {
            const preview = await compressImage(file);
            $("image-preview").src = preview;
            $("image-preview").style.display = "block";
            toast("Imagen cargada ✓");
          } catch (err) {
            toast("Error al cargar imagen");
          }
        }
      };
    }
    
    // Botón de cámara - tomar foto con la cámara
    const cameraBtn = $("camera-image-btn");
    if (cameraBtn) {
      cameraBtn.onclick = async () => {
        try {
          // Intentar acceder directamente a la cámara
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          // Crear video element para mostrar la cámara
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;background:black;object-fit:cover;';
          document.body.appendChild(video);
          
          // Crear botón de captura
          const captureBtn = document.createElement('button');
          captureBtn.innerHTML = '📸 Tomar Foto';
          captureBtn.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:100000;padding:15px 30px;background:white;color:#7c43ba;border:none;border-radius:50px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
          document.body.appendChild(captureBtn);
          
          // Crear botón de cancelar
          const cancelBtn = document.createElement('button');
          cancelBtn.innerHTML = '❌ Cancelar';
          cancelBtn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:100000;padding:15px 25px;background:#a43658;color:white;border:none;border-radius:50px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
          document.body.appendChild(cancelBtn);
          
          // Función para limpiar
          const cleanup = () => {
            stream.getTracks().forEach(track => track.stop());
            video.remove();
            captureBtn.remove();
            cancelBtn.remove();
          };
          
          // Capturar foto
          captureBtn.onclick = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            
            canvas.toBlob(async (blob) => {
              const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
              state.pendingImageFile = file;
              try {
                const preview = await compressImage(file);
                $("image-preview").src = preview;
                $("image-preview").style.display = "block";
                toast("Foto tomada ✓");
              } catch (err) {
                toast("Error al procesar imagen");
              }
              cleanup();
            }, 'image/jpeg', 0.9);
          };
          
          // Cancelar
          cancelBtn.onclick = cleanup;
          
        } catch (err) {
          console.error('Error accediendo a la cámara:', err);
          toast('No se pudo acceder a la cámara. Verifica los permisos.');
        }
      };
    }
    
    // Botón de escanear código de barras en el formulario
    const scanBarcodeBtn = $("scan-barcode-btn");
    if (scanBarcodeBtn) {
      scanBarcodeBtn.onclick = () => {
        window.barcodeScanTarget = 'form'; // Indica que debe poner el código en el campo del formulario
        openBarcodeScanner();
      };
    }
    
    // Input de imagen del catálogo
    const catalogImageInput = $("catalog-image");
    if (catalogImageInput) {
      catalogImageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          state.pendingCatalogImage = file;
          const preview = $("catalog-image-preview");
          if (preview) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = "block";
            toast("Imagen de catálogo cargada ✓");
          }
        }
      };
    }
    
    // Create catalog modal
    const ccc = $("close-create-catalog"); if(ccc) ccc.onclick = () => closeModal("create-catalog-modal");
    const ccmn = $("create-catalog-manual"); if(ccmn) ccmn.onclick = () => { closeModal("create-catalog-modal"); setTimeout(() => openCatalogForm(), 100); };
    const ccf = $("create-catalog-file"); if(ccf) ccf.onclick = () => { closeModal("create-catalog-modal"); setTimeout(() => openModal("import-modal"), 100); };
    
    // Import/Export modals
    // Modal combinado de importar/exportar
    const closeImportExportModal = $('close-import-export-modal'); 
    if (closeImportExportModal) {
      closeImportExportModal.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Botón cerrar modal clickeado');
        closeModal('import-export-modal');
      };
    }
    
    // Cerrar modal al hacer clic fuera
    const importExportModalBg = $('import-export-modal');
    if (importExportModalBg) {
      importExportModalBg.onclick = (e) => {
        if (e.target === importExportModalBg) {
          console.log('🔘 Clic fuera del modal');
          closeModal('import-export-modal');
        }
      };
    }
    
    // Actualizar información contextual del modal de exportación
    function updateExportContextInfo() {
      const contextText = $('export-context-text');
      if (contextText) {
        if (state.currentCatalogId) {
          const cat = state.catalogs.find(c => c.id === state.currentCatalogId);
          const productCount = state.records.filter(r => r.catalog_id === state.currentCatalogId).length;
          contextText.textContent = `Exportando catálogo: ${cat ? cat.name : 'actual'} (${productCount} productos)`;
        } else {
          const totalProducts = state.records.length;
          const totalCatalogs = state.catalogs.length;
          contextText.textContent = `Exportando TODO: ${totalCatalogs} catálogos, ${totalProducts} productos`;
        }
      }
    }
    
    // Actualizar info cuando se abre el modal (sin observer para evitar problemas)
    const importExportModal = $('import-export-modal');
    if (importExportModal) {
      // Actualizar info inmediatamente
      updateExportContextInfo();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Botones de exportación (ahora en el modal combinado)
    const exportXlsxBtn = $('export-xlsx-btn'); 
    if (exportXlsxBtn) {
      exportXlsxBtn.onclick = (e) => { 
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Botón Excel clickeado');
        try {
          closeModal('import-export-modal');
          setTimeout(() => {
            exportXLSX(state.currentCatalogId);
          }, 100);
        } catch (err) {
          console.error('❌ Error en botón Excel:', err);
          toast('Error: ' + err.message, 4000);
        }
      };
    }
    
    const exportJsonBtn = $('export-json-btn'); 
    if (exportJsonBtn) {
      exportJsonBtn.onclick = (e) => { 
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Botón JSON clickeado');
        try {
          closeModal('import-export-modal');
          setTimeout(() => {
            exportJSON(state.currentCatalogId);
          }, 100);
        } catch (err) {
          console.error('❌ Error en botón JSON:', err);
          toast('Error: ' + err.message, 4000);
        }
      };
    }
    
    const exportCsvBtn = $('export-csv-btn'); 
    if (exportCsvBtn) {
      exportCsvBtn.onclick = (e) => { 
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Botón CSV clickeado');
        try {
          closeModal('import-export-modal');
          setTimeout(() => {
            exportCSV(state.currentCatalogId);
          }, 100);
        } catch (err) {
          console.error('❌ Error en botón CSV:', err);
          toast('Error: ' + err.message, 4000);
        }
      };
    }
    
    // Botón para exportar TODO (todos los catálogos)
    const exportAllBtn = $('export-all-btn');
    if (exportAllBtn) {
      exportAllBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 Botón Exportar TODO clickeado');
        try {
          closeModal('import-export-modal');
          setTimeout(() => {
            const choice = confirm('¿Exportar TODO como JSON?\n\nOK = JSON (respaldo completo)\nCancelar = Excel (XLSX)');
            if (choice) {
              exportJSON(null);
            } else {
              exportXLSX(null);
            }
          }, 100);
        } catch (err) {
          console.error('❌ Error en botón Exportar TODO:', err);
          toast('Error: ' + err.message, 4000);
        }
      };
    }
    
    // Input de importación
    const importFileMain = $('import-file-main'); 
    if (importFileMain) { 
      importFileMain.onchange = async (e) => { 
        const f = e.target.files[0]; 
        if (f) { 
          await importFile(f, state.currentCatalogId); 
          closeModal('import-export-modal'); 
          e.target.value = ''; 
        } 
      }; 
    }
    
    // Backup
    const cbm = $("close-backup-modal"); if(cbm) cbm.onclick = () => closeModal("backup-modal");
    const crb = $("create-backup"); if(crb) crb.onclick = () => { createBackup(); };
    const rbf = $("restore-backup-file"); if(rbf) { rbf.onchange = async e => { const f = e.target.files[0]; if (f) { await restoreBackup(f); e.target.value = ""; } }; }
    
    // Team
    $("close-team-modal").onclick = function() { closeModal("team-modal"); };
    var filterToday = $("team-filter-today"); if (filterToday) filterToday.onclick = function() { teamFilter = 'today'; filterToday.className = 'px-4 py-2 rounded-xl bg-[#7c43ba] text-white text-sm font-bold'; $("team-filter-all").className = 'px-4 py-2 rounded-xl bg-[#f1ecf4] text-[#7c43ba] text-sm font-bold'; renderTeamList(); };
    var filterAll = $("team-filter-all"); if (filterAll) filterAll.onclick = function() { teamFilter = 'all'; filterAll.className = 'px-4 py-2 rounded-xl bg-[#7c43ba] text-white text-sm font-bold'; $("team-filter-today").className = 'px-4 py-2 rounded-xl bg-[#f1ecf4] text-[#7c43ba] text-sm font-bold'; renderTeamList(); };
    $("close-team-user-menu").onclick = function() { closeModal("team-user-menu-modal"); };
    var toggleStatusBtn = $("team-user-toggle-status"); if (toggleStatusBtn) toggleStatusBtn.onclick = teamUserToggleStatus;
    var changeRoleBtn = $("team-user-change-role"); if (changeRoleBtn) changeRoleBtn.onclick = teamUserChangeRole;
    var resetPassBtn = $("team-user-reset-password"); if (resetPassBtn) resetPassBtn.onclick = teamUserResetPassword;
    var deleteUserBtn = $("team-user-delete"); if (deleteUserBtn) deleteUserBtn.onclick = teamUserDelete;
    var openCreateUserBtn = $("open-create-user-btn"); if (openCreateUserBtn) openCreateUserBtn.onclick = showCreateUserModal;
    $("close-create-user").onclick = function() { closeModal("create-user-modal"); };
    $("cancel-create-user").onclick = function() { closeModal("create-user-modal"); };
    var createUserForm = $("create-user-form"); if (createUserForm) createUserForm.onsubmit = handleCreateUser;
    $("close-team-change-role").onclick = function() { closeModal("team-change-role-modal"); };
    var cancelChangeRole = $("cancel-team-change-role"); if (cancelChangeRole) cancelChangeRole.onclick = function() { closeModal("team-change-role-modal"); };
    var confirmChangeRole = $("confirm-team-change-role"); if (confirmChangeRole) confirmChangeRole.onclick = confirmTeamChangeRole;
    
    // Password
    $("close-change-password").onclick = function() { closeModal("change-password-modal"); };
    $("cancel-change-password").onclick = function() { closeModal("change-password-modal"); };
    var changePasswordForm = $("change-password-form"); if (changePasswordForm) changePasswordForm.onsubmit = handleChangePassword;
    
    // Profile
    $("close-user-profile").onclick = function() { closeModal("user-profile-modal"); };
    var saveProfileBtn = $("save-profile"); if (saveProfileBtn) saveProfileBtn.onclick = saveUserProfile;
    // FIX: btn-request-change ahora tiene función
    var requestChangeBtn = $("btn-request-change"); if (requestChangeBtn) requestChangeBtn.onclick = requestProfileChange;
    
    // QR
    $("close-qr-modal").onclick = function() { closeModal("qr-modal"); };
    var addNewQrBtn = $("add-new-qr-btn"); if (addNewQrBtn) addNewQrBtn.onclick = function() { handleNewQrUpload(); };
    $("close-qr-item-menu").onclick = function() { closeModal("qr-item-menu-modal"); };
    var qrSetPrimary = $("qr-menu-set-primary"); if (qrSetPrimary) qrSetPrimary.onclick = qrMenuSetPrimary;
    var qrChange = $("qr-menu-change"); if (qrChange) qrChange.onclick = qrMenuChange;
    var qrRename = $("qr-menu-rename"); if (qrRename) qrRename.onclick = qrMenuRename;
    var qrShare = $("qr-menu-share"); if (qrShare) qrShare.onclick = qrMenuShare;
    var qrDownload = $("qr-menu-download"); if (qrDownload) qrDownload.onclick = qrMenuDownload;
    var qrDelete = $("qr-menu-delete"); if (qrDelete) qrDelete.onclick = qrMenuDelete;
    
    // Contacts
    const ctf = $("contacts-form"); if(ctf) { ctf.onsubmit = (e) => { e.preventDefault(); state.contactInfo = { name: $("contact-name").value.trim(), whatsapp: $("contact-whatsapp").value.trim(), email: $("contact-email").value.trim(), business: $("contact-business").value.trim() }; localStorage.setItem(CONTACT_KEY, JSON.stringify(state.contactInfo)); closeModal("contacts-modal"); toast("Datos guardados ✓"); }; }
    $("close-help").onclick = () => closeModal("help-modal");
    $("close-contacts").onclick = () => closeModal("contacts-modal");
    
    // Export sales
    const esx = $("export-sales-xlsx"); if(esx) esx.onclick = exportSalesXLSX;
    const esc = $("export-sales-csv"); if(esc) esc.onclick = exportSalesCSV;
    const eos = $("export-out-of-stock"); if(eos) eos.onclick = exportOutOfStock;
    
    // Scanner
    const cbs = $("close-barcode-scanner"); if(cbs) { cbs.onclick = async () => { await stopBarcodeScanner(); closeModal("barcode-scanner-modal"); }; }
    const sts = $("stop-scanner"); if(sts) sts.onclick = async () => { await stopBarcodeScanner(); toast("Escáner detenido"); };
    const pbb = $("print-barcode-btn"); if(pbb) pbb.onclick = () => doPrintBarcode();
    const dbb = $("download-barcode-btn"); if(dbb) dbb.onclick = () => downloadBarcode();
    
    // Share
    $("close-share-catalog").onclick = () => closeModal("share-catalog-modal");
    const csl = $("copy-share-link"); if(csl) csl.onclick = () => copyShareLink();
    const swc = $("share-whatsapp-catalog"); if(swc) swc.onclick = () => shareCatalogWhatsApp();
    const sec = $("share-email-catalog"); if(sec) sec.onclick = () => shareCatalogEmail();
    
    // Image search
    $("close-image-search").onclick = () => closeModal("image-search-modal");
    
    // Botón de cámara en modal de búsqueda por imagen - usar getUserMedia
    const isc = $("image-search-camera");
    if (isc) {
      isc.onclick = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;background:black;object-fit:cover;';
          document.body.appendChild(video);
          
          const captureBtn = document.createElement('button');
          captureBtn.innerHTML = '📸 Tomar Foto';
          captureBtn.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:100000;padding:15px 30px;background:white;color:#7c43ba;border:none;border-radius:50px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
          document.body.appendChild(captureBtn);
          
          const cancelBtn = document.createElement('button');
          cancelBtn.innerHTML = '❌ Cancelar';
          cancelBtn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:100000;padding:15px 25px;background:#a43658;color:white;border:none;border-radius:50px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
          document.body.appendChild(cancelBtn);
          
          const cleanup = () => {
            stream.getTracks().forEach(track => track.stop());
            video.remove();
            captureBtn.remove();
            cancelBtn.remove();
          };
          
          captureBtn.onclick = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
              const file = new File([blob], 'camera-search.jpg', { type: 'image/jpeg' });
              
              const preview = $("image-search-preview");
              if (preview) {
                preview.src = URL.createObjectURL(file);
                preview.classList.remove('hidden');
              }
              searchByImage(file);
              
              cleanup();
            }, 'image/jpeg', 0.9);
          };
          
          cancelBtn.onclick = cleanup;
          
        } catch (err) {
          console.error('Error accediendo a la cámara:', err);
          toast('No se pudo acceder a la cámara. Verifica los permisos.');
        }
      };
    }
    
    const isf = $("image-search-file"); if(isf) isf.onchange = e => { const f = e.target.files[0]; if (f) searchByImage(f); };
    
    // Daily table
    const btnGenerateDaily = $('btn-generate-daily-table');
    if (btnGenerateDaily) { 
      btnGenerateDaily.onclick = async () => { 
        const todaySales = getTodaySales(); 
        if (todaySales.length === 0) { 
          toast('No hay ventas hoy'); 
          return; 
        } 
        
        const total = todaySales.reduce((a, s) => a + Number(s.actual_price || 0), 0);
        const profit = todaySales.reduce((a, s) => a + Number(s.profit || 0), 0);
        const cash = todaySales.filter(s => s.payment_method === 'Efec.').reduce((a, s) => a + Number(s.actual_price || 0), 0);
        const qr = todaySales.filter(s => s.payment_method === 'QR').reduce((a, s) => a + Number(s.actual_price || 0), 0);
        
        // Crear elemento HTML temporal para el cierre
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;background:white;padding:30px;font-family:Arial,sans-serif;';
        
        let itemsHtml = '';
        todaySales.forEach(s => {
          itemsHtml += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
            <div style="flex:1;">
              <div style="font-weight:bold;font-size:14px;">${s.product_name}</div>
              <div style="font-size:12px;color:#666;">x${s.quantity || 1} - ${s.payment_method || 'Efec.'}</div>
            </div>
            <div style="font-weight:bold;color:#7c43ba;">${formatUSD(s.actual_price)}</div>
          </div>`;
        });
        
        // Obtener nombre del vendedor actual
        const sellerName = state.currentUser ? state.currentUser.name : 'Vendedor';
        
        tempDiv.innerHTML = `
          <div style="text-align:center;margin-bottom:20px;">
            <h1 style="color:#7c43ba;margin:0;font-size:24px;">📊 CIERRE DE VENTAS</h1>
            <p style="color:#666;margin:5px 0;">${new Date().toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div style="background:#f6f1f8;padding:15px;border-radius:12px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#666;">Vendedor:</span>
              <span style="font-weight:bold;">${sellerName}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#666;">Total de ventas:</span>
              <span style="font-weight:bold;">${todaySales.length}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#666;">💵 Efectivo:</span>
              <span style="font-weight:bold;color:#23805d;">${formatUSD(cash)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#666;">📱 QR:</span>
              <span style="font-weight:bold;color:#7c43ba;">${formatUSD(qr)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#666;">💰 Ganancia:</span>
              <span style="font-weight:bold;color:#166534;">${formatUSD(profit)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #7c43ba;">
              <span style="font-weight:bold;font-size:18px;">TOTAL:</span>
              <span style="font-weight:bold;font-size:18px;color:#7c43ba;">${formatUSD(total)}</span>
            </div>
          </div>
          
          <h2 style="font-size:16px;margin-bottom:10px;color:#201728;">Detalle de ventas:</h2>
          ${itemsHtml}
          
          <div style="text-align:center;margin-top:20px;padding-top:15px;border-top:2px solid #e8dfec;">
            <p style="color:#666;font-size:12px;">Generado el ${new Date().toLocaleString('es')}</p>
          </div>
        `;
        
        document.body.appendChild(tempDiv);
        
        try {
          toast('Generando imagen del cierre...', 2000);
          
          const canvas = await html2canvas(tempDiv, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false
          });
          
          // Convertir canvas a data URL
          const imageDataUrl = canvas.toDataURL('image/png', 1.0);
          
          // Limpiar el elemento temporal
          document.body.removeChild(tempDiv);
          
          // Mostrar vista previa
          showImagePreview(imageDataUrl, `cierre_ventas_${Date.now()}.png`);
          
        } catch (error) {
          console.error('Error al generar imagen:', error);
          if (document.body.contains(tempDiv)) {
            document.body.removeChild(tempDiv);
          }
          toast('Error al generar la imagen del cierre');
        }
      }; 
    }
    
    // Bottom datos dropdown
    const datosBtn = document.querySelector('[data-action="open-datos-menu"]');
    const datosDropdown = document.getElementById('bottom-datos-dropdown');
    if (datosBtn && datosDropdown) {
      document.addEventListener('click', (e) => { if (!e.target.closest('[data-action="open-datos-menu"]') && !e.target.closest('#bottom-datos-dropdown')) datosDropdown.classList.add('hidden'); });
      const btnCrearCatalogo = document.getElementById('bottom-datos-crear-catalogo'); if (btnCrearCatalogo) btnCrearCatalogo.onclick = () => { datosDropdown.classList.add('hidden'); openCatalogForm(); };
      const btnCrearProducto = document.getElementById('bottom-datos-crear-producto'); if (btnCrearProducto) btnCrearProducto.onclick = () => { datosDropdown.classList.add('hidden'); openForm(); };
      const btnImportar = document.getElementById('bottom-datos-importar'); if (btnImportar) btnImportar.onclick = () => { datosDropdown.classList.add('hidden'); openModal('import-export-modal'); };
      const btnExportar = document.getElementById('bottom-datos-exportar'); if (btnExportar) btnExportar.onclick = () => { datosDropdown.classList.add('hidden'); openModal('import-export-modal'); };
    }
    
    // Catalog inside menu
    const catalogInsideMenuBtn = $("catalog-inside-menu-btn");
    if (catalogInsideMenuBtn) { catalogInsideMenuBtn.onclick = (e) => { e.stopPropagation(); const dd = $("catalog-inside-dropdown"); if (dd) dd.classList.toggle('open'); }; }
    
    // Cerrar dropdown del catálogo cuando se hace clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.catalog-inside-menu')) {
        const dd = $("catalog-inside-dropdown");
        if (dd) dd.classList.remove('open');
      }
    });
    
    document.querySelectorAll('[data-catalog-action]').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); const action = btn.dataset.catalogAction; const dd = $("catalog-inside-dropdown"); if (dd) dd.classList.remove('open'); if (action === 'share') { if (state.currentCatalogId) shareCatalogByLink(state.currentCatalogId); } else if (action === 'edit') { if (state.currentCatalogId) openCatalogForm(state.currentCatalogId); } else if (action === 'clear') { if (state.currentCatalogId) clearCatalogProducts(state.currentCatalogId); } else if (action === 'delete') { if (state.currentCatalogId) deleteCatalogWithConfirm(state.currentCatalogId); } };
    });
    
    // ==========================================
    // EVENT LISTENERS PARA QR DE PRODUCTOS
    // ==========================================
    
    // Cerrar modal de QR de producto
    const closeProductQR = $('close-product-qr');
    if (closeProductQR) closeProductQR.onclick = () => closeModal('product-qr-modal');
    
    // Descargar QR de producto
    const downloadProductQRBtn = $('download-product-qr');
    if (downloadProductQRBtn) downloadProductQRBtn.onclick = downloadProductQR;
    
    // Imprimir QR de producto
    const printProductQRBtn = $('print-product-qr');
    if (printProductQRBtn) printProductQRBtn.onclick = printProductQR;
    
    // Agregar botón de generar QR en el menú de 3 puntos del producto
    const detailDropdown = $('detail-dropdown');
    if (detailDropdown) {
      const generateQRBtn = document.createElement('button');
      generateQRBtn.className = 'dropdown-item';
      generateQRBtn.dataset.action = 'generate-qr';
      generateQRBtn.innerHTML = '<i data-lucide="qr-code" class="w-4 h-4"></i> Generar código QR';
      generateQRBtn.onclick = (e) => {
        e.stopPropagation();
        const r = state.detail;
        if (r) {
          showProductQRModal(r);
        }
        detailDropdown.classList.remove('open');
      };
      
      // Insertar antes del botón de eliminar
      const deleteBtn = detailDropdown.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        const divider = document.createElement('div');
        divider.className = 'my-1 border-t border-[#e8dfec]';
        detailDropdown.insertBefore(divider, deleteBtn);
        detailDropdown.insertBefore(generateQRBtn, divider);
      } else {
        detailDropdown.appendChild(generateQRBtn);
      }
    }
    
    // Agregar opción de descargar todos los QR en el menú del catálogo
    const catalogInsideDropdown = $('catalog-inside-dropdown');
    if (catalogInsideDropdown) {
      const downloadAllQRBtn = document.createElement('button');
      downloadAllQRBtn.className = 'dropdown-item';
      downloadAllQRBtn.dataset.catalogAction = 'download-all-qr';
      downloadAllQRBtn.innerHTML = '<i data-lucide="qr-code" class="w-4 h-4"></i> Descargar todos los QR';
      downloadAllQRBtn.onclick = (e) => {
        e.stopPropagation();
        if (state.currentCatalogId) {
          downloadAllCatalogQR(state.currentCatalogId);
        }
        catalogInsideDropdown.classList.remove('open');
      };
      
      // Insertar antes del botón de compartir
      const shareBtn = catalogInsideDropdown.querySelector('[data-catalog-action="share"]');
      if (shareBtn) {
        catalogInsideDropdown.insertBefore(downloadAllQRBtn, shareBtn);
      } else {
        catalogInsideDropdown.appendChild(downloadAllQRBtn);
      }
    }
    
    // ==========================================
    // EVENT LISTENERS PARA ESCANEO RÁPIDO
    // ==========================================
    
    // Cerrar modal de escaneo rápido
    const closeQuickScan = $('close-quick-scan');
    if (closeQuickScan) closeQuickScan.onclick = () => {
      stopBarcodeScanner();
      stopQuickScanMode();
    };
    
    // Cancelar escaneo rápido
    const cancelQuickScan = $('cancel-quick-scan');
    if (cancelQuickScan) cancelQuickScan.onclick = () => {
      stopBarcodeScanner();
      stopQuickScanMode();
    };
    
    // Aplicar descuento
    const applyDiscountBtn = $('apply-quick-scan-discount');
    if (applyDiscountBtn) applyDiscountBtn.onclick = applyQuickScanDiscount;
    
    // Finalizar venta
    const finalizeQuickScanBtn = $('finalize-quick-scan');
    console.log('🔍 Buscando botón Finalizar:', finalizeQuickScanBtn);
    if (finalizeQuickScanBtn) {
      console.log('✅ Botón encontrado, asignando event listener');
      finalizeQuickScanBtn.onclick = function(e) {
        console.log('🔘 Click en botón Finalizar');
        e.preventDefault();
        e.stopPropagation();
        finalizeQuickScan();
      };
    } else {
      console.error('❌ Botón Finalizar no encontrado');
    }
    
    // Botón de cámara en el modal de ventas
    const quickScanCameraBtn = $('quick-scan-camera-btn');
    if (quickScanCameraBtn) {
      quickScanCameraBtn.onclick = () => {
        openBarcodeScanner();
        window.barcodeScanTarget = 'quick-scan';
      };
    }
    
    // Botón de agregar manualmente
    const quickScanManualBtn = $('quick-scan-manual-btn');
    if (quickScanManualBtn) {
      quickScanManualBtn.onclick = () => {
        openModal('quick-scan-manual-modal');
        const searchInput = $('manual-product-search');
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
          showManualProductList('');
        }
      };
    }
    
    // Búsqueda manual de productos
    const manualProductSearch = $('manual-product-search');
    if (manualProductSearch) {
      manualProductSearch.oninput = (e) => {
        showManualProductList(e.target.value);
      };
    }
    
    // Cerrar modal de agregar manual
    const closeManualAdd = $('close-manual-add');
    if (closeManualAdd) {
      closeManualAdd.onclick = () => closeModal('quick-scan-manual-modal');
    }
    
    // ==========================================
    // EVENT LISTENERS PARA RECIBO DE VENTA
    // ==========================================
    
    // Guardar recibo como imagen
    const saveReceiptBtn = $('save-receipt-btn');
    if (saveReceiptBtn) {
      saveReceiptBtn.onclick = () => {
        generateReceiptImage();
      };
    }
    
    // Compartir recibo
    const shareReceiptBtn = $('share-receipt-btn');
    if (shareReceiptBtn) {
      shareReceiptBtn.onclick = () => {
        generateReceiptImage();
      };
    }
    
    // Cerrar modal de recibo
    const closeReceiptBtn = $('close-receipt-btn');
    if (closeReceiptBtn) {
      closeReceiptBtn.onclick = () => {
        closeModal('sale-receipt-modal');
      };
    }
    
    // EVENT LISTENERS PARA VISTA PREVIA DE IMAGEN
    // ==========================================
    
    // Cerrar modal de vista previa
    const closeImagePreviewBtn = $('close-image-preview');
    if (closeImagePreviewBtn) {
      closeImagePreviewBtn.onclick = () => {
        closeModal('image-preview-modal');
      };
    }
    
    // Guardar imagen desde vista previa
    const saveImageBtn = $('save-image-btn');
    if (saveImageBtn) {
      saveImageBtn.onclick = () => {
        const previewData = window.currentPreviewImage;
        if (previewData) {
          const a = document.createElement('a');
          a.href = previewData.dataUrl;
          a.download = previewData.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast('Imagen guardada ✓');
          SoundEffects.play('success');
          closeModal('image-preview-modal');
        }
      };
    }
    
    // Compartir imagen desde vista previa
    const shareImageBtn = $('share-image-btn');
    if (shareImageBtn) {
      shareImageBtn.onclick = async () => {
        const previewData = window.currentPreviewImage;
        if (previewData) {
          try {
            // Convertir dataUrl a blob
            const response = await fetch(previewData.dataUrl);
            const blob = await response.blob();
            const file = new File([blob], previewData.filename, { type: 'image/png' });
            
            if (navigator.share && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Recibo de Venta',
                text: 'Recibo de venta'
              });
              toast('Imagen compartida ✓');
              closeModal('image-preview-modal');
            } else {
              // Fallback: descargar si no se puede compartir
              const a = document.createElement('a');
              a.href = previewData.dataUrl;
              a.download = previewData.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              toast('Imagen guardada (compartir no disponible)');
              closeModal('image-preview-modal');
            }
          } catch (error) {
            console.error('Error al compartir:', error);
            // Fallback: descargar
            const a = document.createElement('a');
            a.href = previewData.dataUrl;
            a.download = previewData.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast('Imagen guardada');
            closeModal('image-preview-modal');
          }
        }
      };
    }
    
    // Botón de lista de ventas ya está en el HTML, no necesitamos agregarlo dinámicamente
    
    // Cerrar modales al hacer clic fuera
    document.addEventListener('click', (e) => {
      // Verificar si se hizo clic en el fondo de un modal
      if (e.target.classList.contains('modal') && e.target.classList.contains('open')) {
        const modalId = e.target.id;
        // No cerrar modales específicos que necesitan confirmación
        const noAutoClose = ['sale-modal', 'detail-modal', 'create-user-modal', 'team-change-role-modal'];
        if (!noAutoClose.includes(modalId)) {
          closeModal(modalId);
        }
      }
    });
    
    // Escape key
    document.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') { document.querySelectorAll('.modal.open').forEach(el => el.classList.remove('open')); closeForm(); closeSidebar(); if (html5QrCode) await stopBarcodeScanner(); const lightbox = $('qr-lightbox'); if (lightbox) lightbox.classList.add('hidden'); }
    });
    
    // Botón atrás del celular
    (function() {
      function pushState() { const current = document.querySelector('.screen.active'); if (current) history.pushState({ view: current.id }, '', ''); }
      window.addEventListener('popstate', function(e) { if (e.state && e.state.view) { const target = document.getElementById(e.state.view); if (target) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); target.classList.add('active'); } } else { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); const cat = document.getElementById('catalog-screen'); if (cat) cat.classList.add('active'); state.currentView = 'catalogs'; } });
      const observer = new MutationObserver(function(mutations) { mutations.forEach(function(m) { if (m.target.classList && m.target.classList.contains('active')) pushState(); }); });
      document.querySelectorAll('.screen').forEach(function(s) { observer.observe(s, { attributes: true, attributeFilter: ['class'] }); });
      setTimeout(pushState, 500);
    })();
    
  } catch (e) { console.error('Error en DOMContentLoaded:', e); }
});
