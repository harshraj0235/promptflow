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

  // ═══ Theme Settings ═══
  chrome.storage.sync.get('theme', (res) => {
    if (res.theme) {
      themeSelect.value = res.theme;
      document.documentElement.setAttribute('data-theme', res.theme);
    }
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
