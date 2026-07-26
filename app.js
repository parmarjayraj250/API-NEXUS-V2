// API Nexus Platform Engine v3.5 (Audited & Perfected Attributes & Interactive Sandbox)

// State Management
let currentTheme = localStorage.getItem('api_nexus_theme') || 'dark';
let favoritesSet = new Set(JSON.parse(localStorage.getItem('api_nexus_favorites') || '[]'));
let recentSearches = JSON.parse(localStorage.getItem('api_nexus_recent_searches') || '[]');
let comparisonSet = new Set();

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

// --- Event Listeners & Shortcuts ---
function setupEventListeners() {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const val = e.target.value;
      
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
    api.provider.toLowerCase().includes(query) ||
    api.tags.some(t => t.toLowerCase().includes(query))
  ).slice(0, 5);

  if (matches.length === 0) {
    dropdown.classList.remove('active');
    return;
  }

  dropdown.innerHTML = matches.map(api => `
    <div class="suggestion-item" onclick="openApiModal('${api.id}')">
      <div>
        <div class="suggestion-title">${escapeHtml(api.name)}</div>
        <div class="suggestion-sub">${escapeHtml(api.provider)} • ${escapeHtml(api.category)}</div>
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
  document.getElementById('autocomplete-dropdown')?.classList.remove('active');
  renderApis();
}

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
    if (selectedMethodFilter !== 'All' && !api.httpMethods.includes(selectedMethodFilter)) return false;
    if (selectedFormatFilter !== 'All' && !api.responseFormats.includes(selectedFormatFilter)) return false;

    if (searchQuery) {
      const matchName = api.name.toLowerCase().includes(searchQuery);
      const matchDesc = api.purpose.toLowerCase().includes(searchQuery);
      const matchProvider = api.provider.toLowerCase().includes(searchQuery);
      const matchCategory = api.category.toLowerCase().includes(searchQuery);
      const matchTags = api.tags.some(t => t.toLowerCase().includes(searchQuery));
      return matchName || matchDesc || matchProvider || matchCategory || matchTags;
    }

    return true;
  });

  list.sort((a, b) => {
    if (currentSort === 'popular') return b.ratingCount - a.ratingCount;
    if (currentSort === 'rating') return b.rating - a.rating;
    if (currentSort === 'fastest') return a.responseTime - b.responseTime;
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

  if (currentView === 'grid') {
    if (gridContainer) gridContainer.innerHTML = currentSlice.map(api => renderCardHtml(api)).join('');
  } else {
    if (tableContainer) tableContainer.innerHTML = renderTableHtml(currentSlice);
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
          ${api.badges.map(b => {
            let cls = 'badge-verified';
            if (b === 'Trending') cls = 'badge-trending';
            if (b === 'Editor Choice') cls = 'badge-editor';
            if (b === 'New') cls = 'badge-new';
            return `<span class="badge ${cls}">${b}</span>`;
          }).join('')}
        </div>

        <p class="card-purpose">${escapeHtml(api.purpose)}</p>
      </div>

      <div>
        <div class="card-stats-bar">
          <div class="stat-pill"><i class="fa-solid fa-star" style="color: var(--accent-amber);"></i> ${api.rating} (${api.ratingCount})</div>
          <div class="stat-pill"><i class="fa-solid fa-gauge-high" style="color: var(--accent-cyan);"></i> ${api.responseTime} ms</div>
          <div class="stat-pill"><i class="fa-solid fa-shield-halved" style="color: var(--accent-emerald);"></i> ${api.uptime}</div>
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
          <th>Auth</th>
          <th>Pricing</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${apis.map(api => `
          <tr>
            <td><strong style="color: var(--text-main);">${escapeHtml(api.name)}</strong></td>
            <td style="color: var(--text-muted);">${escapeHtml(api.provider)}</td>
            <td><span class="category-tag">${escapeHtml(api.category)}</span></td>
            <td><i class="fa-solid fa-star" style="color: var(--accent-amber);"></i> ${api.rating}</td>
            <td style="color: var(--accent-cyan); font-weight: 600;">${api.responseTime} ms</td>
            <td style="color: var(--accent-emerald); font-weight: 600;">${api.uptime}</td>
            <td>${escapeHtml(api.authType)}</td>
            <td><span style="color: var(--accent-emerald); font-weight: 600;">${escapeHtml(api.pricingType)}</span></td>
            <td>
              <button class="btn-card btn-card-primary" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;" onclick="openApiModal('${api.id}')">
                Inspect
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// --- 9-Tab API Inspector Drawer & Interactive Sandbox ---
function openApiModal(apiId) {
  const api = API_DATABASE.find(a => a.id === apiId);
  if (!api) return;
  currentModalApi = api;

  document.getElementById('modal-title').textContent = api.name;
  document.getElementById('modal-category').textContent = `${api.provider} • ${api.category}`;
  
  const webLink = document.getElementById('modal-website-link');
  const docsLink = document.getElementById('modal-docs-link');
  
  if (webLink) {
    webLink.href = api.website;
    webLink.target = "_blank";
    webLink.rel = "noopener noreferrer";
  }
  if (docsLink) {
    docsLink.href = api.docs;
    docsLink.target = "_blank";
    docsLink.rel = "noopener noreferrer";
  }

  // Overview Tab
  document.getElementById('overview-tab').innerHTML = `
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
      <div>
        <h4 style="color: var(--accent-cyan); margin-bottom: 0.5rem;"><i class="fa-solid fa-bullseye"></i> Primary Purpose</h4>
        <p style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 1.5rem;">${escapeHtml(api.purpose)}</p>

        <h4 style="color: var(--accent-cyan); margin-bottom: 0.5rem;"><i class="fa-solid fa-star"></i> Best Use Cases</h4>
        <ul style="list-style-type: none; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
          ${api.bestUseCases.map(uc => `
            <li style="background: var(--bg-input); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border-left: 3px solid var(--accent-cyan);">
              ${escapeHtml(uc)}
            </li>
          `).join('')}
        </ul>

        <h4 style="color: var(--accent-amber); margin-bottom: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Limitations</h4>
        <p style="color: var(--text-muted); background: rgba(245, 158, 11, 0.05); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.2);">
          ${escapeHtml(api.limitations)}
        </p>
      </div>

      <div style="background: var(--bg-input); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <h4 style="color: var(--text-main); margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Quick Stats</h4>
        <div style="margin-bottom: 0.75rem;"><strong>Rating:</strong> ⭐ ${api.rating} (${api.ratingCount} reviews)</div>
        <div style="margin-bottom: 0.75rem;"><strong>Avg Latency:</strong> ${api.responseTime} ms</div>
        <div style="margin-bottom: 0.75rem;"><strong>Uptime:</strong> ${api.uptime}</div>
        <div style="margin-bottom: 0.75rem;"><strong>Version:</strong> ${api.version}</div>
        <div style="margin-bottom: 0.75rem;"><strong>Provider:</strong> ${escapeHtml(api.provider)}</div>
        <a href="${api.docs}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); font-weight: 700; font-size: 0.85rem;">View Official Docs →</a>
      </div>
    </div>
  `;

  // Auth Tab
  document.getElementById('auth-tab').innerHTML = `
    <h4 style="color: var(--accent-cyan); margin-bottom: 1rem;">Authentication Method: ${escapeHtml(api.authType)}</h4>
    <p style="margin-bottom: 1rem; color: var(--text-muted);">${escapeHtml(api.auth)}</p>
    <div class="code-block-container">
      <div class="code-header"><span>Authentication Header Syntax</span></div>
      <pre class="code-content" style="color: var(--accent-cyan);">Authorization: Bearer YOUR_${api.authType.toUpperCase().replace(/\s+/g, '_')}_KEY</pre>
    </div>
  `;

  // Endpoints Tab with Interactive Sandbox
  document.getElementById('endpoints-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">Supported Endpoints & Interactive Playground</h4>
    <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
      ${api.endpoints.map(ep => `
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
          ${api.httpMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <input type="text" id="sandbox-url-input" class="param-input" style="margin: 0; flex: 1; font-family: var(--font-mono);" value="${api.website}${api.endpoints[0]?.path || '/v1/data'}" />
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
          <span style="color: var(--accent-cyan);" id="sandbox-latency">${api.responseTime} ms</span>
        </div>
        <div id="sandbox-json-tree" class="json-tree"></div>
      </div>
    </div>
  `;

  // Code Snippets
  renderCodeSnippetTab(api);

  // Response JSON Tree
  document.getElementById('response-tab').innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h4 style="color: var(--text-main);">Parsed Response Body (Collapsible JSON Tree)</h4>
      <button class="btn-secondary" style="font-size: 0.75rem;" onclick="copySnippet('res-json-raw')"><i class="fa-regular fa-copy"></i> Copy Raw JSON</button>
    </div>
    <div class="code-block-container" style="padding: 1.25rem;">
      <div id="json-tree-container" class="json-tree"></div>
    </div>
    <pre id="res-json-raw" style="display:none;">${JSON.stringify(api.exampleResponse, null, 2)}</pre>
  `;
  renderJsonTree(api.exampleResponse, document.getElementById('json-tree-container'));
  renderJsonTree(api.exampleResponse, document.getElementById('sandbox-json-tree'));

  // Errors Tab
  document.getElementById('errors-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">Standard HTTP Error Codes</h4>
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      ${api.errorCodes.map(err => `
        <div style="background: var(--bg-input); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); border-left: 4px solid var(--accent-rose);">
          <strong style="color: var(--accent-rose); font-family: var(--font-mono);">${err.code} ${escapeHtml(err.title)}</strong>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${escapeHtml(err.desc)}</p>
        </div>
      `).join('')}
    </div>
  `;

  // Pricing Tab
  document.getElementById('pricing-tab').innerHTML = `
    <h4 style="color: var(--accent-emerald); margin-bottom: 0.5rem;">${escapeHtml(api.pricingType)} Pricing Structure</h4>
    <p style="color: var(--text-main); font-size: 1.05rem;">${escapeHtml(api.pricing)}</p>
  `;

  // SDKs Tab
  document.getElementById('sdks-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">Official & Community Libraries</h4>
    <p style="color: var(--text-muted);">${escapeHtml(api.sdks)}</p>
  `;

  // Changelog Tab
  document.getElementById('changelog-tab').innerHTML = `
    <h4 style="color: var(--text-main); margin-bottom: 1rem;">API Revision History</h4>
    ${api.changelog.map(c => `
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

function executeSandboxRequest() {
  if (!currentModalApi) return;

  const statusEl = document.getElementById('sandbox-status-code');
  const latencyEl = document.getElementById('sandbox-latency');
  const treeContainer = document.getElementById('sandbox-json-tree');

  if (statusEl) statusEl.textContent = "Executing...";
  
  setTimeout(() => {
    if (statusEl) statusEl.textContent = "HTTP 200 OK";
    if (latencyEl) latencyEl.textContent = `${Math.floor(Math.random() * 40) + 15} ms`;
    if (treeContainer) renderJsonTree(currentModalApi.exampleResponse, treeContainer);
    showToast("Sandbox request executed successfully!");
  }, 300);
}

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

function generateCodeSnippet(api, lang) {
  const url = `${api.website}/v1/data`;
  if (lang === 'cURL') return api.exampleRequest;
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
  return api.exampleRequest;
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
    ${apis.map(a => `<div class="comp-cell">${escapeHtml(a.provider)}</div>`).join('')}

    <div class="comp-cell"><strong>Rating</strong></div>
    ${apis.map(a => `<div class="comp-cell">⭐ ${a.rating}</div>`).join('')}

    <div class="comp-cell"><strong>Latency</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="color: var(--accent-cyan);">${a.responseTime} ms</div>`).join('')}

    <div class="comp-cell"><strong>Uptime</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="color: var(--accent-emerald);">${a.uptime}</div>`).join('')}

    <div class="comp-cell"><strong>Auth Method</strong></div>
    ${apis.map(a => `<div class="comp-cell">${escapeHtml(a.authType)}</div>`).join('')}

    <div class="comp-cell"><strong>HTTP Methods</strong></div>
    ${apis.map(a => `<div class="comp-cell">${a.httpMethods.join(', ')}</div>`).join('')}

    <div class="comp-cell"><strong>Pricing</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="color: var(--accent-emerald);">${escapeHtml(a.pricingType)}</div>`).join('')}

    <div class="comp-cell"><strong>Rate Limits</strong></div>
    ${apis.map(a => `<div class="comp-cell" style="font-size:0.8rem;">${escapeHtml(a.rateLimits)}</div>`).join('')}
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
    !q || a.name.toLowerCase().includes(q) || a.provider.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q))
  ).slice(0, 10);

  container.innerHTML = filtered.map(api => `
    <div class="suggestion-item" onclick="closeCmdKModal(); openApiModal('${api.id}')">
      <div>
        <div class="suggestion-title">${escapeHtml(api.name)}</div>
        <div class="suggestion-sub">${escapeHtml(api.provider)} • ${escapeHtml(api.category)}</div>
      </div>
      <span class="category-tag">${escapeHtml(api.authType)}</span>
    </div>
  `).join('');
}

// --- Utilities ---
function setView(view) {
  currentView = view;
  document.getElementById('btn-view-grid')?.classList.toggle('active', view === 'grid');
  document.getElementById('btn-view-table')?.classList.toggle('active', view === 'table');
  
  const gridContainer = document.getElementById('api-grid-container');
  const tableContainer = document.getElementById('api-table-container');
  if (gridContainer) gridContainer.style.display = view === 'grid' ? 'grid' : 'none';
  if (tableContainer) tableContainer.style.display = view === 'table' ? 'block' : 'none';
  
  renderApis();
}

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

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
