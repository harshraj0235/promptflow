// Detect AI Platform and inject toolbar
console.log("PromptFlow Pro: Universal Injector active");

function initialize() {
  if (window.PromptFlowToolbar) {
    window.PromptFlowToolbar.inject();
  }
}

function injectInlineButton(inputElement) {
  if (inputElement.dataset.pfInjected) return;
  inputElement.dataset.pfInjected = "true";

  // Try to find the closest wrapper
  const wrapper = inputElement.parentElement;
  if (!wrapper) return;
  
  const enhanceBtn = document.createElement('button');
  enhanceBtn.className = 'pf-inline-enhance-btn';
  enhanceBtn.innerHTML = '✨ Enhance';
  enhanceBtn.title = 'Enhance Prompt with AI';
  enhanceBtn.type = 'button';
  
  enhanceBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get text
    const text = inputElement.value || inputElement.innerText;
    if (!text.trim()) {
      alert("PromptFlow Pro: Please type a prompt first to enhance it.");
      return;
    }
    
    // Simulate enhancement
    const originalText = enhanceBtn.innerHTML;
    enhanceBtn.innerHTML = '⏳...';
    
    setTimeout(() => {
      const enhanced = `Act as an expert in this domain. Task: ${text}\nPlease provide a detailed, well-structured response.`;
      
      // Update input
      if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
        inputElement.value = enhanced;
      } else {
        inputElement.innerText = enhanced;
      }
      
      // Dispatch events for React/Angular/Vue etc
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      enhanceBtn.innerHTML = originalText;
    }, 800);
  });
  
  // Injecting it inside the wrapper and absolute positioning it
  wrapper.style.position = wrapper.style.position === 'static' || !wrapper.style.position ? 'relative' : wrapper.style.position;
  wrapper.appendChild(enhanceBtn);
}

// Simple MutationObserver to detect when the UI is fully loaded
const observer = new MutationObserver((mutations) => {
  // Found a textarea or contenteditable, assume the chat interface is loaded
  const inputs = document.querySelectorAll('textarea, [contenteditable="true"]');
  if (inputs.length > 0) {
    initialize();
    
    inputs.forEach(input => {
      // Exclude very small inputs or hidden ones (like search bars vs chat input)
      const rect = input.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 20) {
        injectInlineButton(input);
      }
    });
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Attempt immediate init
initialize();
