let enhanceCache = new Map();

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
    chrome.storage.local.get(['savedPrompts'], (res) => {
      const prompts = res.savedPrompts || [];
      prompts.unshift({
        id: Date.now().toString(),
        content: info.selectionText,
        folder: 'Clippings',
        rating: 0,
        usageCount: 0,
        createdAt: new Date().toISOString()
      });
      chrome.storage.local.set({ savedPrompts: prompts });
    });
  } else if (info.menuItemId === "enhance-with-promptflow") {
    console.log("Enhance:", info.selectionText);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save_prompt') {
    chrome.storage.local.get(['savedPrompts'], (res) => {
      const prompts = res.savedPrompts || [];
      
      // MIGRATION: convert old string prompts to v2 structured objects
      const migrated = prompts.map(p => typeof p === 'string' ? {
        id: Date.now() + Math.random().toString(),
        content: p,
        folder: 'Uncategorized',
        rating: 0,
        usageCount: 0,
        createdAt: new Date().toISOString()
      } : p);

      const exists = migrated.find(p => p.content === request.text);
      if (!exists) {
        migrated.unshift({
          id: Date.now().toString(),
          content: request.text,
          folder: request.folder || 'Uncategorized',
          rating: 0,
          usageCount: 0,
          createdAt: new Date().toISOString()
        });
        chrome.storage.local.set({ savedPrompts: migrated }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: true }); // Already saved
      }
    });
    return true;
  }

  // Analytics Tracker
  if (request.action === 'track_usage') {
    chrome.storage.local.get(['analytics'], (res) => {
      const analytics = res.analytics || { promptsUsedToday: 0, timeSavedSeconds: 0, lastDate: new Date().toDateString() };
      const today = new Date().toDateString();
      if (analytics.lastDate !== today) {
         analytics.promptsUsedToday = 0;
         analytics.timeSavedSeconds = 0;
         analytics.lastDate = today;
      }
      analytics.promptsUsedToday += 1;
      analytics.timeSavedSeconds += 180; // Estimate 3 mins saved per use
      chrome.storage.local.set({ analytics }, () => sendResponse({ success: true }));
    });
    return true;
  }
  
  if (request.action === 'ai_enhance') {
    if (enhanceCache.has(request.text)) {
      sendResponse({ success: true, text: enhanceCache.get(request.text) });
      return true;
    }

    const masterPrompt = `Rewrite the user's prompt into a highly detailed, optimized, professional prompt. Add an expert persona, remove ambiguity, and add structure.
CRITICAL RULES: Return ONLY the raw enhanced prompt text. NO markdown formatting. NO headers. NO conversational filler.`;

    const seed = Math.floor(Math.random() * 1000000);
    
    // Use mistral model for guaranteed sub-3-second generation speeds
    const payload = {
      model: "mistral", 
      messages: [
        { role: "system", content: masterPrompt },
        { role: "user", content: request.text }
      ],
      seed: seed,
      temperature: 0.3
    };

    // Robust exponential backoff retry mechanism for million-user scale
    async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url, options);
          if (res.ok || res.status < 500) return res; // Return success or non-retryable errors immediately
          if (i === retries - 1) return res;
        } catch (err) {
          if (i === retries - 1) throw err;
        }
        // Wait before retrying: 1s, then 2s, then 4s
        await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
      }
    }

    fetchWithRetry('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 3)
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
        const data = await res.json();
        return data.choices[0].message.content;
      })
      .then(enhancedText => {
        // Strip any residual headers and strip markdown bold asterisks just in case
        let cleanedText = enhancedText
          .replace(/^\s*\**\[?Enhanced Prompt\]?\**\s*/i, '')
          .replace(/^\s*\**Enhanced Prompt:?\**\s*/i, '')
          .replace(/\*/g, ''); // Aggressively strip ALL * and ** markdown syntax
          
        enhanceCache.set(request.text, cleanedText.trim());
        sendResponse({ success: true, text: cleanedText.trim() });
      })
      .catch(err => {
        console.error("PromptFlow API Error:", err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }
});
