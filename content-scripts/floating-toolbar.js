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
      alert("PromptFlow Pro: Select text to enhance it.");
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
