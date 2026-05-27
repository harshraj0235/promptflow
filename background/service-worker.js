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

const CRAFTED_SYSTEM = `You are an expert Prompt Engineer. Your ONLY job is to take a short, vague user prompt and rewrite it into a highly detailed, professional, structured AI prompt.

CRITICAL RULES:
1. DO NOT answer the user's prompt. You are ENHANCING the prompt so the user can use it later.
2. The output MUST be a prompt that the user can copy and paste into ChatGPT/Claude.
3. Use a clear structure: [Role] + [Context] + [Task] + [Constraints].
4. Return ONLY the enhanced prompt. No conversational filler.
5. Make it 3x to 5x more detailed than the original input.

EXAMPLE INPUT: "write mail to boss about sick leave"
EXAMPLE OUTPUT: 
Act as a professional corporate employee. I need to write an email to my manager informing them that I am taking a sick leave today. 
Context: I woke up feeling unwell and unable to work. I will monitor my inbox periodically for emergencies but will otherwise be offline.
Task: Write a concise, polite, and professional email requesting the day off. 
Formatting: Keep it under 150 words. Use a respectful tone. Include a placeholder for my name and my manager's name.

Prompt Quality Score: 95/100`;

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
// FAST POST — Primary method via OpenAI-compatible endpoint
// ═══════════════════════════════════════════════════════════════
async function callPollinationsPOST(text, systemPrompt) {
  const res = await fetch('https://text.pollinations.ai/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai-fast',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: 1000,
      temperature: 0.6
    })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`POST ${res.status}: ${errBody.substring(0, 120)}`);
  }

  const data = await res.json();
  if (!data.choices?.[0]?.message) throw new Error('Invalid POST response');
  return data.choices[0].message.content.trim();
}

// ═══════════════════════════════════════════════════════════════
// FAST GET — Fallback method via simple GET endpoint
// ═══════════════════════════════════════════════════════════════
async function callPollinationsGET(text, systemPrompt) {
  const fullPrompt = systemPrompt + '\n\nUser input to enhance:\n' + text;
  const encoded = encodeURIComponent(fullPrompt);
  const url = `https://text.pollinations.ai/${encoded}?model=openai-fast&noCache=true`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${res.status}`);
  }
  
  const result = await res.text();
  if (!result || result.length < 10) throw new Error('Empty GET response');
  return result.trim();
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP — Strip markdown/filler from AI output
// ═══════════════════════════════════════════════════════════════

function cleanText(raw) {
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
// MAIN ENHANCE — Single Pass + Auto-Fallback (POST → GET)
// ═══════════════════════════════════════════════════════════════

async function enhancePrompt(text, tone, settings) {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt(tone, settings);
  const errors = [];

  // Strategy 1: POST endpoint (primary, most reliable)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`PromptFlow: POST attempt ${attempt + 1}...`);
      const result = await callPollinationsPOST(text, systemPrompt);
      const elapsed = Date.now() - startTime;
      console.log(`PromptFlow: Success via POST in ${elapsed}ms`);
      return { text: cleanText(result), provider: 'Pollinations AI', time: elapsed };
    } catch (e) {
      errors.push(`POST#${attempt + 1}: ${e.message}`);
      console.warn(`PromptFlow: POST attempt ${attempt + 1} failed —`, e.message);
      if (e.message.includes('429')) {
        await delay(1500);
      } else {
        await delay(500);
      }
    }
  }

  // Strategy 2: GET endpoint (fallback)
  try {
    console.log('PromptFlow: Falling back to GET endpoint...');
    const result = await callPollinationsGET(text, systemPrompt);
    const elapsed = Date.now() - startTime;
    console.log(`PromptFlow: Success via GET fallback in ${elapsed}ms`);
    return { text: cleanText(result), provider: 'Pollinations AI (GET)', time: elapsed };
  } catch (e) {
    errors.push(`GET: ${e.message}`);
    console.warn('PromptFlow: GET fallback also failed —', e.message);
  }

  throw new Error(`All attempts failed. Details:\n${errors.join('\n')}`);
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
          enhanceCache.set(cacheKey, result.text);
          sendResponse({ success: true, text: result.text, provider: result.provider, time: result.time });
        })
        .catch(err => {
          console.error('PromptFlow: Enhancement failed:', err);
          sendResponse({ success: false, error: err.message });
        });
    });
    return true;
  }
});
