// ═══════════════════════════════════════════
// PromptFlow Pro v3.0 — Options Page Logic
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');
  const toast = document.getElementById('toast');
  const themeSelect = document.getElementById('theme-select');

  // ═══ Navigation ═══
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('href').substring(1);
      navItems.forEach(n => n.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // ═══ Toast Helper ═══
  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ═══ AI Provider Settings ═══
  const providerSelect = document.getElementById('ai-provider-select');
  const freeInfo = document.getElementById('free-info');
  const geminiCard = document.getElementById('gemini-key-card');
  const groqCard = document.getElementById('groq-key-card');
  const openaiCard = document.getElementById('openai-key-card');
  const geminiKeyInput = document.getElementById('gemini-api-key');
  const groqKeyInput = document.getElementById('groq-api-key');
  const openaiKeyInput = document.getElementById('openai-api-key');
  const saveProviderBtn = document.getElementById('save-provider-btn');

  function updateProviderUI(value) {
    freeInfo.style.display = value === 'auto' ? 'flex' : 'none';
    geminiCard.style.display = value === 'gemini' ? 'block' : 'none';
    groqCard.style.display = value === 'groq' ? 'block' : 'none';
    openaiCard.style.display = value === 'openai' ? 'block' : 'none';
  }

  providerSelect.addEventListener('change', (e) => {
    updateProviderUI(e.target.value);
  });

  // Load saved provider settings
  chrome.storage.sync.get(['aiProvider', 'geminiApiKey', 'groqApiKey', 'openaiApiKey'], (res) => {
    if (res.aiProvider) {
      providerSelect.value = res.aiProvider;
      updateProviderUI(res.aiProvider);
    }
    if (res.geminiApiKey) geminiKeyInput.value = res.geminiApiKey;
    if (res.groqApiKey) groqKeyInput.value = res.groqApiKey;
    if (res.openaiApiKey) openaiKeyInput.value = res.openaiApiKey;
  });

  // Save provider settings
  saveProviderBtn.addEventListener('click', () => {
    const provider = providerSelect.value;
    const settings = { aiProvider: provider };

    if (provider === 'gemini') {
      const key = geminiKeyInput.value.trim();
      if (!key) {
        showToast('Please enter your Gemini API key', 'error');
        geminiKeyInput.focus();
        return;
      }
      settings.geminiApiKey = key;
    } else if (provider === 'groq') {
      const key = groqKeyInput.value.trim();
      if (!key) {
        showToast('Please enter your Groq API key', 'error');
        groqKeyInput.focus();
        return;
      }
      settings.groqApiKey = key;
    } else if (provider === 'openai') {
      const key = openaiKeyInput.value.trim();
      if (!key) {
        showToast('Please enter your OpenAI API key', 'error');
        openaiKeyInput.focus();
        return;
      }
      settings.openaiApiKey = key;
    }

    chrome.storage.sync.set(settings, () => {
      saveProviderBtn.textContent = '✅ Saved!';
      saveProviderBtn.classList.add('saved');
      showToast('AI Provider settings saved!');
      setTimeout(() => {
        saveProviderBtn.textContent = '💾 Save AI Provider Settings';
        saveProviderBtn.classList.remove('saved');
      }, 2000);
    });
  });

  // Toggle API key visibility
  document.getElementById('gemini-toggle-visibility').addEventListener('click', () => {
    const isPassword = geminiKeyInput.type === 'password';
    geminiKeyInput.type = isPassword ? 'text' : 'password';
  });

  document.getElementById('groq-toggle-visibility').addEventListener('click', () => {
    const isPassword = groqKeyInput.type === 'password';
    groqKeyInput.type = isPassword ? 'text' : 'password';
  });

  document.getElementById('openai-toggle-visibility').addEventListener('click', () => {
    const isPassword = openaiKeyInput.type === 'password';
    openaiKeyInput.type = isPassword ? 'text' : 'password';
  });

  // ═══ General Settings ═══
  chrome.storage.local.get(['theme', 'defaultView'], (res) => {
    if (res.theme) {
      themeSelect.value = res.theme;
      if (res.theme === 'light') document.body.setAttribute('data-theme', 'light');
    }
    if (res.defaultView) {
      document.getElementById('default-view').value = res.defaultView;
    }
  });

  themeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    chrome.storage.local.set({ theme: val }, () => {
      if (val === 'light') document.body.setAttribute('data-theme', 'light');
      else document.body.removeAttribute('data-theme');
      showToast('Theme saved!');
    });
  });

  document.getElementById('default-view').addEventListener('change', (e) => {
    chrome.storage.local.set({ defaultView: e.target.value }, () => showToast('Default view saved!'));
  });

  // ═══ Data & Storage ═══
  document.getElementById('export-btn').addEventListener('click', () => {
    chrome.storage.local.get(null, (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promptflow_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported successfully!');
    });
  });

  document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (confirm("⚠️ Are you sure you want to permanently delete ALL your prompts, settings, and analytics? This cannot be undone.")) {
      chrome.storage.local.clear(() => {
        chrome.storage.sync.clear(() => {
          showToast('All data cleared!');
          setTimeout(() => location.reload(), 1500);
        });
      });
    }
  });
});
