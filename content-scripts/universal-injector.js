// Detect AI Platform and inject toolbar
console.log("PromptFlow Pro: Universal Injector active");

function initialize() {
  if (window.PromptFlowToolbar) {
    window.PromptFlowToolbar.inject();
  }
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
    
    inlineBtn.innerHTML = '⏳ Enhancing...';
    chrome.runtime.sendMessage({ action: 'ai_enhance', text: text }, (response) => {
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
    });
  });

  const saveBtn = document.createElement('button');
  saveBtn.id = 'pf-universal-save-btn';
  saveBtn.className = 'pf-inline-enhance-btn';
  saveBtn.innerHTML = '💾 Save';
  saveBtn.title = 'Save to Vault';
  saveBtn.type = 'button';
  
  // Style override for secondary save button
  saveBtn.style.background = 'rgba(255,255,255,0.1)';
  saveBtn.style.color = 'white';

  saveBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!activeInput) return;
    const text = activeInput.value || activeInput.innerText;
    if (!text.trim()) { alert("PromptFlow Pro: Please type a prompt to save."); return; }
    
    saveBtn.innerHTML = '✅ Saved';
    chrome.runtime.sendMessage({ action: 'save_prompt', text: text }, () => {
      setTimeout(() => saveBtn.innerHTML = '💾 Save', 2000);
    });
  });

  btnContainer.appendChild(saveBtn);
  btnContainer.appendChild(inlineBtn);
  document.body.appendChild(btnContainer);
}

function updateButtonPosition() {
  if (!btnContainer || !activeInput) return;
  const rect = activeInput.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.bottom > window.innerHeight) {
    btnContainer.style.display = 'none';
    return;
  }
  btnContainer.style.display = 'flex';
  btnContainer.style.top = (rect.bottom - 46) + 'px';
  btnContainer.style.left = (rect.right - 190) + 'px'; // Adjust for two buttons
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
      if (rect.width > 200 && rect.height > 20 && area > maxArea) {
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    if (btnContainer && btnContainer.style.display !== 'none') {
      const btn = document.getElementById('pf-universal-inline-btn');
      if (btn) btn.click();
    }
  }
});

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
