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
    const masterPrompt = `You are an elite AI Meta-Prompt Engineer.

Your purpose is to transform rough human ideas into highly detailed, optimized, and context-rich prompts.

Analyze the user's input and determine if it is a Visual request (Image/Video/Cinematic) or a Text/Code request.

IF VISUAL REQUEST (Image/Video):
Expand the scene cinematically. Ensure you include: Subject, Environment, Camera, Lighting, Mood, Style, Quality, and a Negative Prompt.

IF TEXT/CODE/ANALYSIS REQUEST:
1. Role: Assign a specific expert role (e.g., "You are a senior software engineer", "You are an expert copywriter").
2. Context: Fill in implied details and remove any vagueness. Replace ambiguous words with specific, actionable language.
3. Format: Add clear format instructions (e.g., output as JSON, use bullet points, format as a numbered list).
4. Sequence: Break down complex asks into clear sequential steps.

IMPORTANT OUTPUT RULES:
Return ONLY the raw prompt text (and negative prompt if visual).
DO NOT include any headers like "[Enhanced Prompt]", "**[Enhanced Prompt]**", or "Role:", "Context:".
CRITICAL: DO NOT use ANY Markdown formatting in your output. No asterisks (** or *). Output plain text only.
Just start directly with the perfectly crafted prompt text so the user can send it to the AI immediately.
Keep the output extremely concise and generate it as fast as possible.`;

    // Append a random seed to prevent caching collisions and handle rate limit queues better
    const seed = Math.floor(Math.random() * 1000000);
    
    // Use POST endpoint with 'openai' model (maps to fast gpt-4o-mini) for production-scale speed
    const payload = {
      model: "openai", 
      messages: [
        { role: "system", content: masterPrompt },
        { role: "user", content: request.text }
      ],
      seed: seed,
      temperature: 0.5
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
          .replace(/\*\*/g, ''); // Strip all ** markdown syntax
          
          
        sendResponse({ success: true, text: cleanedText.trim() });
      })
      .catch(err => {
        console.error("PromptFlow API Error:", err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }
});
