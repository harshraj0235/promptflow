chrome.runtime.onInstalled.addListener(() => {
  console.log('PromptFlow Pro Installed');
  // Set up side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);

  // Initialize default prompts if empty
  chrome.storage.local.get(['prompts'], (res) => {
    if (!res.prompts || res.prompts.length === 0) {
      const defaultPrompts = [
        {
          id: '1',
          title: 'Code Refactor',
          content: 'Please refactor the following code to improve readability, performance, and follow modern best practices. Explain the changes you made:\n\n```{{language}}\n{{code}}\n```',
          tags: ['coding', 'refactor'],
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Professional Email',
          content: 'Write a professional and polite email to {{recipient}} regarding {{topic}}. Keep it concise and action-oriented.',
          tags: ['writing', 'email'],
          createdAt: new Date().toISOString()
        }
      ];
      chrome.storage.local.set({ prompts: defaultPrompts });
    }
  });

  // Create context menus
  chrome.contextMenus.create({
    id: "save-to-promptflow",
    title: "Save to PromptFlow",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "enhance-with-promptflow",
    title: "Enhance Prompt",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-promptflow") {
    // Save selection as prompt
    chrome.storage.local.get(['prompts'], (res) => {
      const prompts = res.prompts || [];
      prompts.push({
        id: Date.now().toString(),
        title: 'Saved from ' + (tab ? tab.title : 'Web'),
        content: info.selectionText,
        tags: ['saved'],
        createdAt: new Date().toISOString()
      });
      chrome.storage.local.set({ prompts });
    });
  } else if (info.menuItemId === "enhance-with-promptflow") {
    console.log("Enhance:", info.selectionText);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ai_enhance') {
    const masterPrompt = `You are a world-class AI Prompt Engineer specialized in transforming rough human ideas into highly detailed, cinematic, AI-optimized prompts.
Your task is to take the user's rough idea and convert it into an ultra-detailed professional AI prompt.

User's rough idea:
"${request.text}"

Always output exactly in this format:

[Enhanced Cinematic Prompt goes here...]

Negative Prompt: [Negative Prompt]
AI Optimization Notes: [Notes]
Viral Hook: [Hook]
Cinematic Style Tags: [Tags]`;

    fetch('https://text.pollinations.ai/' + encodeURIComponent(masterPrompt))
      .then(res => res.text())
      .then(enhancedText => {
        sendResponse({ success: true, text: enhancedText });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      
    return true; // Keep channel open for async response
  }
});
