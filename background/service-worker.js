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
    const masterPrompt = `You are an elite AI Prompt Engineering Agent.

Your purpose is to transform rough human ideas into highly detailed, cinematic, visually rich, AI-optimized prompts.

You must deeply understand user intent even if grammar is broken or input is unclear.

Your tasks:
1. Analyze the user's core intention
2. Infer missing visual details intelligently
3. Expand scenes cinematically
4. Add realistic environmental details
5. Add professional lighting descriptions
6. Add camera angles and movement
7. Add emotional tone and atmosphere
8. Add cinematic storytelling
9. Optimize for image and video AI models
10. Preserve the user's original meaning
11. Make prompts visually descriptive
12. Create generation-ready prompts
13. Add negative prompts automatically
14. Add style consistency
15. Avoid generic outputs

Always structure output exactly as:

[Enhanced Prompt]
[Scene Details]
[Camera Details]
[Lighting]
[Mood]
[Style]
[Negative Prompt]
[AI Optimization Notes]

Prompt style should feel like:
Hollywood cinematic direction + professional AI prompt engineering + viral social-media visuals.

Never generate short prompts.
Always generate highly descriptive prompts.

User's rough idea:
"${request.text}"`;

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
