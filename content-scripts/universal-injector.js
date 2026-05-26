// Detect AI Platform and inject toolbar
console.log("PromptFlow Pro: Universal Injector active");

function initialize() {
  injectCommandPalette();
}

let activeInput = null;
let btnContainer = null;

function createInlineButton() {
  if (document.getElementById('pf-inline-btn-container')) return;

  btnContainer = document.createElement('div');
  btnContainer.id = 'pf-inline-btn-container';
  btnContainer.style.display = 'none';
  btnContainer.style.position = 'fixed';
  btnContainer.style.gap = '8px';
  btnContainer.style.zIndex = '9999';

  inlineBtn = document.createElement('button');
  inlineBtn.id = 'pf-universal-inline-btn';
  inlineBtn.className = 'pf-inline-enhance-btn';
  inlineBtn.innerHTML = '✨ Enhance';
  inlineBtn.title = 'Enhance Prompt (Ctrl+M)';
  inlineBtn.type = 'button';
  
  inlineBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!activeInput) return;
    const text = activeInput.value || activeInput.innerText;
    if (!text.trim()) { alert("PromptFlow Pro: Please type a prompt first."); return; }
    
    let currentStep = 0;
    const loadingSteps = ['⏳ Prompt Analyzer...', '🧠 Intent Detection...', '⚙️ Expansion Engine...', '✨ AI Optimization...'];
    inlineBtn.innerHTML = loadingSteps[0];
    
    const loadingInterval = setInterval(() => {
      currentStep++;
      if (currentStep < loadingSteps.length) {
        inlineBtn.innerHTML = loadingSteps[currentStep];
      }
    }, 400);

    try {
      chrome.runtime.sendMessage({ action: 'ai_enhance', text: text }, (response) => {
        clearInterval(loadingInterval);
        inlineBtn.innerHTML = '✨ Enhance';
        if (chrome.runtime.lastError || !response || !response.success) {
           alert("PromptFlow Pro: Failed to reach AI enhancer.");
           return;
        }
        if (activeInput.tagName === 'TEXTAREA' || activeInput.tagName === 'INPUT') {
          activeInput.value = response.text;
        } else {
          activeInput.innerText = response.text;
        }
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        const tracker = activeInput._valueTracker;
        if (tracker) tracker.setValue('');
        
        try { chrome.runtime.sendMessage({ action: 'track_usage' }); } catch(e) {}
      });
    } catch (err) {
      inlineBtn.innerHTML = '✨ Enhance';
      if (err.message.includes('Extension context invalidated')) {
        alert("PromptFlow Pro was just updated! Please refresh this page to continue using the extension.");
      } else {
        console.error(err);
      }
    }
  });

  const saveBtn = document.createElement('button');
  saveBtn.id = 'pf-universal-save-btn';
  saveBtn.className = 'pf-inline-save-btn';
  saveBtn.innerHTML = '💾 Save';
  saveBtn.title = 'Save to Vault';
  saveBtn.type = 'button';

  saveBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!activeInput) return;
    const text = activeInput.value || activeInput.innerText;
    if (!text.trim()) { alert("PromptFlow Pro: Please type a prompt to save."); return; }
    
    saveBtn.innerHTML = '✅ Saved';
    try {
      chrome.runtime.sendMessage({ action: 'save_prompt', text: text }, () => {
        setTimeout(() => saveBtn.innerHTML = '💾 Save', 2000);
      });
    } catch (err) {
      saveBtn.innerHTML = '💾 Save';
      if (err.message.includes('Extension context invalidated')) {
        alert("PromptFlow Pro was just updated! Please refresh this page to continue using the extension.");
      } else {
        console.error(err);
      }
    }
  });

  btnContainer.appendChild(saveBtn);
  btnContainer.appendChild(inlineBtn);
  document.body.appendChild(btnContainer);
}

function updateButtonPosition() {
  if (!btnContainer || !activeInput) return;
  const rect = activeInput.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0 || rect.top > window.innerHeight + 50) {
    btnContainer.style.display = 'none';
    return;
  }
  btnContainer.style.display = 'flex';
  
  // Sleek Pill Container Styling injected dynamically
  btnContainer.style.background = 'rgba(26, 26, 46, 0.85)';
  btnContainer.style.backdropFilter = 'blur(12px)';
  btnContainer.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  btnContainer.style.borderRadius = '30px';
  btnContainer.style.padding = '4px 6px';
  btnContainer.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
  
  // Position elegantly overlapping the top right border
  btnContainer.style.top = (rect.top - 24) + 'px'; 
  btnContainer.style.left = (rect.right - 210) + 'px';
}

const observer = new MutationObserver((mutations) => {
  const inputs = document.querySelectorAll('textarea, [contenteditable="true"]');
  if (inputs.length > 0) {
    initialize();
    let bestInput = null;
    let maxArea = 0;
    inputs.forEach(input => {
      const rect = input.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (rect.width > 100 && rect.height >= 10 && area > maxArea) {
        maxArea = area;
        bestInput = input;
      }
    });
    if (bestInput && bestInput !== activeInput) {
      activeInput = bestInput;
      createInlineButton();
      updateButtonPosition();
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('scroll', updateButtonPosition, true);
window.addEventListener('resize', updateButtonPosition);
setInterval(updateButtonPosition, 500);

document.addEventListener('keydown', (e) => {
  // Enhance Shortcut (Ctrl+M)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    if (btnContainer && btnContainer.style.display !== 'none') {
      const btn = document.getElementById('pf-universal-inline-btn');
      if (btn) btn.click();
    }
  }
  
  // Command Palette Shortcut (Ctrl+Shift+P)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    e.stopPropagation();
    openCommandPalette();
  }
});

let cmdPalette = null;
let cmdList = null;

function injectCommandPalette() {
  if (document.getElementById('pf-command-palette')) return;
  
  cmdPalette = document.createElement('div');
  cmdPalette.id = 'pf-command-palette';
  cmdPalette.className = 'pf-cmd-palette-overlay';
  cmdPalette.style.display = 'none';
  
  cmdPalette.innerHTML = `
    <div class="pf-cmd-modal" id="pf-cmd-modal">
      <div class="pf-cmd-header">
        <span class="pf-cmd-logo">⚡ PF</span>
        <input type="text" id="pf-cmd-search" class="pf-cmd-search" placeholder="Search your Vault..." autocomplete="off" />
      </div>
      <div class="pf-cmd-list" id="pf-cmd-list"></div>
    </div>
  `;
  document.body.appendChild(cmdPalette);
  
  cmdList = document.getElementById('pf-cmd-list');
  const searchInput = document.getElementById('pf-cmd-search');
  
  // Close on background click
  cmdPalette.addEventListener('click', (e) => {
    if (e.target === cmdPalette) cmdPalette.style.display = 'none';
  });
  
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cmdPalette.style.display === 'flex') {
      cmdPalette.style.display = 'none';
    }
  });

  searchInput.addEventListener('input', (e) => {
    renderCommandPalette(e.target.value.toLowerCase());
  });
}

function openCommandPalette() {
  if (!cmdPalette) injectCommandPalette();
  cmdPalette.style.display = 'flex';
  const searchInput = document.getElementById('pf-cmd-search');
  searchInput.value = '';
  searchInput.focus();
  renderCommandPalette('');
}

function renderCommandPalette(query) {
  if (!cmdList) return;
  chrome.storage.local.get(['savedPrompts'], (res) => {
    const prompts = res.savedPrompts || [];
    // Convert legacy strings to objects implicitly for display if needed
    const normalized = prompts.map(p => typeof p === 'string' ? { content: p, folder: 'Uncategorized' } : p);
    
    const filtered = normalized.filter(p => p.content.toLowerCase().includes(query) || (p.folder && p.folder.toLowerCase().includes(query)));
    
    cmdList.innerHTML = '';
    if (filtered.length === 0) {
      cmdList.innerHTML = '<div class="pf-cmd-item" style="text-align:center;color:#999;">No prompts found.</div>';
      return;
    }
    
    filtered.slice(0, 15).forEach(p => {
      const item = document.createElement('div');
      item.className = 'pf-cmd-item';
      
      const title = p.content.substring(0, 40) + (p.content.length > 40 ? '...' : '');
      const folderBadge = p.folder && p.folder !== 'Uncategorized' ? `<span class="pf-cmd-item-folder">${p.folder}</span>` : '';
      
      item.innerHTML = `
        <div class="pf-cmd-item-title">${folderBadge}${title}</div>
        <div class="pf-cmd-item-content">${p.content.substring(0, 80).replace(/</g, '&lt;')}</div>
      `;
      
      item.addEventListener('click', () => {
        if (!activeInput) {
           alert("PromptFlow Pro: Please click inside a chat text box first!");
           return;
        }
        
        const regex = /\{\{([^}]+)\}\}/g;
        const matches = [...p.content.matchAll(regex)].map(m => m[1]);
        const uniqueVars = [...new Set(matches)];

        function injectText(textToInject) {
           if (activeInput.tagName === 'TEXTAREA' || activeInput.tagName === 'INPUT') {
             activeInput.value = textToInject;
           } else {
             activeInput.innerText = textToInject;
           }
           activeInput.dispatchEvent(new Event('input', { bubbles: true }));
           cmdPalette.style.display = 'none';
           try { chrome.runtime.sendMessage({ action: 'track_usage' }); } catch(e) {}
        }

        if (uniqueVars.length > 0) {
          cmdList.innerHTML = `<div style="padding:16px; color:white;">
            <h3 style="margin-top:0;margin-bottom:12px;font-size:14px;color:#a855f7;">Fill Variables</h3>
            <div id="pf-vars-container" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;"></div>
            <button id="pf-vars-submit" style="background:#3b82f6;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;width:100%;font-weight:bold;">Insert Prompt</button>
            <button id="pf-vars-cancel" style="background:transparent;color:#9ca3af;border:none;padding:8px;cursor:pointer;width:100%;margin-top:4px;">Cancel</button>
          </div>`;
          
          const container = document.getElementById('pf-vars-container');
          uniqueVars.forEach(v => {
            container.innerHTML += `
              <div style="display:flex; flex-direction:column;">
                <label style="font-size:11px;color:#d1d5db;margin-bottom:4px;">${v}</label>
                <input type="text" class="pf-var-input" data-var="${v}" style="padding:8px;border-radius:6px;border:1px solid #4b5563;background:#374151;color:white;font-family:inherit;" />
              </div>
            `;
          });
          
          const firstInput = document.querySelector('.pf-var-input');
          if(firstInput) firstInput.focus();

          document.getElementById('pf-vars-cancel').addEventListener('click', () => {
            renderCommandPalette(document.getElementById('pf-cmd-search').value.toLowerCase());
          });

          document.getElementById('pf-vars-submit').addEventListener('click', () => {
            let finalPrompt = p.content;
            document.querySelectorAll('.pf-var-input').forEach(inp => {
              const varName = inp.getAttribute('data-var');
              const val = inp.value || `{{${varName}}}`;
              finalPrompt = finalPrompt.split(`{{${varName}}}`).join(val);
            });
            injectText(finalPrompt);
          });
          return;
        }

        injectText(p.content);
      });
      
      cmdList.appendChild(item);
    });
  });
}

// Export Chat Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'export_chat') {
    let markdown = "# PromptFlow Chat Export\\n\\n";
    
    // Universal "best effort" scrape for common AI chat structures
    // Tries to look for common article/prose elements or specific ChatGPT classes
    const blocks = document.querySelectorAll('article, .prose, [data-message-author-role]');
    
    if (blocks.length === 0) {
      // Fallback: Just grab the whole body text if no specific blocks found
      markdown += document.body.innerText;
    } else {
      blocks.forEach((block, i) => {
        let role = "Message";
        if (block.hasAttribute('data-message-author-role')) {
           role = block.getAttribute('data-message-author-role') === 'user' ? 'User' : 'AI';
        } else if (i % 2 === 0) {
           role = "User";
        } else {
           role = "AI";
        }
        
        markdown += `### ${role}\\n${block.innerText}\\n\\n---\\n\\n`;
      });
    }
    
    sendResponse({ success: true, markdown: markdown });
  }
});

initialize();
