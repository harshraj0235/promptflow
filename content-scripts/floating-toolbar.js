class FloatingToolbar {
  constructor() {
    this.container = null;
  }

  inject() {
    if (document.getElementById('promptflow-toolbar')) return;

    this.container = document.createElement('div');
    this.container.id = 'promptflow-toolbar';
    this.container.className = 'promptflow-toolbar';
    
    this.container.innerHTML = `
      <div class="pf-logo">⚡ PF</div>
      <button class="pf-btn primary" title="Insert Prompt (Ctrl+Shift+P)">📋</button>
      <button class="pf-btn" title="Enhance Text">✨</button>
      <button class="pf-btn" title="Quick Save">💾</button>
    `;

    document.body.appendChild(this.container);

    // Event listeners
    const buttons = this.container.querySelectorAll('.pf-btn');
    
    // Insert Prompt
    buttons[0].addEventListener('click', () => {
      // In a real scenario, this opens the command palette overlay
      alert("PromptFlow Pro: Command Palette would open here to let you select a prompt to insert.");
    });

    // Enhance Text
    buttons[1].addEventListener('click', () => {
      let activeInput = document.activeElement;
      if (!activeInput || (activeInput.tagName !== 'TEXTAREA' && activeInput.tagName !== 'INPUT' && !activeInput.isContentEditable)) {
         const inputs = document.querySelectorAll('textarea, [contenteditable="true"]');
         let maxArea = 0;
         inputs.forEach(input => {
            const rect = input.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (area > maxArea) {
               maxArea = area;
               activeInput = input;
            }
         });
      }

      if (!activeInput) {
        alert("PromptFlow Pro: Could not find an input field.");
        return;
      }

      const text = activeInput.value || activeInput.innerText;
      if (!text.trim()) {
        alert("PromptFlow Pro: Please type a prompt first to enhance it.");
        return;
      }
      
      const originalIcon = buttons[1].innerHTML;
      buttons[1].innerHTML = '⏳';
      
      chrome.runtime.sendMessage({ action: 'ai_enhance', text: text }, (response) => {
        buttons[1].innerHTML = originalIcon;
        
        if (chrome.runtime.lastError || !response || !response.success) {
           console.error("Enhancement failed:", chrome.runtime.lastError || response?.error);
           alert("PromptFlow Pro: Failed to reach AI enhancer. Please check console.");
           return;
        }
        
        const enhanced = response.text;
        
        if (activeInput.tagName === 'TEXTAREA' || activeInput.tagName === 'INPUT') {
          activeInput.value = enhanced;
        } else {
          activeInput.innerText = enhanced;
        }
        
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        const tracker = activeInput._valueTracker;
        if (tracker) tracker.setValue('');
      });
    });

    // Quick Save
    buttons[2].addEventListener('click', () => {
      alert("PromptFlow Pro: Current input saved to Vault!");
    });
  }

  remove() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

window.PromptFlowToolbar = new FloatingToolbar();
