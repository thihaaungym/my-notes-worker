/* Notes App Worker - v7.9 (Note Numbering Format Update)
*/
export default {
  async fetch(request, env) {
    // --- 1. Configuration Checks ---
    if (!env.NOTE_KV) {
      return new Response('Error: KV Namespace (NOTE_KV) not bound.', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
    if (!env.AUTH_PASS) {
      return new Response('Error: Environment Variable (AUTH_PASS) not set.', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
    
    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const expectedToken = `Bearer ${env.AUTH_PASS}`;

    // --- 2. API Routes (/api/...) ---
    if (url.pathname.startsWith('/api/')) {
      if (authHeader !== expectedToken) {
        return new Response('Unauthorized', { status: 401 });
      }

      // GET /api/notes?view=active (or view=trash)
      if (url.pathname === '/api/notes' && request.method === 'GET') {
        const view = url.searchParams.get('view') || 'active';
        const { keys } = await env.NOTE_KV.list();

        const allNotes = await Promise.all(
          keys.map(async (key) => {
            const valueString = await env.NOTE_KV.get(key.name);
            let value;
            try {
              value = JSON.parse(valueString);
            } catch (e) {
              value = { title: 'Untitled (Old Note)', content: valueString || '', in_trash: false };
            }
            if (typeof value !== 'object' || value === null) {
              value = { title: 'Untitled (Old Note)', content: String(value), in_trash: false };
            }
            if (typeof value.in_trash === 'undefined') {
              value.in_trash = false;
            }
            return { key: key.name, value };
          })
        );

        const filteredNotes = allNotes.filter(note => {
          const isTrash = note.value.in_trash === true;
          return (view === 'active') ? !isTrash : isTrash;
        });

        filteredNotes.sort((a, b) => b.key.localeCompare(a.key));
        return Response.json(filteredNotes);
      }

      // POST /api/notes - Note အသစ်သိမ်းမယ်
      if (url.pathname === '/api/notes' && request.method === 'POST') {
        const { title, content } = await request.json();
        if (title && content) {
          const key = new Date().toISOString();
          const newNote = { title, content, in_trash: false };
          await env.NOTE_KV.put(key, JSON.stringify(newNote));
          return Response.json({ success: true, key });
        }
        return new Response('Title and content are required', { status: 400 });
      }

      // PUT /api/notes?key=...&action=update (or action=restore)
      if (url.pathname === '/api/notes' && request.method === 'PUT') {
        const key = url.searchParams.get('key');
        const action = url.searchParams.get('action') || 'update';

        const valueString = await env.NOTE_KV.get(key);
        if (!valueString) return new Response('Note not found', { status: 404 });
        
        const value = JSON.parse(valueString);

        if (action === 'update') {
          const { title, content } = await request.json();
          value.title = title;
          value.content = content;
          value.in_trash = false; 
        } else if (action === 'restore') {
          value.in_trash = false;
        }

        await env.NOTE_KV.put(key, JSON.stringify(value));
        return Response.json({ success: true });
      }
      
      // DELETE /api/notes?key=...&action=trash (or action=permanent)
      if (url.pathname === '/api/notes' && request.method === 'DELETE') {
        const key = url.searchParams.get('key');
        const action = url.searchParams.get('action') || 'trash';

        if (action === 'trash') {
          const valueString = await env.NOTE_KV.get(key);
          if (!valueString) return new Response('Note not found', { status: 404 });
          
          const value = JSON.parse(valueString);
          value.in_trash = true; 
          await env.NOTE_KV.put(key, JSON.stringify(value));
          return Response.json({ success: true, message: 'Moved to trash' });

        } else if (action === 'permanent') {
          let password;
          try {
            const body = await request.json();
            password = body.password;
          } catch (e) {
            return new Response('Password required in request body', { status: 400 });
          }

          if (password !== env.AUTH_PASS) {
            return new Response('Incorrect password. Deletion failed.', { status: 403 }); 
          }
          
          await env.NOTE_KV.delete(key); 
          return Response.json({ success: true, message: 'Permanently deleted' });
        }
        
        return new Response('Invalid delete action', { status: 400 });
      }
    } // End of API routes

    // --- 3. Page Route (/) ---
    if (url.pathname === '/') {
      if (authHeader === expectedToken) {
        // --- App HTML ---
        return new Response(getAppHtml(), {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      } else if (authHeader) {
        return new Response('Unauthorized', { status: 401 });
      } else {
        // --- Login HTML ---
        return new Response(getLoginHtml(), {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }
    }
    
    // --- 4. Other Routes ---
    return Response.redirect(url.origin, 302);
  },
};

// --- HTML Page 1: Login Page (V7.6 ORANGE THEME) ---
function getLoginHtml() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - My Notes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --primary-color: #f25822; /* Strong Orange */
        --primary-hover: #d9481f; 
        --warn-color: #fd7e14;
        
        --gray-light: #f8f9fa;
        --gray-border: #dee2e6;
        --gray-text: #6c757d;
        --text-color: #212529;
        --radius: 8px;
        --shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
      }
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        display: grid; 
        place-items: center; 
        min-height: 100vh; 
        margin: 0;
        background-color: #fff5f2;
        background-image: linear-gradient(135deg, #fff5f2 0%, #ffeee9 100%);
        color: var(--text-color);
      }
      .login-card { 
        background: #fff; 
        padding: 2.5rem 2rem; 
        border-radius: var(--radius); 
        box-shadow: var(--shadow); 
        border: 1px solid #fff;
        text-align: center; 
        width: 320px; 
      }
      h1 { 
        margin-top: 0; 
        color: var(--text-color);
        font-size: 1.75rem; 
        font-weight: 600;
      }
      p {
        color: var(--gray-text);
        margin-bottom: 1.5rem;
      }
      input[type="password"] { 
        width: 100%; 
        box-sizing: border-box; 
        padding: 12px 15px; 
        margin-bottom: 1rem; 
        border: 1px solid var(--gray-border); 
        border-radius: var(--radius); 
        font-size: 16px; 
        font-family: 'Inter', sans-serif;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      input[type="password"]:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(242, 88, 34, 0.2);
        outline: none;
      }
      button { 
        background-image: linear-gradient(to right, var(--primary-color) 0%, var(--warn-color) 100%);
        color: white; 
        padding: 12px 20px; 
        border: none; 
        border-radius: var(--radius); 
        cursor: pointer; 
        font-size: 16px; 
        font-weight: 500;
        width: 100%;
        transition: all 0.2s ease;
      }
      button:hover { 
        box-shadow: 0 4px 12px rgba(242, 88, 34, 0.2);
        transform: translateY(-1px);
      }
      button:disabled { 
        background-image: none;
        background-color: #aaa; 
        box-shadow: none;
        transform: none;
      }
      .error { 
        color: #fa5252; 
        margin-bottom: 1rem; 
        display: none; 
      }
    </style>
  </head>
  <body>
    <div class="login-card">
      <h1>My Notes 📝</h1>
      <p>Please enter your password to continue.</p>
      <div id="error-msg" class="error">Incorrect password.</div>
      <form id="login-form">
        <input type="password" id="password-input" placeholder="Password" required>
        <button type="submit" id="login-button">Login</button>
      </form>
    </div>
    <script>
      const loginForm = document.getElementById('login-form');
      const passwordInput = document.getElementById('password-input');
      const errorMsg = document.getElementById('error-msg');
      const loginButton = document.getElementById('login-button');
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('error')) {
        errorMsg.style.display = 'block';
      }
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.style.display = 'none';
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        const pass = passwordInput.value;
        try {
          const response = await fetch('/', {
            method: 'GET',
            headers: { 'Authorization': \`Bearer \${pass}\` }
          });
          if (response.status === 401) {
            errorMsg.style.display = 'block';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
          } else if (response.ok) {
            sessionStorage.setItem('note_auth_pass', pass);
            const appHtml = await response.text();
            document.open();
            document.write(appHtml);
            document.close();
          } else {
            errorMsg.textContent = 'Server error. Please check worker logs.';
            errorMsg.style.display = 'block';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
          }
        } catch (err) {
          errorMsg.textContent = 'Network error. Please try again.';
          errorMsg.style.display = 'block';
          loginButton.disabled = false;
          loginButton.textContent = 'Login';
        }
      });
    </script>
  </body>
  </html>
  `;
}

// --- HTML Page 2: Main App Page (V7.9 - NUMBERING FIX) ---
function getAppHtml() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Notes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --primary-color: #f25822; 
        --primary-hover: #d9481f;
        --danger-color: #fa5252;
        --danger-hover: #e03131;
        --warn-color: #fd7e14; 
        --warn-hover: #e8590c;
        
        --bg-gradient: linear-gradient(135deg, #fff5f2 0%, #ffeee9 100%); 
        
        --sidebar-bg: #fff0e6; 
        --sidebar-text-color: #4d2a1c; 
        --sidebar-text-muted: #8a5a4c;
        
        --sidebar-item-hover: #fee3d6;
        --sidebar-box-bg: #fff8f5;
        --sidebar-box-border: #ffe8e0;

        --gray-light: #f8f9fa;
        --gray-border: #dee2e6;
        --gray-text: #6c757d;
        --text-color-dark: #212529;
        
        --radius: 8px;
        --shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
      }
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        margin: 0; 
        background-color: #fff5f2; 
        background-image: var(--bg-gradient);
        color: var(--text-color-dark);
        line-height: 1.6;
      }
      
      .app-header {
        background: var(--sidebar-bg);
        border-bottom: 1px solid var(--sidebar-box-border);
        padding: 0 2rem;
        height: 60px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--sidebar-text-color);
      }
      .app-header .credits {
        font-size: 13px;
        color: var(--sidebar-text-color);
        font-weight: 500;
      }
      .app-header button.logout { 
        background-color: var(--sidebar-item-hover); 
        color: var(--sidebar-text-muted); 
        border: none;
        width: auto; 
        padding: 8px 14px;
      }
      .app-header button.logout:hover { 
        background-color: #fee3d6;
        color: var(--sidebar-text-color); 
      }
      
      .app-layout {
        display: grid;
        grid-template-columns: 300px 1fr;
        min-height: calc(100vh - 60px); 
      }
      
      .sidebar {
        background: var(--sidebar-bg);
        border-right: 1px solid #ffe8e0;
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
        color: var(--sidebar-text-color);
      }
      .main-content {
        padding: 2rem;
        overflow-y: auto; 
      }
      .sidebar h1 { 
        color: var(--sidebar-text-color);
        margin: 0;
        font-size: 1.75rem;
        font-weight: 600;
      }
      .sidebar h3 { 
        margin-top: 0; 
        color: var(--sidebar-text-color); 
        font-weight: 600; 
      }
      
      .sidebar .create-box {
        background: var(--sidebar-box-bg); 
        padding: 20px; 
        border-radius: var(--radius); 
        border: 1px solid var(--sidebar-box-border);
      }
      .sidebar .create-box input[type="text"], 
      .sidebar .create-box textarea { 
        width: 100%; 
        box-sizing: border-box; 
        padding: 12px 15px; 
        border: 1px solid var(--sidebar-box-border); 
        background: #fff; 
        border-radius: var(--radius); 
        font-size: 16px; 
        margin-bottom: 15px; 
        font-family: 'Inter', sans-serif;
        transition: border-color 0.15s, box-shadow 0.15s;
        color: var(--text-color-dark); 
      }
      .sidebar .create-box input[type="text"]::placeholder, 
      .sidebar .create-box textarea::placeholder {
        color: var(--sidebar-text-muted);
        opacity: 1;
      }
      .sidebar .create-box input[type="text"]:focus, 
      .sidebar .create-box textarea:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(242, 88, 34, 0.2);
        outline: none;
      }
      .sidebar .create-box textarea { min-height: 120px; }
      
      button { 
        padding: 9px 16px; 
        border: none; 
        border-radius: var(--radius); 
        cursor: pointer; 
        font-size: 14px; 
        font-weight: 500;
        transition: all 0.2s ease; 
        text-align: center;
      }
      .sidebar button.primary { 
        background-image: linear-gradient(to right, var(--primary-color) 0%, var(--warn-color) 100%);
        color: white; 
        font-weight: 600;
        width: 100%; 
      }
      .sidebar button.primary:hover { 
        box-shadow: 0 4px 12px rgba(242, 88, 34, 0.2);
        transform: translateY(-1px);
      }
      button.danger { background-color: var(--danger-color); color: white; }
      button.danger:hover { background-color: var(--danger-hover); }
      button.warn { background-color: var(--warn-color); color: white; }
      button.warn:hover { background-color: var(--warn-hover); }
      button.secondary { background-color: #fff; color: var(--text-color-dark); border: 1px solid var(--gray-border); }
      button.secondary:hover { background-color: #f1f3f5; }
      button.restore-note { 
        background-image: linear-gradient(to right, var(--primary-color) 0%, var(--warn-color) 100%);
        color: white; 
      }
      
      .sidebar .view-toggle {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .sidebar .view-toggle button {
        background: transparent;
        border: none;
        padding: 10px 12px;
        font-weight: 500;
        color: var(--sidebar-text-muted); 
        text-align: left;
        border-radius: 6px;
      }
      .sidebar .view-toggle button.active {
        background-color: var(--primary-color); 
        color: #fff; 
        font-weight: 600;
      }
      .sidebar .view-toggle button:not(.active):hover {
        background-color: var(--sidebar-item-hover); 
        color: var(--sidebar-text-color);
      }
      
      /* --- Notes List --- */
      #notes-list { 
        display: grid;
        gap: 1.25rem;
      }
      .note-item {
        background: #fff; 
        padding: 20px 25px; 
        border-radius: var(--radius); 
        border: 1px solid var(--gray-border);
        box-shadow: 0 2px 4px rgba(0,0,0,0.03);
        transition: all 0.2s ease-in-out;
      }
      .note-item:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow);
      }
      .note-edit { display: none; }
      .note-item h3 {
        margin: 0 0 10px 0;
        display: flex;
        align-items: center;
        font-weight: 600;
        color: var(--text-color-dark);
      }
      .note-number {
        color: var(--gray-text);
        font-size: 0.9em;
        margin-right: 8px;
        user-select: none;
      }
      .note-content { 
        white-space: pre-wrap; 
        word-wrap: break-word; 
        font-size: 15px; 
        background: var(--gray-light); 
        padding: 15px; 
        border-radius: var(--radius); 
        border: 1px solid #f1f3f5;
        max-height: 400px; 
        overflow-y: auto;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      }
      .note-meta { 
        font-size: 12px; 
        color: var(--gray-text); 
        margin-top: 15px; 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
      }
      .note-actions { 
        margin-top: 15px; 
        display: flex; 
        gap: 10px; 
        flex-wrap: wrap;
        border-top: 1px dashed var(--gray-border);
        padding-top: 15px;
      }
      #loading, #empty-message { text-align: center; display: none; padding: 40px 20px; color: var(--gray-text); }

      /* --- Responsive (Mobile) --- */
      @media (max-width: 768px) {
        .app-header {
          padding: 0 1rem;
          height: 50px;
        }
        .app-header .credits {
          font-size: 10px;
        }
        
        .app-layout {
          grid-template-columns: 1fr;
          min-height: calc(100vh - 50px); 
        }
        .sidebar {
          border-right: none;
          padding: 1rem;
          gap: 1.5rem;
        }
        .main-content {
          padding: 1rem;
        }
        .sidebar h1 { font-size: 1.5rem; }
        .sidebar .create-box { padding: 15px; }
      }
    </style>
  </head>
  <body>
    <header class="app-header">
      <div class="credits">
        Created by: Thiha Aung (Yone Man) 🧑‍💻
      </div>
      <button id="logout" class="logout" title="Logout">Logout</button>
    </header>
    
    <div class="app-layout">
      <aside class="sidebar">
        <h1>My Notes 📝</h1>
        <div class="create-box">
          <h3>✨ Create New Note</h3>
          <form id="note-form">
            <input type="text" id="note-title" placeholder="Note Title" required>
            <textarea id="note-content" placeholder="Write your note here..." required></textarea>
            <button type="submit" class="primary">Save Note</button>
          </form>
        </div>
        <nav class="view-toggle">
          <button id="view-active" class="active">Active Notes</button>
          <button id="view-trash">Trash 🗑️</button>
        </nav>
      </aside>
      
      <main class="main-content">
        <div id="loading">Loading notes...</div>
        <div id="empty-message"></div>
        <div id="notes-list"></div>
      </main>
      
    </div>

    <script>
      // --- Global State ---
      const noteForm = document.getElementById('note-form');
      const noteTitleInput = document.getElementById('note-title');
      const noteContentInput = document.getElementById('note-content');
      const notesList = document.getElementById('notes-list');
      const loading = document.getElementById('loading');
      const emptyMsg = document.getElementById('empty-message');
      const viewActiveBtn = document.getElementById('view-active');
      const viewTrashBtn = document.getElementById('view-trash');
      let currentView = 'active';

      // --- 1. API Fetch Wrapper ---
      async function apiFetch(url, options = {}) {
        const pass = sessionStorage.getItem('note_auth_pass');
        if (!pass) {
          handleAuthFailure();
          return;
        }
        const defaultHeaders = {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${pass}\`
        };
        options.headers = { ...defaultHeaders, ...options.headers };
        try {
          const response = await fetch(url, options);
          if (response.status === 401) {
            handleAuthFailure();
            return; 
          }
          if (!response.ok) {
            let errorText = 'Unknown error occurred.';
            try {
              errorText = await response.text();
            } catch (e) {}
            throw new Error(errorText);
          }
          if (response.headers.get('content-type')?.includes('application/json')) {
            return response.json();
          }
          return response.text();
        } catch (error) {
          console.error('Fetch error:', error);
          alert(error.message);
          throw error; 
        }
      }
      
      function handleAuthFailure() {
        sessionStorage.removeItem('note_auth_pass');
        window.location.href = '/?error=1';
      }

      // --- 2. Note Loading ---
      async function loadNotes() {
        loading.style.display = 'block';
        emptyMsg.style.display = 'none';
        notesList.innerHTML = '';
        try {
          const notes = await apiFetch(\`/api/notes?view=\${currentView}\`);
          if (!notes) return; 
          if (notes.length === 0) {
            emptyMsg.textContent = currentView === 'active' ? 'No active notes found. Create one!' : 'Your 🗑️ trash bin is empty.';
            emptyMsg.style.display = 'block';
          } else {
            notes.forEach((note, index) => {
              const noteEl = document.createElement('div');
              noteEl.className = 'note-item';
              noteEl.setAttribute('data-key', note.key);
              if (currentView === 'trash') {
                noteEl.style.opacity = '0.7';
              }
              const actionButtons = currentView === 'active'
                ? \`
                  <button class="secondary" onclick="copyNote(this)">Copy Content</button>
                  <button class="secondary" onclick="toggleEditMode(this)">Edit</button>
                  <button class="warn" onclick="moveToTrash('\${note.key}')">Delete 🗑️</button>
                \`
                : \`
                  <button class="primary restore-note" onclick="restoreNote('\${note.key}')">Restore Note</button>
                  <button class="danger" onclick="deletePermanently('\${note.key}')">Delete Permanently</button>
                \`;
              
              // ### CHANGE: Numbering format changed from #1 to (1). ###
              noteEl.innerHTML = \`
                <div class="note-view">
                  <h3><span class="note-number">(\${index + 1}).</span> \${escapeHTML(note.value.title)}</h3>
                  <pre class="note-content">\${escapeHTML(note.value.content)}</pre>
                  <div class="note-meta">
                    <span>\${new Date(note.key).toLocaleString()}</span>
                  </div>
                  <div class="note-actions">
                    \${actionButtons}
                  </div>
                </div>
                <div class="note-edit">
                  <h3>Edit Note</h3>
                  <input type="text" class="edit-title" value="\${escapeHTML(note.value.title)}">
                  <textarea class="edit-content">\${escapeHTML(note.value.content)}</textarea>
                  <div class="note-actions">
                    <button class="primary" onclick="saveNote(this)">Save Changes</button>
                    <button class="secondary" onclick="toggleEditMode(this)">Cancel</button>
                  </div>
                </div>
              \`;
              notesList.appendChild(noteEl);
            });
          }
        } catch (error) {
          emptyMsg.textContent = 'Error loading notes.';
          emptyMsg.style.display = 'block';
        } finally {
          loading.style.display = 'none';
        }
      }

      // --- 3. View Toggling ---
      viewActiveBtn.addEventListener('click', () => {
        currentView = 'active';
        viewActiveBtn.classList.add('active');
        viewTrashBtn.classList.remove('active');
        loadNotes();
      });
      viewTrashBtn.addEventListener('click', () => {
        currentView = 'trash';
        viewTrashBtn.classList.add('active');
        viewActiveBtn.classList.remove('active');
        loadNotes();
      });

      // --- 4. Note Actions ---
      noteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = noteTitleInput.value.trim();
        const content = noteContentInput.value.trim();
        if (!title || !content) return;
        try {
          await apiFetch('/api/notes', {
            method: 'POST',
            body: JSON.stringify({ title, content })
          });
          noteTitleInput.value = '';
          noteContentInput.value = '';
          loadNotes();
        } catch (error) {}
      });
      async function saveNote(buttonEl) {
        const noteItem = buttonEl.closest('.note-item');
        const key = noteItem.getAttribute('data-key');
        const title = noteItem.querySelector('.edit-title').value;
        const content = noteItem.querySelector('.edit-content').value;
        if (!title || !content) {
          alert('Title and content cannot be empty.');
          return;
        }
        try {
          await apiFetch(\`/api/notes?key=\${key}&action=update\`, {
            method: 'PUT',
            body: JSON.stringify({ title, content })
          });
          loadNotes();
        } catch (error) {}
      }
      async function moveToTrash(key) {
        if (!confirm('Are you sure you want to delete this note? (It will be moved to the trash)')) return;
        try {
          await apiFetch(\`/api/notes?key=\${key}&action=trash\`, { method: 'DELETE' });
          loadNotes();
        } catch (error) {}
      }
      async function restoreNote(key) {
        try {
          await apiFetch(\`/api/notes?key=\${key}&action=restore\`, { method: 'PUT' });
          loadNotes(); 
        } catch (error) {}
      }
      async function deletePermanently(key) {
        const password = prompt("To confirm, please enter your password to PERMANENTLY delete this note:");
        if (!password) return; 
        try {
          await apiFetch(\`/api/notes?key=\${key}&action=permanent\`, {
            method: 'DELETE',
            body: JSON.stringify({ password: password }) 
          });
          loadNotes(); 
        } catch (error) {
          // Error alert is handled by apiFetch
        }
      }

      // --- 5. Helper Functions ---
      function copyNote(buttonEl) {
        const noteItem = buttonEl.closest('.note-item');
        const content = noteItem.querySelector('.note-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
          buttonEl.textContent = 'Copied!';
          setTimeout(() => { buttonEl.textContent = 'Copy Content'; }, 2000);
        });
      }
      function toggleEditMode(buttonEl) {
        const noteItem = buttonEl.closest('.note-item');
        const viewMode = noteItem.querySelector('.note-view');
        const editMode = noteItem.querySelector('.note-edit');
        if (viewMode.style.display !== 'none') {
          viewMode.style.display = 'none';
          editMode.style.display = 'block';
          const title = viewMode.querySelector('h3').textContent.split(' ').slice(1).join(' ');
          const content = viewMode.querySelector('.note-content').textContent;
          editMode.querySelector('.edit-title').value = title;
          editMode.querySelector('.edit-content').value = content;
        } else {
          viewMode.style.display = 'block';
          editMode.style.display = 'none';
        }
      }
      
      document.getElementById('logout').addEventListener('click', () => {
        sessionStorage.removeItem('note_auth_pass');
        window.location.href = '/';
      });
      
      function escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
      }

      // --- Initial Load ---
      loadNotes();
    </script>
  </body>
  </html>
  `;
}
