// ═══════════════════════════════════════════════════════════════
// PromptFlow Pro v3.0 — AI Prompt Operating System
// Multi-Provider | Intent Detection | Prompt Expansion Engine
// ═══════════════════════════════════════════════════════════════

const enhanceCache = new Map();

chrome.runtime.onInstalled.addListener(() => {
  console.log('PromptFlow Pro v3.0 — AI Prompt Operating System');
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

  chrome.storage.local.get(['prompts'], (res) => {
    if (!res.prompts || res.prompts.length === 0) {
      const defaultPrompts = [
        {
          id: '1', title: 'Code Refactor',
          content: 'Please refactor the following code to improve readability, performance, and follow modern best practices. Explain the changes you made:\n\n```{{language}}\n{{code}}\n```',
          tags: ['coding', 'refactor'], createdAt: new Date().toISOString()
        },
        {
          id: '2', title: 'Professional Email',
          content: 'Write a professional and polite email to {{recipient}} regarding {{topic}}. Keep it concise and action-oriented.',
          tags: ['writing', 'email'], createdAt: new Date().toISOString()
        }
      ];
      chrome.storage.local.set({ prompts: defaultPrompts });
    }
  });

  // Inject into all existing tabs immediately without needing refresh
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    for (const tab of tabs) {
      if (!tab.url.startsWith('chrome://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/universal-injector.js']
        }).catch(err => console.log('Injector skip:', err));

        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content-scripts/floating-toolbar.css']
        }).catch(err => console.log('CSS skip:', err));
      }
    }
  });

  chrome.contextMenus.create({ id: "save-to-promptflow", title: "Save to PromptFlow", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "enhance-with-promptflow", title: "Enhance Prompt", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-promptflow") {
    chrome.storage.local.get(['savedPrompts'], (res) => {
      const prompts = res.savedPrompts || [];
      prompts.unshift({
        id: Date.now().toString(), content: info.selectionText,
        folder: 'Clippings', rating: 0, usageCount: 0, createdAt: new Date().toISOString()
      });
      chrome.storage.local.set({ savedPrompts: prompts });
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// CRAFTED+ ENGINE — Single-Pass, Maximum Speed
// Merged Intent Detection + Engineering + Scoring into ONE call
// ═══════════════════════════════════════════════════════════════

const CRAFTED_SYSTEM = `You are an expert Prompt Engineer and AI Assistant. Your goal is to take the user's raw, vague input and transform it into a highly effective, structured prompt using "The Core Formula".

Writing better prompts is mostly about reducing ambiguity and giving the AI enough context to produce the result the user actually wants. A useful way to think about prompting is that you're writing a specification rather than asking a casual question.

### THE CORE FORMULA
You must output the final prompt strictly following this structure:

Role:
You are an expert in [domain].

Objective:
Help me achieve [goal].

Context:
[Relevant background and details.]

Task:
Complete the following:
1. ...
2. ...
3. ...

Requirements:
- Be accurate.
- Explain step by step.
- Use examples where helpful.
- Mention assumptions if information is missing.

Constraints:
- Tone: [formal/friendly/etc.]
- Length: [e.g., 800–1200 words]
- Avoid: [jargon, repetition, unsupported claims]

Output Format:
- [Describe the format, e.g., Executive summary, Main explanation, Examples]

### GOLDEN RULES
1. Analyze the user's input inside <thinking> tags first. Identify missing information (Role, Context, Constraints) and auto-fill them logically.
2. Formulate the final, highly structured prompt inside <final_prompt> tags.
3. The final prompt should use markdown or clear spacing. Do NOT wrap the final prompt in a markdown code block (\`\`\`) unless the user specifically asked for code.

### FEW-SHOT EXAMPLES (Internal Reasoning)
<example>
User Input: write about AI

<thinking>
1. Goal: Write a guide about AI. (The input is too weak).
2. Context: The user needs a beginner-friendly explanation.
3. Role: Tech Educator.
4. Task: Explain how AI works, step-by-step.
5. Constraints: Keep it under 500 words, simple English, no jargon.
6. Output Format: Markdown with headings and bullet points.
</thinking>
<final_prompt>
Role:
You are an expert Tech Educator.

Objective:
Help me understand artificial intelligence.

Context:
I am a beginner with no technical background. I need to understand the basics of AI, how it works, and its common applications.

Task:
Complete the following:
1. Explain what AI is in simple terms.
2. Describe how AI learns (briefly mention machine learning).
3. Provide 3 everyday examples of AI.

Requirements:
- Be accurate but accessible.
- Explain step by step.
- Use analogies where helpful.

Constraints:
- Tone: Friendly and educational.
- Length: Under 500 words.
- Avoid: Technical jargon and complex math.

Output Format:
- Title
- Introduction
- How it Works (Bullet points)
- Everyday Examples
- Summary
</final_prompt>
</example>`;

function buildSystemPrompt(tone, settings = {}) {
  let prompt = CRAFTED_SYSTEM;

  if (settings.persAudience || settings.persStyle || settings.persExamples) {
    prompt += `\n\n--- USER PROFILE ---`;
    if (settings.persAudience) prompt += `\nAUDIENCE: ${settings.persAudience}`;
    if (settings.persStyle) prompt += `\nSTYLE: ${settings.persStyle}`;
    if (settings.persExamples) prompt += `\nEXAMPLES:\n${settings.persExamples}`;
  }

  if (tone && tone !== 'auto') {
    prompt += `\n\nOPTIMIZE FOR TONE: ${tone.toUpperCase()}`;
  }
  
  return prompt;
}

// Sleep helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════════
// OPENROUTER API INTEGRATION
// ═══════════════════════════════════════════════════════════════
async function callOpenRouter(text, systemPrompt) {
  // We now route through the secure Cloudflare Proxy instead of directly to OpenRouter.
  // The API key is safely hidden inside the Cloudflare environment variables!
  const res = await fetch('https://promptflow-proxy.harshraj0235.workers.dev', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.5
    })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenRouter API Error ${res.status}: ${errBody.substring(0, 120)}`);
  }

  const data = await res.json();
  if (!data.choices?.[0]?.message) throw new Error('Invalid OpenRouter response');
  return data.choices[0].message.content.trim();
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP — Strip markdown/filler from AI output
// ═══════════════════════════════════════════════════════════════

function cleanText(raw) {
  // Extract content from <final_prompt> tags if they exist
  const match = raw.match(/<final_prompt>([\s\S]*?)<\/final_prompt>/i);
  if (match && match[1]) {
    raw = match[1];
  } else {
    // Fallback: remove <thinking> block if it exists
    raw = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  }

  return raw
    .replace(/^[\s]*(Here(?:'s| is) (?:the |your )?(enhanced|improved|optimized|rewritten|expanded) prompt:?[\s]*)/i, '')
    .replace(/^[\s]*\**Enhanced Prompt:?\**[\s]*/i, '')
    .replace(/^[\s]*\**\[?Enhanced Prompt\]?\**[\s]*/i, '')
    .replace(/\*\*/g, '')
    .replace(/(?<![a-zA-Z0-9])\*(?!\*)/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-]{3,}$/gm, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENHANCE — Calling OpenRouter
// ═══════════════════════════════════════════════════════════════

async function enhancePrompt(text, tone, settings) {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt(tone, settings);

  try {
    console.log(`PromptFlow: Requesting OpenRouter...`);
    const result = await callOpenRouter(text, systemPrompt);
    const elapsed = Date.now() - startTime;
    console.log(`PromptFlow: Success in ${elapsed}ms`);
    return { text: cleanText(result), provider: 'OpenRouter AI', time: elapsed };
  } catch (e) {
    console.error(`PromptFlow: Error —`, e.message);
    return { error: 'API_ERROR', rawError: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ═══════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Save Prompt
  if (request.action === 'save_prompt') {
    chrome.storage.local.get(['savedPrompts'], (res) => {
      const prompts = res.savedPrompts || [];
      const migrated = prompts.map(p => typeof p === 'string' ? {
        id: Date.now() + Math.random().toString(), content: p,
        folder: 'Uncategorized', rating: 0, usageCount: 0, createdAt: new Date().toISOString()
      } : p);

      if (!migrated.find(p => p.content === request.text)) {
        migrated.unshift({
          id: Date.now().toString(), content: request.text,
          folder: request.folder || 'Uncategorized', rating: 0, usageCount: 0,
          createdAt: new Date().toISOString()
        });
        chrome.storage.local.set({ savedPrompts: migrated }, () => sendResponse({ success: true }));
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }

  // Track Usage
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
      analytics.timeSavedSeconds += 180;
      chrome.storage.local.set({ analytics }, () => sendResponse({ success: true }));
    });
    return true;
  }

  // AI Enhance — The core feature
  if (request.action === 'ai_enhance') {
    const tone = request.tone || 'auto';
    const cacheKey = tone + '|' + request.text;

    // Cache = instant
    if (enhanceCache.has(cacheKey)) {
      sendResponse({ success: true, text: enhanceCache.get(cacheKey), provider: 'Cache', time: 0 });
      return true;
    }

    chrome.storage.sync.get(['persAudience', 'persStyle', 'persExamples'], (settings) => {
      enhancePrompt(request.text, tone, settings || {})
        .then(result => {
          if (result.error) {
            sendResponse({ success: false, error: result.error, rawError: result.rawError });
          } else {
            enhanceCache.set(cacheKey, result.text);
            sendResponse({ success: true, text: result.text, provider: result.provider, time: result.time });
          }
        })
        .catch(err => {
          console.error('PromptFlow: Enhancement failed:', err);
          sendResponse({ success: false, error: err.message });
        });
    });
    return true;
  }
});
