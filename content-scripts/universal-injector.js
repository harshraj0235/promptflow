// ═══════════════════════════════════════════════════════════════
// PromptFlow Pro v3.0 — Universal Content Script
// Injects floating toolbar + command palette on all AI platforms
// ═══════════════════════════════════════════════════════════════

console.log("PromptFlow Pro v3.0: Injector active");

let activeInput = null;
let btnContainer = null;
let inlineBtn = null;

// ═══════════════════════════════════════════
// FLOATING TOOLBAR — Glass pill with Save + Enhance
// ═══════════════════════════════════════════

function createInlineButton() {
  if (document.getElementById('pf-inline-btn-container')) return;

  btnContainer = document.createElement('div');
  btnContainer.id = 'pf-inline-btn-container';
  btnContainer.style.display = 'none';

  // Save Button
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
    if (!text.trim()) { showToast('Please type a prompt first', 'warn'); return; }

    saveBtn.innerHTML = '✅ Saved!';
    saveBtn.style.color = '#10b981';
    try {
      chrome.runtime.sendMessage({ action: 'save_prompt', text: text }, () => {
        setTimeout(() => { saveBtn.innerHTML = '💾 Save'; saveBtn.style.color = ''; }, 2000);
      });
    } catch (err) {
      saveBtn.innerHTML = '💾 Save'; saveBtn.style.color = '';
      handleExtensionError(err);
    }
  });

  // Tone/Goal Selector
  const toneSelect = document.createElement('select');
  toneSelect.id = 'pf-universal-tone-select';
  toneSelect.className = 'pf-inline-tone-select';
  toneSelect.innerHTML = `
    <option value="auto">🎯 Auto-Detect Goal</option>
    <option value="coding">💻 Coding / Developer</option>
    <option value="creative">✍️ Creative Writing</option>
    <option value="image">🎨 Image / Midjourney</option>
    <option value="professional">👔 Professional Business</option>
  `;

  // Enhance Button
  inlineBtn = document.createElement('button');
  inlineBtn.id = 'pf-universal-inline-btn';
  inlineBtn.className = 'pf-inline-enhance-btn';
  inlineBtn.innerHTML = '✨ AI Enhance';
  inlineBtn.title = 'Enhance Prompt (Ctrl+M)';
  inlineBtn.type = 'button';

  inlineBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const selectedTone = toneSelect.value;
    triggerEnhance(selectedTone);
  });

  btnContainer.appendChild(saveBtn);
  btnContainer.appendChild(toneSelect);
  btnContainer.appendChild(inlineBtn);
  document.body.appendChild(btnContainer);
}

// ═══════════════════════════════════════════
// ENHANCE PIPELINE — Animated stages
// ═══════════════════════════════════════════

const PIPELINE_STAGES = [
  { icon: '🔍', label: 'Detecting Intent...' },
  { icon: '⚙️', label: 'Engineering Prompt...' },
  { icon: '✨', label: 'Finalizing...' },
];

function triggerEnhance(tone = 'auto') {
  if (!activeInput || !inlineBtn) return;
  if (inlineBtn.classList.contains('pf-loading')) return; // Prevent double-click

  const text = activeInput.value || activeInput.innerText;
  if (!text.trim()) { showToast('Type a prompt first to enhance it', 'warn'); return; }

  // Start loading animation
  inlineBtn.classList.add('pf-loading');
  let currentStage = 0;
  updateStageUI(PIPELINE_STAGES[0]);

  const stageInterval = setInterval(() => {
    currentStage++;
    if (currentStage < PIPELINE_STAGES.length) {
      updateStageUI(PIPELINE_STAGES[currentStage]);
    }
  }, 800);

  // Send to background
  try {
    chrome.runtime.sendMessage({ action: 'ai_enhance', text: text, tone: tone }, (response) => {
      clearInterval(stageInterval);

      if (chrome.runtime.lastError || !response) {
        showError('Connection lost. Please refresh the page.');
        return;
      }

      if (response && response.error === 'QUEUE_FULL') {
        showError('Pollinations AI traffic is too high. Please wait 10 seconds.');
        return;
      }

      if (!response.success) {
        showError('Enhancement failed. Please try again later.');
        return;
      }

      // SUCCESS — Inject enhanced prompt
      if (activeInput.tagName === 'TEXTAREA' || activeInput.tagName === 'INPUT') {
        activeInput.value = response.text;
      } else {
        activeInput.innerText = response.text;
      }

      // Trigger React/framework change detection
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      const tracker = activeInput._valueTracker;
      if (tracker) tracker.setValue('');

      // Success state
      showSuccess(response.provider, response.time);

      // Track usage
      try { chrome.runtime.sendMessage({ action: 'track_usage' }); } catch(e) {}
    });
  } catch (err) {
    clearInterval(stageInterval);
    handleExtensionError(err);
  }
}

function updateStageUI(stage) {
  if (!inlineBtn) return;
  inlineBtn.innerHTML = `<span class="pf-loading-text"><span class="pf-spinner"></span> ${stage.label}</span>`;
}

function showSuccess(provider, timeMs) {
  if (!inlineBtn) return;
  inlineBtn.classList.remove('pf-loading');
  inlineBtn.classList.add('pf-success');
  const timeStr = timeMs ? `${(timeMs / 1000).toFixed(1)}s` : 'instant';
  inlineBtn.innerHTML = `✅ Enhanced!`;

  // Show provider badge
  showProviderBadge(provider, timeMs);

  setTimeout(() => {
    inlineBtn.classList.remove('pf-success');
    inlineBtn.innerHTML = '✨ AI Enhance';
  }, 2500);
}

function showError(msg) {
  if (!inlineBtn) return;
  inlineBtn.classList.remove('pf-loading');
  inlineBtn.classList.add('pf-error');
  inlineBtn.innerHTML = '❌ Failed';

  setTimeout(() => {
    inlineBtn.classList.remove('pf-error');
    inlineBtn.innerHTML = '✨ AI Enhance';
  }, 3000);

  showToast(msg, 'error');
}

function handleExtensionError(err) {
  if (err.message && err.message.includes('Extension context invalidated')) {
    showToast('PromptFlow updated! Please refresh this page.', 'warn');
  } else {
    console.error('PromptFlow:', err);
    showError('Something went wrong');
  }
}

// ═══════════════════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════════════════

function showToast(message, type = 'info') {
  const existing = document.getElementById('pf-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pf-toast';
  const colors = { info: '#6C5CE7', warn: '#f59e0b', error: '#ef4444', success: '#10b981' };
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: ${colors[type] || colors.info}; color: white;
    padding: 10px 20px; border-radius: 10px; font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 13px; font-weight: 500; z-index: 2147483647;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3); opacity: 0;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════
// PROVIDER BADGE — Shows which AI responded
// ═══════════════════════════════════════════

function showProviderBadge(provider, timeMs) {
  const existing = document.getElementById('pf-provider-badge');
  if (existing) existing.remove();

  const badge = document.createElement('div');
  badge.id = 'pf-provider-badge';
  badge.className = 'pf-provider-badge';
  const timeStr = timeMs ? `${(timeMs / 1000).toFixed(1)}s` : '⚡ instant';
  badge.innerHTML = `
    <span class="pf-badge-dot"></span>
    <span>Enhanced via <strong>${provider || 'AI'}</strong></span>
    <span class="pf-badge-time">${timeStr}</span>
  `;
  document.body.appendChild(badge);

  setTimeout(() => {
    badge.style.opacity = '0';
    badge.style.transform = 'translateY(10px)';
    badge.style.transition = 'all 0.3s ease';
    setTimeout(() => badge.remove(), 300);
  }, 4000);
}

// ═══════════════════════════════════════════
// POSITIONING — Smart placement near input
// ═══════════════════════════════════════════

function updateButtonPosition() {
  if (!btnContainer || !activeInput) return;
  const rect = activeInput.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0 || rect.top > window.innerHeight + 50 || rect.bottom < -50) {
    btnContainer.style.display = 'none';
    return;
  }

  btnContainer.style.display = 'flex';

  // Position overlapping the top-right corner of the input
  const btnWidth = 230;
  let left = rect.right - btnWidth - 8;
  let top = rect.top - 20;

  // Keep within viewport
  if (left < 8) left = 8;
  if (left + btnWidth > window.innerWidth - 8) left = window.innerWidth - btnWidth - 8;
  if (top < 4) top = rect.bottom + 4;

  btnContainer.style.top = top + 'px';
  btnContainer.style.left = left + 'px';
}

// ═══════════════════════════════════════════
// INPUT DETECTION — Find the main chat input
// ═══════════════════════════════════════════

const observer = new MutationObserver(() => {
  const inputs = document.querySelectorAll('textarea, [contenteditable="true"]');
  if (inputs.length > 0) {
    injectCommandPalette();
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
setInterval(updateButtonPosition, 600);

// ═══════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  // Ctrl+M — Enhance
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    triggerEnhance();
  }

  // Ctrl+Shift+P — Command Palette
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    e.stopPropagation();
    openCommandPalette();
  }
});

// ═══════════════════════════════════════════
// COMMAND PALETTE — Spotlight-style prompt vault
// ═══════════════════════════════════════════

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

  cmdPalette.addEventListener('click', (e) => {
    if (e.target === cmdPalette) cmdPalette.style.display = 'none';
  });

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
    const normalized = prompts.map(p => typeof p === 'string' ? { content: p, folder: 'Uncategorized' } : p);

    const filtered = normalized.filter(p =>
      p.content.toLowerCase().includes(query) ||
      (p.folder && p.folder.toLowerCase().includes(query))
    );

    cmdList.innerHTML = '';
    if (filtered.length === 0) {
      cmdList.innerHTML = '<div class="pf-cmd-item" style="text-align:center;color:rgba(160,160,185,0.5);padding:24px;">No prompts found. Save some first!</div>';
      return;
    }

    filtered.slice(0, 15).forEach(p => {
      const item = document.createElement('div');
      item.className = 'pf-cmd-item';

      const title = p.content.substring(0, 45) + (p.content.length > 45 ? '...' : '');
      const folderBadge = p.folder && p.folder !== 'Uncategorized'
        ? `<span class="pf-cmd-item-folder">${p.folder}</span>` : '';

      item.innerHTML = `
        <div class="pf-cmd-item-title">${folderBadge}${title}</div>
        <div class="pf-cmd-item-content">${p.content.substring(0, 80).replace(/</g, '&lt;')}</div>
      `;

      item.addEventListener('click', () => {
        if (!activeInput) {
          showToast('Click inside a chat text box first!', 'warn');
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
            <button id="pf-vars-submit" style="background:linear-gradient(135deg,#a855f7,#7c3aed);color:white;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;width:100%;font-weight:600;font-family:inherit;">Insert Prompt</button>
            <button id="pf-vars-cancel" style="background:transparent;color:#9ca3af;border:none;padding:8px;cursor:pointer;width:100%;margin-top:4px;font-family:inherit;">Cancel</button>
          </div>`;

          const container = document.getElementById('pf-vars-container');
          uniqueVars.forEach(v => {
            container.innerHTML += `
              <div style="display:flex; flex-direction:column;">
                <label style="font-size:11px;color:#d1d5db;margin-bottom:4px;">${v}</label>
                <input type="text" class="pf-var-input" data-var="${v}" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(168,85,247,0.2);background:rgba(255,255,255,0.05);color:white;font-family:inherit;" />
              </div>
            `;
          });

          const firstInput = document.querySelector('.pf-var-input');
          if (firstInput) firstInput.focus();

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

// ═══════════════════════════════════════════
// EXPORT CHAT — Universal scraper
// ═══════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'export_chat') {
    let markdown = "# PromptFlow Chat Export\n\n";
    const blocks = document.querySelectorAll('article, .prose, [data-message-author-role]');

    if (blocks.length === 0) {
      markdown += document.body.innerText;
    } else {
      blocks.forEach((block, i) => {
        let role = "Message";
        if (block.hasAttribute('data-message-author-role')) {
          role = block.getAttribute('data-message-author-role') === 'user' ? 'User' : 'AI';
        } else {
          role = i % 2 === 0 ? "User" : "AI";
        }
        markdown += `### ${role}\n${block.innerText}\n\n---\n\n`;
      });
    }

    sendResponse({ success: true, markdown: markdown });
  }
});

// Initialize
injectCommandPalette();
