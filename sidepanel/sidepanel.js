document.addEventListener('DOMContentLoaded', () => {
  
  // --- Routing & Navigation ---
  const views = document.querySelectorAll('.view');
  const btnBack = document.getElementById('btn-back');
  
  function switchView(targetId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    if (targetId === 'view-home') {
      btnBack.classList.add('hidden');
    } else {
      btnBack.classList.remove('hidden');
    }
  }

  btnBack.addEventListener('click', () => switchView('view-home'));

  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-target');
      if (target) switchView(target);
    });
  });

  // --- Analytics Dashboard ---
  function loadAnalytics() {
    chrome.storage.local.get(['analytics'], (res) => {
      if (res.analytics) {
        document.getElementById('stat-today').innerText = res.analytics.promptsUsedToday || 0;
        document.getElementById('stat-time').innerText = Math.floor((res.analytics.timeSavedSeconds || 0) / 60) + 'm';
      }
    });
  }
  loadAnalytics();

  // --- Vault Feature ---
  const vaultInput = document.getElementById('vault-new-input');
  const vaultFolderInput = document.getElementById('vault-new-folder');
  const vaultSaveBtn = document.getElementById('vault-save-btn');
  const vaultList = document.getElementById('vault-list');
  const vaultSearch = document.getElementById('vault-search');
  const vaultFolderFilter = document.getElementById('vault-folder-filter');

  let currentFolderFilter = 'All';

  function renderVault() {
    chrome.storage.local.get(['savedPrompts'], (result) => {
      let prompts = result.savedPrompts || [];
      // Normalize legacy strings
      prompts = prompts.map(p => typeof p === 'string' ? { content: p, folder: 'Uncategorized', rating: 0, id: Date.now() + Math.random().toString() } : p);
      
      // Update Folders Dropdown
      const folders = [...new Set(prompts.map(p => p.folder || 'Uncategorized'))];
      vaultFolderFilter.innerHTML = '<option value="All">All Folders</option>';
      folders.forEach(f => {
        const selected = currentFolderFilter === f ? 'selected' : '';
        vaultFolderFilter.innerHTML += \`<option value="\${f}" \${selected}>\${f}</option>\`;
      });

      // Filter
      const q = vaultSearch.value.toLowerCase();
      if (currentFolderFilter !== 'All') prompts = prompts.filter(p => (p.folder || 'Uncategorized') === currentFolderFilter);
      if (q) prompts = prompts.filter(p => p.content.toLowerCase().includes(q) || (p.tags && p.tags.join(' ').toLowerCase().includes(q)));

      vaultList.innerHTML = '';
      if (prompts.length === 0) {
        vaultList.innerHTML = '<p style="color:#9ca3af; font-size:13px; text-align:center;">No prompts found.</p>';
        return;
      }
      
      prompts.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'prompt-item';
        const folderBadge = p.folder && p.folder !== 'Uncategorized' ? \`<span style="font-size:10px; padding:2px 6px; background:#e0e7ff; color:#3730a3; border-radius:4px; margin-bottom:4px; display:inline-block;">\${p.folder}</span><br>\` : '';
        item.innerHTML = \`
          \${folderBadge}
          <p style="margin-top:0;">\${p.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span style="font-size:12px; color:#f59e0b; cursor:pointer;" class="star-rating" data-id="\${p.id}">\${'★'.repeat(p.rating || 0)}\${'☆'.repeat(5 - (p.rating || 0))}</span>
            <button class="delete-btn" data-id="\${p.id}" title="Delete">✕</button>
          </div>
        \`;
        
        item.addEventListener('click', (e) => {
          if(e.target.classList.contains('delete-btn') || e.target.classList.contains('star-rating')) return;
          navigator.clipboard.writeText(p.content);
          item.style.borderColor = '#3b82f6';
          setTimeout(() => item.style.borderColor = 'rgba(255,255,255,0.08)', 1000);
          try { chrome.runtime.sendMessage({ action: 'track_usage' }); loadAnalytics(); } catch(e) {}
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.storage.local.get(['savedPrompts'], (res) => {
             const all = res.savedPrompts || [];
             const idx = all.findIndex(x => (typeof x === 'object' ? x.id === p.id : x === p.content));
             if (idx > -1) all.splice(idx, 1);
             chrome.storage.local.set({ savedPrompts: all }, renderVault);
          });
        });

        // Rating click
        item.querySelector('.star-rating').addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.storage.local.get(['savedPrompts'], (res) => {
             const all = res.savedPrompts || [];
             const target = all.find(x => typeof x === 'object' ? x.id === p.id : x === p.content);
             if (target) {
               if (typeof target === 'string') return;
               target.rating = ((target.rating || 0) + 1) % 6;
               chrome.storage.local.set({ savedPrompts: all }, renderVault);
             }
          });
        });
        
        vaultList.appendChild(item);
      });
    });
  }

  vaultSearch.addEventListener('input', renderVault);
  vaultFolderFilter.addEventListener('change', (e) => {
    currentFolderFilter = e.target.value;
    renderVault();
  });

  vaultSaveBtn.addEventListener('click', () => {
    const text = vaultInput.value.trim();
    const folder = vaultFolderInput.value.trim() || 'Uncategorized';
    if (!text) return;
    chrome.storage.local.get(['savedPrompts'], (result) => {
      const prompts = result.savedPrompts || [];
      prompts.unshift({
        id: Date.now().toString(),
        content: text,
        folder: folder,
        rating: 0,
        usageCount: 0,
        createdAt: new Date().toISOString()
      });
      chrome.storage.local.set({ savedPrompts: prompts }, () => {
        vaultInput.value = '';
        vaultFolderInput.value = '';
        renderVault();
      });
    });
  });

  // --- Share / Import Collection ---
  document.getElementById('vault-share-btn').addEventListener('click', () => {
    chrome.storage.local.get(['savedPrompts'], (res) => {
      let prompts = res.savedPrompts || [];
      prompts = prompts.map(p => typeof p === 'string' ? { content: p, folder: 'Uncategorized' } : p);
      if (currentFolderFilter !== 'All') prompts = prompts.filter(p => p.folder === currentFolderFilter);
      
      const b64 = btoa(encodeURIComponent(JSON.stringify(prompts)));
      navigator.clipboard.writeText(b64);
      const btn = document.getElementById('vault-share-btn');
      btn.innerText = 'Copied Link!';
      setTimeout(() => btn.innerText = 'Share', 2000);
    });
  });

  // --- Craft Feature ---
  const craftInput = document.getElementById('craft-input');
  const craftBtn = document.getElementById('craft-btn');
  const craftOutput = document.getElementById('craft-output');
  const craftResultGroup = document.getElementById('craft-result-group');
  const craftCopyBtn = document.getElementById('craft-copy-btn');

  craftBtn.addEventListener('click', () => {
    const text = craftInput.value.trim();
    if (!text) return;
    
    craftBtn.innerHTML = '⏳ Enhancing...';
    chrome.runtime.sendMessage({ action: 'ai_enhance', text: text }, (response) => {
      craftBtn.innerHTML = '✨ Enhance';
      if (chrome.runtime.lastError || !response || !response.success) {
         craftOutput.value = "Error: Failed to reach AI enhancer.";
         craftResultGroup.classList.remove('hidden');
         return;
      }
      craftOutput.value = response.text;
      craftResultGroup.classList.remove('hidden');
    });
  });

  craftCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(craftOutput.value);
    craftCopyBtn.innerHTML = 'Copied!';
    setTimeout(() => craftCopyBtn.innerHTML = 'Copy to Clipboard', 2000);
  });

  // --- Export Chat Feature ---
  const exportBtn = document.getElementById('export-btn');
  const exportStatus = document.getElementById('export-status');

  exportBtn.addEventListener('click', () => {
    exportStatus.innerText = 'Extracting chat...';
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || (activeTab.url && activeTab.url.startsWith('chrome://'))) {
        exportStatus.innerText = 'Cannot export from this page.';
        exportStatus.style.color = '#ef4444';
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: 'export_chat' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
           exportStatus.innerText = 'No chat found or extraction failed. Try refreshing the page.';
           exportStatus.style.color = '#ef4444';
           return;
        }
        
        // Generate download
        const blob = new Blob([response.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PromptFlow_Export_${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
        
        exportStatus.innerText = 'Chat exported successfully!';
        exportStatus.style.color = '#34d399';
      });
    });
  });

  // --- Settings Feature ---
  const clearBtn = document.getElementById('settings-clear-btn');
  clearBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all saved prompts?")) {
      chrome.storage.local.set({ savedPrompts: [] }, () => {
        alert("Prompts cleared.");
        renderVault();
      });
    }
  });

  const importBtn = document.getElementById('settings-import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const val = document.getElementById('import-json').value.trim();
      if (!val) return;
      try {
        const parsed = JSON.parse(decodeURIComponent(atob(val)));
        if (Array.isArray(parsed)) {
          chrome.storage.local.get(['savedPrompts'], (res) => {
            const merged = [...(res.savedPrompts || []), ...parsed];
            chrome.storage.local.set({ savedPrompts: merged }, () => {
              alert('Collection imported successfully!');
              document.getElementById('import-json').value = '';
              renderVault();
            });
          });
        }
      } catch(err) {
        alert("Invalid Share Link. Make sure you pasted the exact string copied from the Share button.");
      }
    });
  }

  // Init
  renderVault();
});
