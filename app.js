// API Nexus Platform Engine v11.0 (Guaranteed Table View Rendering Engine)

// State Management
let currentTheme = localStorage.getItem('api_nexus_theme') || 'dark';
let favoritesSet = new Set(JSON.parse(localStorage.getItem('api_nexus_favorites') || '[]'));
let recentSearches = JSON.parse(localStorage.getItem('api_nexus_recent_searches') || '[]');
let comparisonSet = new Set();

// Auth & Gate State
let currentUser = JSON.parse(localStorage.getItem('api_nexus_authenticated_user') || 'null');
let apiViewsCount = parseInt(localStorage.getItem('api_nexus_api_views') || '0', 10);
let pendingApiIdToOpen = null;

let currentView = 'grid'; // 'grid' | 'table'
let activeCategory = 'All';
let searchQuery = '';
let selectedAuthFilter = 'All';
let selectedPricingFilter = 'All';
let selectedMethodFilter = 'All';
let selectedFormatFilter = 'All';
let showOnlyFavorites = false;
let currentSort = 'popular';

// Pagination State
let currentPage = 1;
const itemsPerPage = 24;

let currentModalApi = null;
let activeSnippetLang = 'cURL';
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  applyTheme(currentTheme);
  renderCategoryChips();
  setupEventListeners();
  updateAuthUI();
  updateStats();
  triggerSearchAndFilter();
}

// --- Theme Management ---
function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('api_nexus_theme', theme);
  
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
}

function toggleTheme() {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  showToast(`Switched to ${nextTheme} theme`);
}

// --- Firebase Authentication State & UI Synchronization ---
function updateAuthUI() {
  // Sync currentUser with localStorage
  currentUser = JSON.parse(localStorage.getItem('api_nexus_authenticated_user') || 'null');
  const container = document.getElementById('auth-nav-container');
  if (!container) return;

  if (currentUser) {
    // Hide auth modal immediately when logged in
    closeAuthModal();

    const initials = currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'DV';
    const avatarHtml = currentUser.photoURL ? 
      `<img src="${escapeHtml(currentUser.photoURL)}" class="user-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-cyan);" alt="Profile" />` : 
      `<div class="user-avatar">${initials}</div>`;

    const providerLabel = (currentUser.provider || 'Google').toUpperCase();

    container.innerHTML = `
      <div class="user-profile-badge" id="user-profile-btn" onclick="toggleProfileDropdown(event)">
        ${avatarHtml}
        <span class="user-name" style="font-weight: 700; color: var(--text-main);">${escapeHtml(currentUser.name)}</span>
        <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; color: var(--text-dim);"></i>

        <div class="profile-dropdown" id="profile-dropdown">
          <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 0.5rem;">
            <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-main);">${escapeHtml(currentUser.name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(currentUser.email)}</div>
            <span style="font-size: 0.65rem; color: var(--accent-emerald); font-weight: 700; text-transform: uppercase;">● FIREBASE VERIFIED (${providerLabel})</span>
          </div>
          <div class="dropdown-item" onclick="logoutUser()">
            <i class="fa-solid fa-right-from-bracket" style="color: var(--accent-rose);"></i> Sign Out
          </div>
        </div>
      </div>
    `;

    // If pending API inspection exists, open it immediately
    if (pendingApiIdToOpen) {
      const target = pendingApiIdToOpen;
      pendingApiIdToOpen = null;
      openApiModal(target, true);
    }
  } else {
    // Guest User state: Show Sign In / Register button
    container.innerHTML = `
      <button class="btn-primary" onclick="openAuthModal()" style="font-size: 0.85rem; padding: 0.45rem 1rem;">
        <i class="fa-solid fa-user-plus"></i> Sign In / Register
      </button>
    `;
  }
}
window.updateAuthUI = updateAuthUI;

function toggleProfileDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.toggle('active');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#user-profile-btn')) {
    document.getElementById('profile-dropdown')?.classList.remove('active');
  }
});

function openAuthModal(reasonMessage) {
  // If user is already signed in, NEVER show auth modal
  currentUser = JSON.parse(localStorage.getItem('api_nexus_authenticated_user') || 'null');
  if (currentUser) {
    closeAuthModal();
    return;
  }

  const modal = document.getElementById('auth-modal');
  const msgEl = document.getElementById('auth-modal-reason');
  if (msgEl && reasonMessage) {
    msgEl.textContent = reasonMessage;
  } else if (msgEl) {
    msgEl.textContent = "Security Notice: Please sign in with Google or GitHub to initialize your Firebase profile and unlock unlimited API specs.";
  }
  if (modal) modal.classList.add('active');
}
window.openAuthModal = openAuthModal;

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.remove('active');
}
window.closeAuthModal = closeAuthModal;

async function loginWithProvider(providerName) {
  if (providerName === 'Google' && window.signInWithGoogleFirebase) {
    try {
      await window.signInWithGoogleFirebase();
      return;
    } catch (err) {
      console.error("Firebase Google Auth Error:", err);
      return;
    }
  }

  if (providerName === 'GitHub' && window.signInWithGithubFirebase) {
    try {
      await window.signInWithGithubFirebase();
      return;
    } catch (err) {
      console.error("Firebase GitHub Auth Error:", err);
      return;
    }
  }
}
window.loginWithProvider = loginWithProvider;

function registerWithEmail(event) {
  if (event) event.preventDefault();
  const emailInput = document.getElementById('auth-email-input');
  const nameInput = document.getElementById('auth-name-input');

  const email = emailInput ? emailInput.value.trim() : '';
  const name = nameInput ? nameInput.value.trim() : '';

  if (!email || !name) {
    showToast("Please enter your name and valid email address.");
    return;
  }

  currentUser = {
    uid: `usr_email_${Date.now()}`,
    name: name,
    email: email,
    photoURL: "",
    provider: "Email"
  };

  localStorage.setItem('api_nexus_authenticated_user', JSON.stringify(currentUser));
  updateAuthUI();
  closeAuthModal();
  showToast(`Welcome ${name}! Registered successfully.`);
}
window.registerWithEmail = registerWithEmail;

async function logoutUser() {
  if (window.firebaseSignOutUser) {
    await window.firebaseSignOutUser();
  }
  currentUser = null;
  localStorage.removeItem('api_nexus_authenticated_user');
  updateAuthUI();
  showToast("You have been signed out.");
}
window.logoutUser = logoutUser;

// --- Favorites Management ---
function toggleFavorite(apiId, event) {
  if (event) event.stopPropagation();

  if (favoritesSet.has(apiId)) {
    favoritesSet.delete(apiId);
    showToast(`Removed API from Favorites`);
  } else {
    favoritesSet.add(apiId);
    showToast(`Added API to Favorites ❤️`);
  }

  localStorage.setItem('api_nexus_favorites', JSON.stringify([...favoritesSet]));
  updateStats();
  renderApis();
}

function toggleFavoritesFilter() {
  showOnlyFavorites = !showOnlyFavorites;
  currentPage = 1;
  const btn = document.getElementById('btn-favorites-filter');
  if (btn) btn.classList.toggle('active', showOnlyFavorites);
  renderApis();
}

// --- Category Chips ---
function renderCategoryChips() {
  const container = document.getElementById('category-chips-container');
  if (!container) return;

  const categories = ['All', ...new Set(API_DATABASE.map(api => api.category))];
  
  container.innerHTML = categories.map(cat => `
    <button class="chip ${cat === activeCategory ? 'active' : ''}" onclick="filterByCategory('${cat}')">
      ${cat}
    </button>
  `).join('');
}

function filterByCategory(cat) {
  activeCategory = cat;
  currentPage = 1;
  renderCategoryChips();
  renderApis();
}

// --- Search Clear Functionality ---
function clearSearchInput() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  searchQuery = '';
  currentPage = 1;
  document.getElementById('search-clear-btn')?.style.setProperty('display', 'none');
  document.getElementById('autocomplete-dropdown')?.classList.remove('active');
  renderApis();
}
window.clearSearchInput = clearSearchInput;

function clearCmdKInput() {
  const cmdkInput = document.getElementById('cmdk-input');
  if (cmdkInput) cmdkInput.value = '';
  renderCmdKResults('');
}

// --- Event Listeners & Shortcuts ---
function setupEventListeners() {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const val = e.target.value;
      
      if (clearBtn) {
        clearBtn.style.display = val.trim().length > 0 ? 'block' : 'none';
      }

      searchDebounceTimer = setTimeout(() => {
        searchQuery = val.toLowerCase().trim();
        currentPage = 1;
        if (searchQuery) addRecentSearch(searchQuery);
        renderApis();
      }, 200);

      renderAutocomplete(val);
    });

    searchInput.addEventListener('focus', (e) => {
      renderAutocomplete(e.target.value);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box-wrapper')) {
        document.getElementById('autocomplete-dropdown')?.classList.remove('active');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdKModal();
    } else if (e.key === 'Escape') {
      closeModal();
      closeCompModal();
      closeCmdKModal();
      closeAuthModal();
    }
  });

  document.getElementById('filter-auth')?.addEventListener('change', (e) => {
    selectedAuthFilter = e.target.value;
    currentPage = 1;
    renderApis();
  });

  document.getElementById('filter-pricing')?.addEventListener('change', (e) => {
    selectedPricingFilter = e.target.value;
    currentPage = 1;
    renderApis();
  });

  document.getElementById('filter-method')?.addEventListener('change', (e) => {
    selectedMethodFilter = e.target.value;
    currentPage = 1;
    renderApis();
  });

  document.getElementById('filter-format')?.addEventListener('change', (e) => {
    selectedFormatFilter = e.target.value;
    currentPage = 1;
    renderApis();
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    currentPage = 1;
    renderApis();
  });

  document.getElementById('btn-view-grid')?.addEventListener('click', () => setView('grid'));
  document.getElementById('btn-view-table')?.addEventListener('click', () => setView('table'));
  document.getElementById('btn-favorites-filter')?.addEventListener('click', toggleFavoritesFilter);
  document.getElementById('btn-open-compare')?.addEventListener('click', openComparisonModal);
  document.getElementById('btn-cmd-k')?.addEventListener('click', openCmdKModal);

  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('comp-modal-close-btn')?.addEventListener('click', closeCompModal);
  document.getElementById('cmdk-modal-close-btn')?.addEventListener('click', closeCmdKModal);
  document.getElementById('auth-modal-close-btn')?.addEventListener('click', closeAuthModal);
}

// --- Autocomplete ---
function addRecentSearch(query) {
  if (!query) return;
  recentSearches = [query, ...recentSearches.filter(q => q !== query)].slice(0, 10);
  localStorage.setItem('api_nexus_recent_searches', JSON.stringify(recentSearches));
}

function renderAutocomplete(val) {
  const dropdown = document.getElementById('autocomplete-dropdown');
  if (!dropdown) return;

  const query = val.toLowerCase().trim();
  if (!query) {
    if (recentSearches.length > 0) {
      dropdown.innerHTML = `
        <div style="padding: 0.5rem 1rem; font-size: 0.75rem; color: var(--text-dim); font-weight: 700;">RECENT SEARCHES</div>
        ${recentSearches.map(q => `
          <div class="suggestion-item" onclick="selectSuggestion('${q}')">
            <span><i class="fa-solid fa-clock-rotate-left"></i> ${escapeHtml(q)}</span>
          </div>
        `).join('')}
      `;
      dropdown.classList.add('active');
    } else {
      dropdown.classList.remove('active');
    }
    return;
  }

  const matches = API_DATABASE.filter(api => 
    api.name.toLowerCase().includes(query) ||
    (api.provider && api.provider.toLowerCase().includes(query)) ||
    (api.tags && api.tags.some(t => t.toLowerCase().includes(query)))
  ).slice(0, 5);

  if (matches.length === 0) {
    dropdown.classList.remove('active');
    return;
  }

  dropdown.innerHTML = matches.map(api => `
    <div class="suggestion-item" onclick="openApiModal('${api.id}')">
      <div>
        <div class="suggestion-title">${escapeHtml(api.name)}</div>
        <div class="suggestion-sub">${escapeHtml(api.provider || 'Provider')} • ${escapeHtml(api.category)}</div>
      </div>
      <span class="category-tag">${escapeHtml(api.authType)}</span>
    </div>
  `).join('');
  dropdown.classList.add('active');
}

function selectSuggestion(q) {
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = q;
  searchQuery = q.toLowerCase();
  currentPage = 1;
  document.getElementById('search-clear-btn')?.style.setProperty('display', 'block');
  document.getElementById('autocomplete-dropdown')?.classList.remove('active');
  renderApis();
}
window.selectSuggestion = selectSuggestion;

// --- Filtering Engine ---
function triggerSearchAndFilter() {
  showSkeletonLoader();
  setTimeout(() => {
    renderApis();
  }, 100);
}

function getFilteredAndSortedApis() {
  let list = API_DATABASE.filter(api => {
    if (showOnlyFavorites && !favoritesSet.has(api.id)) return false;
    if (activeCategory !== 'All' && api.category !== activeCategory) return false;
    if (selectedAuthFilter !== 'All' && api.authType !== selectedAuthFilter) return false;
    if (selectedPricingFilter !== 'All' && api.pricingType !== selectedPricingFilter) return false;
    if (selectedMethodFilter !== 'All' && api.httpMethods && !api.httpMethods.includes(selectedMethodFilter)) return false;
    if (selectedFormatFilter !== 'All' && api.responseFormats && !api.responseFormats.includes(selectedFormatFilter)) return false;

    if (searchQuery) {
      const matchName = api.name.toLowerCase().includes(searchQuery);
      const matchDesc = api.purpose && api.purpose.toLowerCase().includes(searchQuery);
      const matchProvider = api.provider && api.provider.toLowerCase().includes(searchQuery);
      const matchCategory = api.category && api.category.toLowerCase().includes(searchQuery);
      const matchTags = api.tags && api.tags.some(t => t.toLowerCase().includes(searchQuery));
      return matchName || matchDesc || matchProvider || matchCategory || matchTags;
    }

    return true;
  });

  list.sort((a, b) => {
    if (currentSort === 'popular') return (b.ratingCount || 0) - (a.ratingCount || 0);
    if (currentSort === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (currentSort === 'fastest') return (a.responseTime || 0) - (b.responseTime || 0);
    if (currentSort === 'alphabetical') return a.name.localeCompare(b.name);
    return 0;
  });

  return list;
}

function showSkeletonLoader() {
  const gridContainer = document.getElementById('api-grid-container');
  if (!gridContainer || currentView !== 'grid') return;

  gridContainer.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-shimmer"></div>
    </div>
  `).join('');
}

function renderApis() {
  const filtered = getFilteredAndSortedApis();
  const totalItems = filtered.length;

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentSlice = filtered.slice(startIndex, endIndex);

  const gridContainer = document.getElementById('api-grid-container');
  const tableContainer = document.getElementById('api-table-container');

  if (totalItems === 0) {
    const emptyHtml = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-dim);"></i>
        <h3>No APIs match your search & filter parameters</h3>
        <p>Try resetting filters or adjusting your search keyword.</p>
      </div>
    `;
    if (gridContainer) gridContainer.innerHTML = emptyHtml;
    if (tableContainer) tableContainer.innerHTML = emptyHtml;
    renderPagination(0, 0, 0);
    return;
  }

  // GUARANTEED VIEW TOGGLE RENDERING
  if (currentView === 'grid') {
    if (gridContainer) {
      gridContainer.style.display = 'grid';
      gridContainer.innerHTML = currentSlice.map(api => renderCardHtml(api)).join('');
    }
    if (tableContainer) {
      tableContainer.style.display = 'none';
    }
  } else {
    if (gridContainer) {
      gridContainer.style.display = 'none';
    }
    if (tableContainer) {
      tableContainer.style.display = 'block';
      tableContainer.innerHTML = renderTableHtml(currentSlice);
    }
  }

  renderPagination(totalItems, startIndex + 1, endIndex);
}

function renderPagination(totalItems, start, end) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  let pageButtonsHtml = '';
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    pageButtonsHtml += `
      <button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 2rem auto; padding: 0 2rem; flex-wrap: wrap; gap: 1rem;">
      <div style="font-size: 0.9rem; color: var(--text-muted);">
        Showing <strong style="color: var(--text-main);">${start} - ${end}</strong> of <strong style="color: var(--accent-cyan);">${totalItems.toLocaleString()}</strong> APIs
      </div>

      <div style="display: flex; gap: 0.4rem; align-items: center;">
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
          <i class="fa-solid fa-chevron-left"></i> Prev
        </button>
        ${startPage > 1 ? `<button class="page-btn" onclick="goToPage(1)">1</button>${startPage > 2 ? '<span style="color: var(--text-dim);">...</span>' : ''}` : ''}
        ${pageButtonsHtml}
        ${endPage < totalPages ? `${endPage < totalPages - 1 ? '<span style="color: var(--text-dim);">...</span>' : ''}<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>` : ''}
        <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
          Next <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  `;
}

function goToPage(page) {
  currentPage = page;
  renderApis();
  window.scrollTo({ top: 400, behavior: 'smooth' });
}
window.goToPage = goToPage;

function renderCardHtml(api) {
  const isFav = favoritesSet.has(api.id);
  const isComp = comparisonSet.has(api.id);

  return `
    <div class="api-card">
      <div>
        <div class="card-top">
          <div class="card-title-group">
            <h3 class="card-title">${escapeHtml(api.name)}</h3>
          </div>
          <button class="fav-heart-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${api.id}', event)" title="Toggle Favorite">
            <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
          </button>
        </div>

        <div class="badge-row">
          ${(api.badges || []).map(b => {
            let cls = 'badge-verified';
            if (b === 'Trending') cls = 'badge-trending';
            if (b === 'Editor Choice') cls = 'badge-editor';
            if (b === 'New') cls = 'badge-new';
            return `<span class="badge ${cls}">${b}</span>`;
          }).join('')}
        </div>

        <p class="card-purpose">${escapeHtml(api.purpose || 'No description available.')}</p>
      </div>

      <div>
        <div class="card-stats-bar">
          <div class="stat-pill"><i class="fa-solid fa-star" style="color: var(--accent-amber);"></i> ${api.rating || 4.5} (${api.ratingCount || 100})</div>
          <div class="stat-pill"><i class="fa-solid fa-gauge-high" style="color: var(--accent-cyan);"></i> ${api.responseTime || 30} ms</div>
          <div class="stat-pill"><i class="fa-solid fa-shield-halved" style="color: var(--accent-emerald);"></i> ${api.uptime || '99.99%'}</div>
        </div>

        <div class="card-actions">
          <button class="btn-card btn-card-primary" onclick="openApiModal('${api.id}')">
            <i class="fa-solid fa-layer-group"></i> Inspect
          </button>
          <button class="btn-card ${isComp ? 'active' : ''}" onclick="toggleCompare('${api.id}')">
            <i class="fa-solid ${isComp ? 'fa-check' : 'fa-plus'}"></i> Compare
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderTableHtml(apis) {
  if (!apis || apis.length === 0) return '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">No APIs available.</div>';

  const rowsHtml = apis.map(api => {
    const isFav = favoritesSet.has(api.id);
    return `
      <tr>
        <td><strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHtml(api.name)}</strong></td>
        <td style="color: var(--text-muted);">${escapeHtml(api.provider || 'Provider')}</td>
        <td><span class="category-tag">${escapeHtml(api.category)}</span></td>
        <td><i class="fa-solid fa-star" style="color: var(--accent-amber);"></i> ${api.rating || 4.5}</td>
        <td style="color: var(--accent-cyan); font-weight: 600;">${api.responseTime || 30} ms</td>
        <td style="color: var(--accent-emerald); font-weight: 600;">${api.uptime || '99.99%'}</td>
        <td><span class="badge badge-verified">${escapeHtml(api.authType || 'None')}</span></td>
        <td><span style="color: var(--accent-emerald); font-weight: 600;">${escapeHtml(api.pricingType || 'Free')}</span></td>
        <td>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn-card btn-card-primary" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;" onclick="openApiModal('${api.id}')">
              <i class="fa-solid fa-layer-group"></i> Inspect
            </button>
            <button class="fav-heart-btn ${isFav ? 'active' : ''}" style="min-width: 28px; min-height: 28px;" onclick="toggleFavorite('${api.id}', event)" title="Toggle Favorite">
              <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table class="structured-table">
      <thead>
        <tr>
          <th>API Name</th>
          <th>Provider</th>
          <th>Category</th>
          <th>Rating</th>
          <th>Latency</th>
          <th>Uptime</th>
          <th>Auth Method</th>
          <th>Pricing</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

// --- 9-Tab API Inspector Drawer with Firebase Auth Gate ---
function openApiModal(apiId, isBypassingGate = false) {
  currentUser = JSON.parse(localStorage.getItem('api_nexus_authenticated_user') || 'null');
  
  // IF USER IS AUTHENTICATED -> BYPASS AUTH MODAL ENTIRELY
  if (!currentUser && !isBypassingGate) {
    pendingApiIdToOpen = apiId;
    openAuthModal("Firebase Auth Gate: Please sign in with Google or GitHub to initialize your Firebase profile and unlock unlimited API specs.");
    return;
  }

  const api = API_DATABASE.find(a => a.id === apiId);
  if (!api) return;
  currentModalApi = api;

  closeCmdKModal();
  closeAuthModal();
  document.getElementById('autocomplete-dropdown')?.classList.remove('active');

  document.getElementById('modal-title').textContent = api.name;
  document.getElementById('modal-category').textContent = `${api.provider || 'Provider'} • ${api.category}`;
  
  const webLink = document.getElementById('modal-website-link');
  const docsLink = document.getElementById('modal-docs-link');
  
  if (webLink) {
    webLink.href = api.website || '#';
    webLink.target = "_blank";
    webLink.rel = "noopener noreferrer";
  }
  if (docsLink) {
    docsLink.href = api.docs || '#';
    docsLink.target = "_blank";
    docsLink.rel = "noopener noreferrer";
  }

  // Overview Tab
  const useCases = api.bestUseCases || ["Developer API integration", "Data querying & retrieval", "Cloud app workflows"];
  document.getElementById('overview-tab').innerHTML = `
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
      <div>
        <h4 style="color: var(--accent-cyan); margin-bottom: 0.5rem;"><i class="fa-solid fa-bullseye"></i> Primary Purpose</h4>
        <p style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 1.5rem;">${escapeHtml(api.purpose || 'No description available.')}</p>

        <h4 style="color: var(--accent-cyan); margin-bottom: 0.5rem;"><i class="fa-solid fa-star"></i> Best Use Cases</h4>
        <ul style="list-style-type: none; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
          ${useCases.map(uc => `
            <li style="background: var(--bg-input); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-cyan);">
              ${escapeHtml(uc)}
            </li>
          `).join('')}
        </ul>

        <h4 style="color: var(--accent-amber); margin-bottom: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Limitations</h4>
        <p style="color: var(--text-muted); background: rgba(245, 158, 11, 0.05); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.2);">
          ${escapeHtml(api.limitations || 'Rate limits apply; check official documentation.')}
        </p>
      </div>

      <div style="background: var(--bg-input); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h4 style="color: var(--text-main); margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Quick Stats</h4>
        <div style="margin-bottom: 0.75rem;"><strong>Rating:</strong> ⭐ ${api.rating || 4.5} (${api.ratingCount || 100} reviews)</div>
        <div style="margin-bottom: 0.75rem;"><strong>Avg Latency:</strong> ${api.responseTime || 30} ms</div>
        <div style="margin-bottom: 0.75rem;"><strong>Uptime:</strong> ${api.uptime || '99.99%'}</div>
        <div style="margin-bottom: 0.75rem;"><strong>Version:</strong> ${api.version || 'v1.0'}</div>
        <div style="margin-bottom: 0.75rem;"><strong>Provider:</strong> ${escapeHtml(api.provider || 'Provider')}</div>
        <a href="${api.docs || '#'}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); font-weight: 700; font-size: 0.85rem;">View Official Docs →</a>
      </div>
    </div>
  `;

  // Auth Tab
  document.getElementById('auth-tab').innerHTML = `
    <h4 style="color: var(--accent-cyan); margin-bottom: 1rem;">Authentication Method: ${escapeHtml(api.authType || 'None')}</h4>
    <p style="margin-bottom: 1rem; color: var(--text-muted);">${escapeHtml(api.auth || 'None required for open endpoints.')}</p>
    <div class="code-block-container">
      <div class="code-header"><span>Authentication Header Syntax</span></div>
      <pre class="code-content" style="color: var(--accent-cyan);">Authorization: Bearer YOUR_${(api.authType || 'API_KEY').toUpperCase().replace(/\s+/g, '_')}_KEY</pre>
    </div>
  `;

  // Endpoints Tab with Interactive Sandbox
  const endpointsList = api.endpoints && api.endpoints.length > 0 ? api.endpoints : [
    { method: (api.httpMethods && api.httpMethods[0]) || "GET", path: "/v1/data", desc: "Fetch primary data records" },
    { method: "GET", path: "/v1/status", desc: "Check service operational health" }
  ];

  document.getElementById('endpoints-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">Supported Endpoints & Interactive Playground</h4>
    <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
      ${endpointsList.map(ep => `
        <div style="background: var(--bg-input); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 800; font-family: var(--font-mono); color: var(--accent-emerald); margin-right: 0.75rem;">${ep.method}</span>
            <span style="font-family: var(--font-mono); color: var(--text-main);">${escapeHtml(ep.path)}</span>
          </div>
          <span style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(ep.desc)}</span>
        </div>
      `).join('')}
    </div>

    <!-- Live Request Playground -->
    <div style="background: var(--bg-input); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
      <h5 style="color: var(--accent-cyan); margin-bottom: 1rem;"><i class="fa-solid fa-flask"></i> Interactive Request Sandbox</h5>
      
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <select id="sandbox-method" class="select-filter" style="font-weight: 700;">
          ${(api.httpMethods || ['GET', 'POST']).map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <input type="text" id="sandbox-url-input" class="param-input" style="margin: 0; flex: 1; font-family: var(--font-mono);" value="${api.website || 'https://api.example.com'}${endpointsList[0]?.path || '/v1/data'}" />
        <button class="btn-primary" onclick="executeSandboxRequest()"><i class="fa-solid fa-paper-plane"></i> Send Request</button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label style="font-size: 0.75rem; color: var(--text-dim); font-weight: 700;">API KEY (OPTIONAL)</label>
          <input type="password" id="sandbox-key" class="param-input" placeholder="Bearer sk_test_..." value="sk_test_mock_12345" />
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-dim); font-weight: 700;">CONTENT TYPE</label>
          <input type="text" class="param-input" value="application/json" readonly />
        </div>
      </div>

      <div class="code-block-container" style="padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.8rem; margin-bottom: 0.75rem;">
          <span style="color: var(--accent-emerald);" id="sandbox-status-code">HTTP 200 OK</span>
          <span style="color: var(--accent-cyan);" id="sandbox-latency">${api.responseTime || 35} ms</span>
        </div>
        <div id="sandbox-json-tree" class="json-tree"></div>
      </div>
    </div>
  `;

  // Code Snippets
  renderCodeSnippetTab(api);

  // Response JSON Tree
  const exampleRes = api.exampleResponse || { status: "success", message: "API endpoint responded successfully." };
  document.getElementById('response-tab').innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h4 style="color: var(--text-main);">Parsed Response Body (Collapsible JSON Tree)</h4>
      <button class="btn-secondary" style="font-size: 0.75rem;" onclick="copySnippet('res-json-raw')"><i class="fa-regular fa-copy"></i> Copy Raw JSON</button>
    </div>
    <div class="code-block-container" style="padding: 1.25rem;">
      <div id="json-tree-container" class="json-tree"></div>
    </div>
    <pre id="res-json-raw" style="display:none;">${JSON.stringify(exampleRes, null, 2)}</pre>
  `;
  renderJsonTree(exampleRes, document.getElementById('json-tree-container'));
  renderJsonTree(exampleRes, document.getElementById('sandbox-json-tree'));

  // Errors Tab
  const errorCodesList = api.errorCodes && api.errorCodes.length > 0 ? api.errorCodes : [
    { code: 400, title: "Bad Request", desc: "Missing or invalid query parameter." },
    { code: 401, title: "Unauthorized", desc: "Invalid API key or token header." },
    { code: 429, title: "Rate Limit Exceeded", desc: "Too many requests per minute." }
  ];
  document.getElementById('errors-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">Standard HTTP Error Codes</h4>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      ${errorCodesList.map(err => `
        <div style="background: var(--bg-input); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); border-left: 4px solid var(--accent-rose);">
          <strong style="color: var(--accent-rose); font-family: var(--font-mono);">${err.code} ${escapeHtml(err.title)}</strong>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${escapeHtml(err.desc)}</p>
        </div>
      `).join('')}
    </div>
  `;

  // Pricing Tab
  document.getElementById('pricing-tab').innerHTML = `
    <h4 style="color: var(--accent-emerald); margin-bottom: 0.5rem;">${escapeHtml(api.pricingType || 'Free')} Pricing Structure</h4>
    <p style="color: var(--text-main); font-size: 1.05rem;">${escapeHtml(api.pricing || '100% Free & open access.')}</p>
  `;

  // SDKs Tab
  document.getElementById('sdks-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">Official & Community Libraries</h4>
    <p style="color: var(--text-muted);">${escapeHtml(api.sdks || 'Node.js, Python, Go, Java, cURL')}</p>
  `;

  // Changelog Tab
  const changelogList = api.changelog && api.changelog.length > 0 ? api.changelog : [
    { version: api.version || "v1.0", date: "2024-01-01", notes: "Initial public API release." }
  ];
  document.getElementById('changelog-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">API Revision History</h4>
    ${changelogList.map(c => `
      <div style="background: var(--bg-input); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.35rem;">
          <span style="color: var(--accent-cyan);">${c.version}</span>
          <span style="color: var(--text-dim); font-size: 0.8rem;">${c.date}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(c.notes)}</p>
      </div>
    `).join('')}
  `;

  switchTab('overview');
  document.getElementById('api-modal')?.classList.add('active');
}
window.openApiModal = openApiModal;

function executeSandboxRequest() {
  if (!currentModalApi) return;

  const statusEl = document.getElementById('sandbox-status-code');
  const latencyEl = document.getElementById('sandbox-latency');
  const treeContainer = document.getElementById('sandbox-json-tree');

  if (statusEl) statusEl.textContent = "Executing...";
  
  setTimeout(() => {
    if (statusEl) statusEl.textContent = "HTTP 200 OK";
    if (latencyEl) latencyEl.textContent = `${Math.floor(Math.random() * 40) + 15} ms`;
    const resPayload = currentModalApi.exampleResponse || { status: "success", message: "Response received." };
    if (treeContainer) renderJsonTree(resPayload, treeContainer);
    showToast("Sandbox request executed successfully!");
  }, 300);
}
window.executeSandboxRequest = executeSandboxRequest;

function renderCodeSnippetTab(api) {
  const languages = ['cURL', 'JavaScript', 'Node.js', 'Python', 'Java', 'PHP', 'Go', 'C#'];
  
  document.getElementById('request-tab').innerHTML = `
    <div class="code-lang-selector">
      ${languages.map(lang => `
        <button class="code-lang-btn ${lang === activeSnippetLang ? 'active' : ''}" onclick="switchSnippetLang('${lang}')">${lang}</button>
      `).join('')}
    </div>
    <div class="code-block-container">
      <div class="code-header">
        <span id="code-snippet-title">${activeSnippetLang} Snippet</span>
        <button class="copy-btn" onclick="copySnippet('code-req-snippet')"><i class="fa-regular fa-copy"></i> Copy</button>
      </div>
      <pre class="code-content" id="code-req-snippet">${escapeHtml(generateCodeSnippet(api, activeSnippetLang))}</pre>
    </div>
  `;
}

function switchSnippetLang(lang) {
  activeSnippetLang = lang;
  if (currentModalApi) renderCodeSnippetTab(currentModalApi);
}
window.switchSnippetLang = switchSnippetLang;

function generateCodeSnippet(api, lang) {
  const url = `${api.website || 'https://api.example.com'}/v1/data`;
  if (lang === 'cURL') return api.exampleRequest || `curl "${url}" -H "Authorization: Bearer $KEY"`;
  if (lang === 'JavaScript' || lang === 'Node.js') {
    return `fetch("${url}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "Authorization": "Bearer YOUR_API_KEY"\n  },\n  body: JSON.stringify({ query: "sample" })\n})\n.then(res => res.json())\n.then(data => console.log(data));`;
  }
  if (lang === 'Python') {
    return `import requests\n\nurl = "${url}"\nheaders = {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n}\npayload = {"query": "sample"}\n\nresponse = requests.post(url, json=payload, headers=headers)\nprint(response.json())`;
  }
  if (lang === 'Java') {
    return `HttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder()\n    .uri(URI.create("${url}"))\n    .header("Authorization", "Bearer YOUR_API_KEY")\n    .POST(HttpRequest.BodyPublishers.ofString("{\\"query\\":\\"sample\\"}"))\n    .build();`;
  }
  if (lang === 'Go') {
    return `req, _ := http.NewRequest("POST", "${url}", strings.NewReader(\`{"query":"sample"}\`))\nreq.Header.Add("Authorization", "Bearer YOUR_API_KEY")\nresp, _ := http.DefaultClient.Do(req)`;
  }
  if (lang === 'PHP') {
    return `$ch = curl_init("${url}");\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer YOUR_API_KEY"]);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$response = curl_exec($ch);`;
  }
  if (lang === 'C#') {
    return `var client = new RestClient("${url}");\nvar request = new RestRequest(Method.POST);\nrequest.AddHeader("Authorization", "Bearer YOUR_API_KEY");\nIRestResponse response = client.Execute(request);`;
  }
  return api.exampleRequest || `curl "${url}"`;
}

// --- JSON Tree ---
function renderJsonTree(data, container) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(createJsonNode(data));
}

function createJsonNode(val) {
  if (val === null) {
    const span = document.createElement('span');
    span.className = 'json-null';
    span.textContent = 'null';
    return span;
  }
  if (typeof val === 'number') {
    const span = document.createElement('span');
    span.className = 'json-number';
    span.textContent = val;
    return span;
  }
  if (typeof val === 'string') {
    const span = document.createElement('span');
    span.className = 'json-string';
    span.textContent = `"${val}"`;
    return span;
  }
  if (typeof val === 'boolean') {
    const span = document.createElement('span');
    span.className = 'json-boolean';
    span.textContent = val;
    return span;
  }

  const isArray = Array.isArray(val);
  const wrapper = document.createElement('span');
  const toggle = document.createElement('span');
  toggle.className = 'json-toggle';
  toggle.textContent = '▼ ';

  const openChar = document.createTextNode(isArray ? '[' : '{');
  const closeChar = document.createTextNode(isArray ? ']' : '}');
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'json-node';

  const keys = Object.keys(val);
  keys.forEach((key, index) => {
    const line = document.createElement('div');
    if (!isArray) {
      const keySpan = document.createElement('span');
      keySpan.className = 'json-key';
      keySpan.textContent = `"${key}": `;
      line.appendChild(keySpan);
    }
    line.appendChild(createJsonNode(val[key]));
    if (index < keys.length - 1) line.appendChild(document.createTextNode(','));
    childrenContainer.appendChild(line);
  });

  let collapsed = false;
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    toggle.textContent = collapsed ? '▶ ' : '▼ ';
    childrenContainer.style.display = collapsed ? 'none' : 'block';
  });

  wrapper.appendChild(toggle);
  wrapper.appendChild(openChar);
  wrapper.appendChild(childrenContainer);
  wrapper.appendChild(closeChar);
  return wrapper;
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabName}-tab`);
  });
}
window.switchTab = switchTab;

// --- Comparison Engine ---
function toggleCompare(apiId) {
  if (comparisonSet.has(apiId)) {
    comparisonSet.delete(apiId);
    showToast(`Removed from comparison`);
  } else {
    if (comparisonSet.size >= 4) {
      showToast(`Maximum 4 APIs can be compared`);
      return;
    }
    comparisonSet.add(apiId);
    showToast(`Added to comparison matrix`);
  }

  const el = document.getElementById('compare-count');
  if (el) el.textContent = comparisonSet.size;
  renderApis();
}
window.toggleCompare = toggleCompare;

function openComparisonModal() {
  if (comparisonSet.size === 0) {
    showToast("Please select at least 1 API card to compare first");
    return;
  }

  const apis = API_DATABASE.filter(a => comparisonSet.has(a.id));
  const compGrid = document.getElementById('comparison-grid');

  let html = `
    <div class="comp-cell comp-header">Feature</div>
    ${apis.map(a => `<div class="comp-cell comp-header">${escapeHtml(a.name)}</div>`).join('')}

    <div class="comp-cell"><strong>Provider</strong></div>
    ${apis.map(a => `<div class="comp-cell">${escapeHtml(a.provider || 'Provider')}</div>`).join('')}

    <div class="comp-cell"><strong>Rating</strong></div>
    ${apis.map(a => `<div class="comp-cell">⭐ ${a.rating || 4.5}</div>`).join('')}

    <div class="comp-cell"><strong>Latency</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="color: var(--accent-cyan);">${a.responseTime || 30} ms</div>`).join('')}

    <div class="comp-cell"><strong>Uptime</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="color: var(--accent-emerald);">${a.uptime || '99.99%'}</div>`).join('')}

    <div class="comp-cell"><strong>Auth Method</strong></div>
    ${apis.map(a => `<div class="comp-cell">${escapeHtml(a.authType || 'None')}</div>`).join('')}

    <div class="comp-cell"><strong>HTTP Methods</strong></div>
    ${apis.map(a => `<div class="comp-cell">${(a.httpMethods || ['GET']).join(', ')}</div>`).join('')}

    <div class="comp-cell"><strong>Pricing</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="color: var(--accent-emerald);">${escapeHtml(a.pricingType || 'Free')}</div>`).join('')}

    <div class="comp-cell"><strong>Rate Limits</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="font-size:0.8rem;">${escapeHtml(a.rateLimits || '100 req/min')}</div>`).join('')}
  `;

  compGrid.style.gridTemplateColumns = `180px repeat(${apis.length}, 1fr)`;
  compGrid.innerHTML = html;

  document.getElementById('comp-modal')?.classList.add('active');
}

// --- Cmd + K ---
function openCmdKModal() {
  document.getElementById('cmdk-modal')?.classList.add('active');
  const input = document.getElementById('cmdk-input');
  if (input) {
    input.value = '';
    input.focus();
    renderCmdKResults('');
  }
}

function closeCmdKModal() {
  document.getElementById('cmdk-modal')?.classList.remove('active');
}

function renderCmdKResults(query) {
  const container = document.getElementById('cmdk-results');
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = API_DATABASE.filter(a => 
    !q || a.name.toLowerCase().includes(q) || (a.provider && a.provider.toLowerCase().includes(q)) || (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
  ).slice(0, 10);

  container.innerHTML = filtered.map(api => `
    <div class="suggestion-item" onclick="openApiModal('${api.id}')">
      <div>
        <div class="suggestion-title">${escapeHtml(api.name)}</div>
        <div class="suggestion-sub">${escapeHtml(api.provider || 'Provider')} • ${escapeHtml(api.category)}</div>
      </div>
      <span class="category-tag">${escapeHtml(api.authType)}</span>
    </div>
  `).join('');
}
window.renderCmdKResults = renderCmdKResults;

// --- Utilities ---
function setView(view) {
  currentView = view;
  document.getElementById('btn-view-grid')?.classList.toggle('active', view === 'grid');
  document.getElementById('btn-view-table')?.classList.toggle('active', view === 'table');
  
  renderApis();
}
window.setView = setView;

function updateStats() {
  document.getElementById('stat-total-apis').textContent = `${API_DATABASE.length.toLocaleString()}+`;
  document.getElementById('stat-categories').textContent = new Set(API_DATABASE.map(a => a.category)).size;
  document.getElementById('stat-fav-count').textContent = favoritesSet.size;
}

function closeModal() {
  document.getElementById('api-modal')?.classList.remove('active');
}

function closeCompModal() {
  document.getElementById('comp-modal')?.classList.remove('active');
}

function copySnippet(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    showToast("Copied code snippet to clipboard!");
  });
}
window.copySnippet = copySnippet;

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
window.showToast = showToast;

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
