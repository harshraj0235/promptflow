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

  // --- Vault Feature ---
  const vaultInput = document.getElementById('vault-new-input');
  const vaultSaveBtn = document.getElementById('vault-save-btn');
  const vaultList = document.getElementById('vault-list');

  function renderVault() {
    chrome.storage.local.get(['savedPrompts'], (result) => {
      const prompts = result.savedPrompts || [];
      vaultList.innerHTML = '';
      if (prompts.length === 0) {
        vaultList.innerHTML = '<p style="color:#9ca3af; font-size:13px; text-align:center;">No saved prompts yet.</p>';
        return;
      }
      
      prompts.forEach((p, index) => {
        const item = document.createElement('div');
        item.className = 'prompt-item';
        item.innerHTML = `
          <p>${p.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          <button class="delete-btn" data-index="${index}" title="Delete">✕</button>
        `;
        
        item.addEventListener('click', (e) => {
          if(e.target.classList.contains('delete-btn')) return;
          navigator.clipboard.writeText(p);
          item.style.borderColor = '#3b82f6';
          setTimeout(() => item.style.borderColor = 'rgba(255,255,255,0.08)', 1000);
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          prompts.splice(index, 1);
          chrome.storage.local.set({ savedPrompts: prompts }, renderVault);
        });
        
        vaultList.appendChild(item);
      });
    });
  }

  vaultSaveBtn.addEventListener('click', () => {
    const text = vaultInput.value.trim();
    if (!text) return;
    chrome.storage.local.get(['savedPrompts'], (result) => {
      const prompts = result.savedPrompts || [];
      prompts.unshift(text);
      chrome.storage.local.set({ savedPrompts: prompts }, () => {
        vaultInput.value = '';
        renderVault();
      });
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

  // Init
  renderVault();
});
