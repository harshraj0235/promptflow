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
// THE BRAIN — Elite Prompt Enhancement System Prompt
// This is the MOST important part of the entire extension.
// ═══════════════════════════════════════════════════════════════

const MASTER_SYSTEM_PROMPT = `You are an elite AI prompt engineer and the core engine of PromptFlow Pro.

Your job is to transform weak, vague, or incomplete prompts into highly optimized, structured prompts that maximize AI output quality.

PROCESS (follow every time):

STEP 1 — INTENT DETECTION
Analyze what the user REALLY wants. Classify the prompt type:
- Image generation, Video generation, Coding, Marketing, SEO, Blog writing, UI/UX design, Resume, Storytelling, YouTube scripts, Automation, Business ideas, Email, Research, Data analysis, Social media, Music, or General

STEP 2 — MISSING DETAIL DETECTION
Identify what's missing and auto-fill with smart defaults:
- Who is the audience?
- What style/tone?
- What format/structure?
- What platform is this for?
- What constraints exist?
- What's the end goal?

STEP 3 — PROMPT EXPANSION
Use this enhancement formula:
ROLE + TASK + CONTEXT + STYLE + FORMAT + CONSTRAINTS + OUTPUT GOAL

For IMAGE/VIDEO prompts, use:
SUBJECT + ACTION + ENVIRONMENT + LIGHTING + CAMERA + STYLE + DETAILS + QUALITY + MOOD + OUTPUT FORMAT

STEP 4 — STRUCTURE & CLARITY
- Add clear sections with labels
- Use bullet points for lists
- Add specific details, numbers, dimensions
- Remove ambiguity
- Add expert-level context

CRITICAL OUTPUT RULES:
- Return ONLY the enhanced prompt text
- NO markdown formatting (no bold, no italic, no asterisks, no headers with #)
- NO conversational text like "Here's your enhanced prompt" or "Sure!"
- NO quotation marks wrapping the output
- NO explanations of what you changed
- Just the raw, ready-to-paste enhanced prompt
- Keep the user's original meaning and intent intact
- Make it 3x to 10x more detailed than the input
- Make it immediately usable — paste-ready`;



// ═══════════════════════════════════════════════════════════════
// FREE PROVIDER STACK — Auto-failover, zero cost, scales to millions
// Uses text.pollinations.ai POST endpoint (free, no auth needed)
// ═══════════════════════════════════════════════════════════════

const FREE_PROVIDERS = [
  { name: 'GPT-5 Nano',     model: 'openai-fast',  timeout: 12000 },
  { name: 'OpenAI',         model: 'openai',       timeout: 15000 },
  { name: 'Mistral 3.2',    model: 'mistral',      timeout: 15000 },
  { name: 'DeepSeek V4',    model: 'deepseek',     timeout: 15000 },
  { name: 'Llama 3.3',      model: 'llama',        timeout: 15000 },
];

const COMPACT_SYSTEM = `You are an elite prompt engineer. Transform the user's weak prompt into a highly detailed, optimized prompt. Detect intent, add missing details (audience, style, format, constraints), expand with structure (ROLE, TASK, CONTEXT, STYLE, FORMAT, OUTPUT GOAL). For image/video: add SUBJECT, ACTION, ENVIRONMENT, LIGHTING, CAMERA, STYLE, MOOD. Return ONLY the raw enhanced prompt. No markdown. No asterisks. No bold. No headers. No "Here is" prefix. Just the enhanced prompt text, paste-ready.`;

// Sleep helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callPollinations(text, model, timeoutMs, isRetry = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://text.pollinations.ai/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: COMPACT_SYSTEM },
          { role: 'user', content: text }
        ],
        max_tokens: 1200,
        temperature: 0.7
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('RATE_LIMIT');
      }
      const errBody = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 150)}`);
    }

    const data = await res.json();
    if (!data.choices?.[0]?.message) throw new Error('Invalid response structure');
    return data.choices[0].message.content.trim();
  } catch (e) {
    clearTimeout(timer);
    
    // If it's a rate limit and we haven't retried yet, wait 2 seconds and try again
    if (e.message === 'RATE_LIMIT' && !isRetry) {
      console.log(`PromptFlow: Rate limited on ${model}. Waiting 2s before retry...`);
      await delay(2000);
      return await callPollinations(text, model, timeoutMs, true);
    }
    
    throw e;
  }
}

// BYOK: Groq (sub-second responses)
async function callGroq(text, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: MASTER_SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        max_tokens: 1200, temperature: 0.7
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (e) { clearTimeout(timer); throw e; }
}

// BYOK: OpenAI
async function callOpenAI(text, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: MASTER_SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        max_tokens: 1200, temperature: 0.7
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (e) { clearTimeout(timer); throw e; }
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP — Strip any markdown artifacts from AI output
// ═══════════════════════════════════════════════════════════════

function cleanText(raw) {
  return raw
    // Remove "Here's your enhanced prompt:" type prefixes
    .replace(/^[\s]*(Here(?:'s| is) (?:the |your )?(enhanced|improved|optimized|rewritten|expanded) prompt:?[\s]*)/i, '')
    .replace(/^[\s]*\**Enhanced Prompt:?\**[\s]*/i, '')
    .replace(/^[\s]*\**\[?Enhanced Prompt\]?\**[\s]*/i, '')
    // Remove markdown bold/italic
    .replace(/\*\*/g, '')
    .replace(/(?<![a-zA-Z0-9])\*(?!\*)/g, '')
    // Remove markdown headers
    .replace(/^#{1,6}\s*/gm, '')
    // Remove horizontal rules
    .replace(/^[-]{3,}$/gm, '')
    // Remove wrapping quotes
    .replace(/^["']|["']$/g, '')
    // Clean up excessive newlines
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENHANCE — Multi-provider with auto-failover
// ═══════════════════════════════════════════════════════════════

async function enhancePrompt(text, settings) {
  const provider = settings.aiProvider || 'auto';
  const startTime = Date.now();

  // BYOK first if configured
  if (provider === 'groq' && settings.groqApiKey) {
    try {
      const result = await callGroq(text, settings.groqApiKey);
      return { text: cleanText(result), provider: 'Groq', time: Date.now() - startTime };
    } catch (e) {
      console.warn('PromptFlow: Groq BYOK failed, falling back...', e.message);
    }
  }

  if (provider === 'openai' && settings.openaiApiKey) {
    try {
      const result = await callOpenAI(text, settings.openaiApiKey);
      return { text: cleanText(result), provider: 'OpenAI', time: Date.now() - startTime };
    } catch (e) {
      console.warn('PromptFlow: OpenAI BYOK failed, falling back...', e.message);
    }
  }

  // FREE STACK — Try each provider until one succeeds
  const errors = [];
  for (const prov of FREE_PROVIDERS) {
    try {
      console.log(`PromptFlow: Trying ${prov.name}...`);
      const result = await callPollinations(text, prov.model, prov.timeout);
      const elapsed = Date.now() - startTime;
      console.log(`PromptFlow: ${prov.name} responded in ${elapsed}ms`);
      return { text: cleanText(result), provider: prov.name, time: elapsed };
    } catch (e) {
      errors.push(`${prov.name}: ${e.message}`);
      console.warn(`PromptFlow: ${prov.name} failed —`, e.message);
      if (e.message === 'RATE_LIMIT' || e.message.includes('429')) {
          await delay(1500); // Give the queue time to clear before trying next provider
      }
    }
  }

  throw new Error(`All providers failed. Details:\n${errors.join('\n')}`);
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
    // Cache = instant
    if (enhanceCache.has(request.text)) {
      sendResponse({ success: true, text: enhanceCache.get(request.text), provider: 'Cache', time: 0 });
      return true;
    }

    chrome.storage.sync.get(['aiProvider', 'groqApiKey', 'openaiApiKey'], (settings) => {
      enhancePrompt(request.text, settings || {})
        .then(result => {
          enhanceCache.set(request.text, result.text);
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
