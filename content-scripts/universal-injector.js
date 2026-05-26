// Detect AI Platform and inject toolbar
console.log("PromptFlow Pro: Universal Injector active");

function initialize() {
  if (window.PromptFlowToolbar) {
    window.PromptFlowToolbar.inject();
  }
}

// Simple MutationObserver to detect when the UI is fully loaded
const observer = new MutationObserver((mutations) => {
  // If we found a textarea or contenteditable, we can assume the chat interface is loaded
  const hasInput = document.querySelector('textarea, [contenteditable="true"]');
  if (hasInput) {
    initialize();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Attempt immediate init
initialize();
