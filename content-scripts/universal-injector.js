// Detect AI Platform and inject toolbar
console.log("PromptFlow Pro: Universal Injector active");

function initialize() {
  if (window.PromptFlowToolbar) {
    window.PromptFlowToolbar.inject();
  }
}

let activeInput = null;

function createInlineUI() {
  if (document.getElementById('pf-universal-ui-container')) return;

  const container = document.createElement('div');
  container.id = 'pf-universal-ui-container';
  container.className = 'pf-universal-ui-container';
  
  const topToolbar = document.createElement('div');
  topToolbar.className = 'pf-top-toolbar';
  topToolbar.innerHTML = `
    <button class="pf-tool-btn" id="pf-btn-saved">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      <span>Saved Prompts</span>
    </button>
    <button class="pf-tool-btn" id="pf-btn-craft">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><path d="M3.27 6.96L12 12.01l8.73-5.05"></path><path d="M12 22.08V12"></path></svg>
      <span>Craft</span>
    </button>
    <button class="pf-tool-btn" id="pf-btn-export">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
      <span>Export Chat</span>
    </button>
    <button class="pf-tool-btn" id="pf-btn-features">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
      <span>Features</span>
    </button>
  `;

  const inlineIcons = document.createElement('div');
  inlineIcons.className = 'pf-inline-icons';
  inlineIcons.innerHTML = `
    <div class="pf-icon-btn pf-logo-btn" title="Craft with PromptFlow" id="pf-icon-p">P</div>
    <div class="pf-icon-btn" title="Export Chat" id="pf-icon-export">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
    </div>
    <div class="pf-icon-btn" title="Save Prompt" id="pf-icon-bookmark">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
    </div>
  `;

  container.appendChild(topToolbar);
  container.appendChild(inlineIcons);
  document.body.appendChild(container);
  
  const craftBtn = container.querySelector('#pf-btn-craft');
  const pIcon = container.querySelector('#pf-icon-p');
  
  const handleEnhance = (btn, originalHtml) => {
    if (!activeInput) return;
    const text = activeInput.value || activeInput.innerText;
    if (!text.trim()) {
      alert("PromptFlow Pro: Please type a prompt first.");
      return;
    }
    btn.innerHTML = '⏳';
    chrome.runtime.sendMessage({ action: 'ai_enhance', text: text }, (response) => {
      btn.innerHTML = originalHtml;
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
  };

  craftBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    handleEnhance(craftBtn, craftBtn.innerHTML);
  });
  
  pIcon.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    handleEnhance(pIcon, pIcon.innerHTML);
  });

  // Basic alerts for other buttons
  container.querySelector('#pf-btn-saved').addEventListener('click', (e) => { e.preventDefault(); alert("Saved Prompts Vault opened!"); });
  container.querySelector('#pf-btn-export').addEventListener('click', (e) => { e.preventDefault(); alert("Exporting Chat!"); });
  container.querySelector('#pf-btn-features').addEventListener('click', (e) => { e.preventDefault(); alert("Features menu!"); });
  container.querySelector('#pf-icon-export').addEventListener('click', (e) => { e.preventDefault(); alert("Exporting Chat!"); });
  container.querySelector('#pf-icon-bookmark').addEventListener('click', (e) => { e.preventDefault(); alert("Prompt saved to Vault!"); });
  
  window.pfUiContainer = container;
  window.pfTopToolbar = topToolbar;
  window.pfInlineIcons = inlineIcons;
}

function updateUIPosition() {
  if (!window.pfUiContainer || !activeInput) return;
  const rect = activeInput.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.bottom > window.innerHeight) {
    window.pfUiContainer.style.display = 'none';
    return;
  }
  window.pfUiContainer.style.display = 'block';
  
  // Position top toolbar ABOVE the input
  window.pfTopToolbar.style.position = 'fixed';
  window.pfTopToolbar.style.top = (rect.top - 70) + 'px';
  window.pfTopToolbar.style.left = rect.left + 'px';
  
  // Position inline icons INSIDE the input on the right
  window.pfInlineIcons.style.position = 'fixed';
  window.pfInlineIcons.style.top = (rect.bottom - 40) + 'px';
  window.pfInlineIcons.style.left = (rect.right - 140) + 'px'; // Adjust based on submit button
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
      createInlineUI();
      updateUIPosition();
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('scroll', updateUIPosition, true);
window.addEventListener('resize', updateUIPosition);
setInterval(updateUIPosition, 500);
initialize();
