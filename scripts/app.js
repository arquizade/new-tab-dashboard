/* ─── Storage ───────────────────────────────────────────────── */

const storage = {
  async get(key) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([key], (result) => resolve(result[key] || null));
      } else {
        // Dev fallback: use localStorage
        const val = localStorage.getItem(key);
        resolve(val ? JSON.parse(val) : null);
      }
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [key]: value }, resolve);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      }
    });
  }
};

/* ─── State ─────────────────────────────────────────────────── */

let state = {
  links:  [],
  todos:  [],
  notes:  [],
  config: { theme: 'dark' }
};

async function loadState() {
  const links  = await storage.get('ntd-links');
  const todos  = await storage.get('ntd-todos');
  const notes  = await storage.get('ntd-notes');
  const config = await storage.get('ntd-config');
  state.links  = links  || [];
  state.todos  = todos  || [];
  state.notes  = notes  || [];
  state.config = config || { theme: 'dark', linksLayout: 'grid' };
}

async function saveLinks()  { await storage.set('ntd-links',   state.links); }
async function saveTodos()  { await storage.set('ntd-todos',   state.todos); }
async function saveNotes()  { await storage.set('ntd-notes',   state.notes); }
async function saveConfig() { await storage.set('ntd-config',  state.config); }

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ─── Theme ─────────────────────────────────────────────────── */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';
}

function initTheme() {
  applyTheme(state.config.theme);

  document.getElementById('themeToggle').addEventListener('click', async () => {
    state.config.theme = state.config.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.config.theme);
    await saveConfig();
  });
}

/* ─── Links Layout ───────────────────────────────────────────── */

function applyLinksLayout(layout) {
  const grid     = document.getElementById('linksGrid');
  const btnGrid  = document.getElementById('layoutGrid');
  const btnList  = document.getElementById('layoutList');

  if (layout === 'list') {
    grid.classList.add('layout-list');
    btnList.classList.add('active');
    btnGrid.classList.remove('active');
  } else {
    grid.classList.remove('layout-list');
    btnGrid.classList.add('active');
    btnList.classList.remove('active');
  }
}

function initLinksLayout() {
  applyLinksLayout(state.config.linksLayout || 'grid');

  document.getElementById('layoutGrid').addEventListener('click', async () => {
    state.config.linksLayout = 'grid';
    applyLinksLayout('grid');
    await saveConfig();
  });

  document.getElementById('layoutList').addEventListener('click', async () => {
    state.config.linksLayout = 'list';
    applyLinksLayout('list');
    await saveConfig();
  });
}

/* ─── Sidebar Navigation ────────────────────────────────────── */

function initNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;

      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`section-${target}`).classList.add('active');

      // Hide any open forms when switching sections
      hideAllForms();
    });
  });
}

function hideAllForms() {
  ['formLink', 'formTodo', 'formNote'].forEach((id) => {
    document.getElementById(id).classList.add('hidden');
  });
}

/* ─── Clock ─────────────────────────────────────────────────── */

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('timeDisplay').textContent = `${h}:${m}`;

  const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  document.getElementById('dateDisplay').textContent = d;
}

function initClock() {
  updateClock();
  setInterval(updateClock, 30_000);
}

/* ─── Links ─────────────────────────────────────────────────── */

function getFavicon(url) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

function renderLinks() {
  const grid   = document.getElementById('linksGrid');
  const empty  = document.getElementById('linksEmpty');
  grid.innerHTML = '';

  if (state.links.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  state.links.forEach((link) => {
    const a = document.createElement('a');
    a.className = 'link-card';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    const favicon = getFavicon(link.url);
    const faviconHtml = favicon
      ? `<img class="link-card-favicon" src="${favicon}" alt="" onerror="this.style.display='none'" />`
      : '';

    let displayUrl = '';
    try {
      displayUrl = new URL(link.url).hostname.replace('www.', '');
    } catch {
      displayUrl = link.url;
    }

    a.innerHTML = `
      ${faviconHtml}
      <span class="link-card-title">${escapeHtml(link.title)}</span>
      <span class="link-card-url">${escapeHtml(displayUrl)}</span>
      <button class="card-delete" data-id="${link.id}" title="Remove">×</button>
    `;

    // Delete button: stop link navigation
    a.querySelector('.card-delete').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.links = state.links.filter((l) => l.id !== link.id);
      await saveLinks();
      renderLinks();
    });

    grid.appendChild(a);
  });
}

function initLinks() {
  const btnAdd   = document.getElementById('btnAddLink');
  const form     = document.getElementById('formLink');
  const inputTitle = document.getElementById('linkTitle');
  const inputUrl = document.getElementById('linkUrl');
  const btnSave  = document.getElementById('saveLinkBtn');
  const btnCancel = document.getElementById('cancelLinkBtn');

  btnAdd.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) inputTitle.focus();
  });

  btnCancel.addEventListener('click', () => {
    form.classList.add('hidden');
    inputTitle.value = '';
    inputUrl.value = '';
  });

  async function saveLink() {
    const title = inputTitle.value.trim();
    const rawUrl = inputUrl.value.trim();
    if (!title || !rawUrl) return;

    let url = rawUrl;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    const link = { id: genId(), title, url };
    state.links.push(link);
    await saveLinks();
    renderLinks();

    inputTitle.value = '';
    inputUrl.value = '';
    form.classList.add('hidden');
  }

  btnSave.addEventListener('click', saveLink);

  [inputTitle, inputUrl].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveLink();
      if (e.key === 'Escape') btnCancel.click();
    });
  });
}

/* ─── Todos ─────────────────────────────────────────────────── */

function renderTodos() {
  const list  = document.getElementById('todoList');
  const empty = document.getElementById('todosEmpty');
  list.innerHTML = '';

  if (state.todos.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  state.todos.forEach((todo) => {
    const li = document.createElement('li');
    li.className = `todo-item${todo.completed ? ' completed' : ''}`;
    li.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} />
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button class="todo-delete" data-id="${todo.id}" title="Remove">×</button>
    `;

    li.querySelector('.todo-checkbox').addEventListener('change', async (e) => {
      const item = state.todos.find((t) => t.id === todo.id);
      if (item) item.completed = e.target.checked;
      await saveTodos();
      renderTodos();
    });

    li.querySelector('.todo-delete').addEventListener('click', async () => {
      state.todos = state.todos.filter((t) => t.id !== todo.id);
      await saveTodos();
      renderTodos();
    });

    list.appendChild(li);
  });
}

function initTodos() {
  const btnAdd   = document.getElementById('btnAddTodo');
  const form     = document.getElementById('formTodo');
  const input    = document.getElementById('todoText');
  const btnSave  = document.getElementById('saveTodoBtn');
  const btnCancel = document.getElementById('cancelTodoBtn');

  btnAdd.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) input.focus();
  });

  btnCancel.addEventListener('click', () => {
    form.classList.add('hidden');
    input.value = '';
  });

  async function saveTodo() {
    const text = input.value.trim();
    if (!text) return;

    state.todos.push({ id: genId(), text, completed: false });
    await saveTodos();
    renderTodos();

    input.value = '';
    form.classList.add('hidden');
  }

  btnSave.addEventListener('click', saveTodo);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveTodo();
    if (e.key === 'Escape') btnCancel.click();
  });
}

/* ─── Notes ─────────────────────────────────────────────────── */

function formatDate(isoString) {
  const d = new Date(isoString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function renderNotes() {
  const list  = document.getElementById('notesList');
  const empty = document.getElementById('notesEmpty');
  list.innerHTML = '';

  if (state.notes.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Most recent first
  const sorted = [...state.notes].reverse();

  sorted.forEach((note) => {
    const div = document.createElement('div');
    div.className = 'note-card';
    div.innerHTML = `
      <p class="note-text">${escapeHtml(note.text)}</p>
      <span class="note-meta">${formatDate(note.date)}</span>
      <button class="note-delete" data-id="${note.id}" title="Remove">Delete</button>
    `;

    div.querySelector('.note-delete').addEventListener('click', async () => {
      state.notes = state.notes.filter((n) => n.id !== note.id);
      await saveNotes();
      renderNotes();
    });

    list.appendChild(div);
  });
}

function initNotes() {
  const btnAdd   = document.getElementById('btnAddNote');
  const form     = document.getElementById('formNote');
  const textarea = document.getElementById('noteText');
  const btnSave  = document.getElementById('saveNoteBtn');
  const btnCancel = document.getElementById('cancelNoteBtn');

  btnAdd.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) textarea.focus();
  });

  btnCancel.addEventListener('click', () => {
    form.classList.add('hidden');
    textarea.value = '';
  });

  async function saveNote() {
    const text = textarea.value.trim();
    if (!text) return;

    state.notes.push({
      id: genId(),
      text,
      date: new Date().toISOString()
    });
    await saveNotes();
    renderNotes();

    textarea.value = '';
    form.classList.add('hidden');
  }

  btnSave.addEventListener('click', saveNote);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveNote();
    if (e.key === 'Escape') btnCancel.click();
  });
}

/* ─── Utilities ─────────────────────────────────────────────── */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─── Boot ──────────────────────────────────────────────────── */

async function init() {
  await loadState();

  initTheme();
  initLinksLayout();
  initClock();
  initNav();
  initLinks();
  initTodos();
  initNotes();

  renderLinks();
  renderTodos();
  renderNotes();
}

document.addEventListener('DOMContentLoaded', init);
