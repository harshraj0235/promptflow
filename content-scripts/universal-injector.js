// Detect AI Platform and inject toolbar
console.log("PromptFlow Pro: Universal Injector active");

function initialize() {
  if (window.PromptFlowToolbar) {
    window.PromptFlowToolbar.inject();
  }
}

// Keep track of the active input
let activeInput = null;
let inlineBtn = null;

function createInlineButton() {
  if (document.getElementById('pf-universal-inline-btn')) return;

  inlineBtn = document.createElement('button');
  inlineBtn.id = 'pf-universal-inline-btn';
  inlineBtn.className = 'pf-inline-enhance-btn';
  inlineBtn.innerHTML = '✨ Enhance';
  inlineBtn.title = 'Enhance Prompt with AI';
  inlineBtn.type = 'button';
  
  // Start hidden
  inlineBtn.style.display = 'none';
  
  inlineBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!activeInput) return;
    
    // Get text
    const text = activeInput.value || activeInput.innerText;
    if (!text.trim()) {
      alert("PromptFlow Pro: Please type a prompt first to enhance it.");
      return;
    }
    
    // Simulate enhancement
    const originalText = inlineBtn.innerHTML;
    inlineBtn.innerHTML = '⏳...';
    
    setTimeout(() => {
      const enhanced = `You are a world-class expert. Please perform the following task:

<task>
${text}
</task>

Before answering, please:
1. Think step-by-step and lay out your logical reasoning.
2. Consider any critical edge cases or important context.

Please provide a highly detailed, accurate, and logically structured response. Ensure the tone is professional, clear, and the formatting uses clean Markdown (bullet points, bold text, and code blocks where necessary).`;
      
      // Update input
      if (activeInput.tagName === 'TEXTAREA' || activeInput.tagName === 'INPUT') {
        activeInput.value = enhanced;
      } else {
        activeInput.innerText = enhanced;
      }
      
      // Dispatch events for React/Angular/Vue etc
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // React 16+ value setter override hack for ChatGPT
      const tracker = activeInput._valueTracker;
      if (tracker) tracker.setValue('');
      
      inlineBtn.innerHTML = originalText;
    }, 800);
  });
  
  // Attach directly to body so it escapes all overflow: hidden containers
  document.body.appendChild(inlineBtn);
}

function updateButtonPosition() {
  if (!inlineBtn || !activeInput) return;
  
  const rect = activeInput.getBoundingClientRect();
  
  // If input is not visible on screen, hide button
  if (rect.width === 0 || rect.height === 0 || rect.top < 0 || rect.bottom > window.innerHeight) {
    inlineBtn.style.display = 'none';
    return;
  }
  
  inlineBtn.style.display = 'flex';
  
  // Position it relative to the viewport, pinned to the top-right of the input field
  inlineBtn.style.position = 'fixed';
  inlineBtn.style.top = (rect.top - 40) + 'px'; // 40px above the input
  inlineBtn.style.left = (rect.right - 110) + 'px'; // align to right side
}

// Simple MutationObserver to detect when the UI is fully loaded
const observer = new MutationObserver((mutations) => {
  const inputs = document.querySelectorAll('textarea, [contenteditable="true"]');
  if (inputs.length > 0) {
    initialize();
    
    // Find the primary input (largest one usually)
    let bestInput = null;
    let maxArea = 0;
    
    inputs.forEach(input => {
      const rect = input.getBoundingClientRect();
      const area = rect.width * rect.height;
      // Chat inputs are typically wide
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

// Update position on scroll or resize
window.addEventListener('scroll', updateButtonPosition, true);
window.addEventListener('resize', updateButtonPosition);
// Also poll every 500ms just in case the UI dynamically resizes (like when typing multiple lines)
setInterval(updateButtonPosition, 500);

// Attempt immediate init
initialize();
