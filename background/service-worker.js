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
  { name: 'Pollinations AI (Fast)', model: 'openai-fast',  timeout: 30000 },
  { name: 'Pollinations AI (Base)', model: 'openai',       timeout: 30000 }
];

const COMPACT_SYSTEM = `You are an expert Prompt Engineer. Your task is to take the user's raw input and transform it into a highly effective, structured prompt. Follow the CREATE framework:
- Context: Define the role or background the AI should adopt.
- Request: Clearly state the specific task.
- Explanation: Provide any necessary details, rules, or constraints.
- Action: Specify the exact output format (e.g., table, code block, bullet points).
- Tone: Define the tone.
ONLY provide the final, enhanced prompt. Do not include introductory text, markdown headers, or asterisks. Return it completely paste-ready.`;

function getSystemPrompt(tone) {
  if (!tone || tone === 'auto') return COMPACT_SYSTEM;
  return COMPACT_SYSTEM + `\n\nCRITICAL INSTRUCTION: The user has explicitly requested to optimize this prompt for the following goal/tone: [${tone.toUpperCase()}]. Ensure the Context and Tone reflect this choice perfectly.`;
}

// Sleep helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callPollinations(text, tone, model, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://text.pollinations.ai/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: getSystemPrompt(tone) },
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
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP — Strip any markdown artifacts from AI output
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
// MAIN ENHANCE — Pollinations Only
// ═══════════════════════════════════════════════════════════════

async function enhancePrompt(text, tone, settings) {
  const startTime = Date.now();

  // FREE STACK — Try each provider until one succeeds (with retry logic for Queue Full)
  const errors = [];
  
  for (const prov of FREE_PROVIDERS) {
    let retries = 2; // Allow up to 2 retries per model if queue is full
    
    while (retries >= 0) {
      try {
        console.log(`PromptFlow: Trying ${prov.name}... (Retries left: ${retries})`);
        const result = await callPollinations(text, tone, prov.model, prov.timeout);
        const elapsed = Date.now() - startTime;
        console.log(`PromptFlow: ${prov.name} responded in ${elapsed}ms`);
        return { text: cleanText(result), provider: prov.name, time: elapsed };
      } catch (e) {
        if ((e.message === 'RATE_LIMIT' || e.message.includes('429')) && retries > 0) {
            console.log(`Queue full for ${prov.name}, waiting 2 seconds...`);
            await delay(2000);
            retries--;
            continue; // Retry same model
        }
        
        // If it wasn't a rate limit, or we're out of retries, log error and break to next model
        errors.push(`${prov.name}: ${e.message}`);
        console.warn(`PromptFlow: ${prov.name} failed —`, e.message);
        break; 
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
    const tone = request.tone || 'auto';
    const cacheKey = tone + '|' + request.text;

    // Cache = instant
    if (enhanceCache.has(cacheKey)) {
      sendResponse({ success: true, text: enhanceCache.get(cacheKey), provider: 'Cache', time: 0 });
      return true;
    }

    chrome.storage.sync.get(['aiProvider', 'geminiApiKey', 'groqApiKey', 'openaiApiKey'], (settings) => {
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
