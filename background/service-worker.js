chrome.runtime.onInstalled.addListener(() => {
  console.log('PromptFlow Pro Installed');
  // Set up side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

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
  if (request.action === 'save_prompt') {
    chrome.storage.local.get(['savedPrompts'], (res) => {
      const prompts = res.savedPrompts || [];
      if (!prompts.includes(request.text)) {
        prompts.unshift(request.text);
        chrome.storage.local.set({ savedPrompts: prompts }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: true }); // Already saved
      }
    });
    return true;
  }
  
  if (request.action === 'ai_enhance') {
    const systemPrompt = `You are an elite AI Meta-Prompt Engineer.

Your purpose is to transform rough human ideas into highly detailed, optimized, and context-rich prompts.

Analyze the user's input and determine if it is a Visual request (Image/Video/Cinematic) or a Text/Code request.

IF VISUAL REQUEST:
Expand cinematically. Include: Subject, Environment, Camera, Lighting, Mood, Style, Quality, Negative Prompt.

IF TEXT/CODE REQUEST:
1. Role: Assign a specific expert role.
2. Context: Fill in implied details, remove vagueness.
3. Format: Add clear format instructions.
4. Sequence: Break down complex asks into clear sequential steps.

IMPORTANT OUTPUT RULES:
Return ONLY the raw prompt text. DO NOT include headers. Just start directly with the perfectly crafted prompt text. Keep the output extremely concise and generate it as fast as possible.`;

    // Append a random seed to prevent caching collisions
    const seed = Math.floor(Math.random() * 1000000);
    
    // Use Mistral model and system parameter for lightning fast inference
    const url = `https://text.pollinations.ai/${encodeURIComponent(request.text)}?system=${encodeURIComponent(systemPrompt)}&seed=${seed}&model=mistral`;
    
    fetch(url)
      .then(async res => {
        if (!res.ok) {
           const errText = await res.text();
           let errMsg = errText;
           try {
             const json = JSON.parse(errText);
             if (json.error) errMsg = json.error;
           } catch(e) {}
           throw new Error(errMsg || `Server returned ${res.status}`);
        }
        return res.text();
      })
      .then(enhancedText => {
        // Strip any residual headers just in case
        let cleanedText = enhancedText
          .replace(/^\s*\**\[?Enhanced Prompt\]?\**\s*/i, '')
          .replace(/^\s*\**Enhanced Prompt:?\**\s*/i, '');
          
        sendResponse({ success: true, text: cleanedText.trim() });
      })
      .catch(err => {
        console.error("PromptFlow API Error:", err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }
});
