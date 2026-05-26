document.addEventListener('DOMContentLoaded', () => {
  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;
  
  // Load theme from storage
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'light') {
      body.setAttribute('data-theme', 'light');
    }
  });

  themeToggle.addEventListener('click', () => {
    const isLight = body.getAttribute('data-theme') === 'light';
    if (isLight) {
      body.removeAttribute('data-theme');
      chrome.storage.local.set({ theme: 'dark' });
    } else {
      body.setAttribute('data-theme', 'light');
      chrome.storage.local.set({ theme: 'light' });
    }
  });

  // Tab Navigation
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active to clicked
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      target.classList.add('active');
      
      // Handle specific tab logic
      if (tab.dataset.target === 'vault') {
        loadPrompts();
      }
    });
  });

  // Modal logic
  const modal = document.getElementById('prompt-modal');
  const newPromptBtn = document.getElementById('new-prompt-btn');
  const createFirstBtn = document.getElementById('create-first-btn');
  const closeBtns = document.querySelectorAll('.close-modal, .cancel-modal');
  const saveBtn = document.getElementById('save-prompt-btn');

  function openModal() {
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    // Clear inputs
    document.getElementById('prompt-title').value = '';
    document.getElementById('prompt-content').value = '';
    document.getElementById('prompt-tags').value = '';
  }

  newPromptBtn.addEventListener('click', openModal);
  if(createFirstBtn) createFirstBtn.addEventListener('click', openModal);
  
  closeBtns.forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  saveBtn.addEventListener('click', () => {
    const title = document.getElementById('prompt-title').value;
    const content = document.getElementById('prompt-content').value;
    const tags = document.getElementById('prompt-tags').value.split(',').map(t => t.trim());
    
    if (!title || !content) {
      alert('Please fill out title and content');
      return;
    }
    
    // Save via background or storage
    chrome.storage.local.get(['prompts'], (res) => {
      const prompts = res.prompts || [];
      prompts.push({
        id: Date.now().toString(),
        title,
        content,
        tags,
        createdAt: new Date().toISOString()
      });
      chrome.storage.local.set({ prompts }, () => {
        closeModal();
        loadPrompts();
      });
    });
  });

  // Enhance tab logic
  const enhanceBtn = document.getElementById('enhance-btn');
  const enhanceResult = document.getElementById('enhance-result');
  const enhanceInput = document.getElementById('enhance-input');
  const enhanceOutput = document.getElementById('enhance-output');

  enhanceBtn.addEventListener('click', () => {
    const input = enhanceInput.value;
    if (!input) return;
    
    const mode = document.querySelector('input[name="enhance-mode"]:checked').value;
    
    // Simple mock logic for demonstration
    enhanceBtn.textContent = 'Enhancing...';
    
    setTimeout(() => {
      let output = input;
      if (mode === 'clarify') {
        output = `Please provide a clear and specific response to the following request: ${input}`;
      } else if (mode === 'structured') {
        output = `Act as an expert.\nContext: You are providing professional assistance.\nTask: ${input}\nFormat: Return the output in a structured markdown format.`;
      } else if (mode === 'chain-of-thought') {
        output = `Let's think step by step about the following problem:\n${input}\nPlease provide your reasoning process before your final answer.`;
      } else {
        output = `As a highly skilled professional, please address the following matter with a formal tone:\n${input}`;
      }
      
      enhanceOutput.value = output;
      enhanceResult.classList.remove('hidden');
      enhanceBtn.textContent = '✨ Enhance Prompt';
    }, 800);
  });

  // Load prompts
  function loadPrompts() {
    const promptList = document.getElementById('prompt-list');
    
    chrome.storage.local.get(['prompts'], (res) => {
      const prompts = res.prompts || [];
      if (prompts.length === 0) {
        promptList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🗂️</div>
            <p>Your vault is empty</p>
            <button class="primary-btn" id="create-first-btn-2">Create Prompt</button>
          </div>
        `;
        document.getElementById('create-first-btn-2')?.addEventListener('click', openModal);
        return;
      }
      
      promptList.innerHTML = prompts.map(p => `
        <div class="prompt-card">
          <h4>${p.title}</h4>
          <p>${p.content}</p>
          <div class="card-actions">
            <button title="Copy" onclick="navigator.clipboard.writeText('${p.content.replace(/'/g, "\\'")}')">📋</button>
          </div>
        </div>
      `).join('');
    });
  }

  // Initial load
  loadPrompts();
});
