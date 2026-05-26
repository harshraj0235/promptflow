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

const PASS1_SYSTEM = `You are an elite Prompt Architect.
Your task is to transform vague user input into a precise, optimized, high-performance AI prompt.

Your objectives:
- Infer user intent and target audience
- Add missing clarity
- Structure instructions logically
- Define role/context
- Specify output format
- Add useful constraints
- Improve reasoning instructions
- Optimize for the selected AI model
- Preserve original user intent exactly

Return ONLY the enhanced prompt. Do not include conversational filler like "Here is your prompt". Return it completely paste-ready.`;

const PASS2_SYSTEM = `You are an elite Prompt Scorer and Refiner.
Your task is to evaluate the provided engineered prompt, fix any remaining ambiguities, and append a Prompt Quality Score.

Rules:
1. Polish the text for maximum clarity and structural flow.
2. DO NOT change the core meaning.
3. At the very bottom of the prompt, append exactly this format: "Prompt Quality Score: [XX]/100" (where XX is your rigorous evaluation of the prompt's clarity, context, and constraints).
4. Return ONLY the final polished prompt with the score attached. No conversational filler.`;

function getPass1SystemPrompt(tone, settings = {}) {
  let prompt = PASS1_SYSTEM;

  if (settings.persAudience || settings.persStyle || settings.persExamples) {
    prompt += `\n\n--- USER PERSONALIZATION PROFILE ---`;
    if (settings.persAudience) prompt += `\nDEFAULT TARGET AUDIENCE: ${settings.persAudience}`;
    if (settings.persStyle) prompt += `\nCUSTOM WRITING STYLE & PERSONA: ${settings.persStyle}\n(CRITICAL: You MUST adopt this persona and writing style strictly.)`;
    if (settings.persExamples) prompt += `\nFEW-SHOT EXAMPLES OF "GOOD" OUTPUTS:\n${settings.persExamples}\n(CRITICAL: Anchor your enhancement tightly to these examples.)`;
    prompt += `\n-----------------------------------`;
  }

  if (tone && tone !== 'auto') {
    prompt += `\n\nCRITICAL INSTRUCTION: The user has explicitly requested to optimize this prompt for the following goal/tone: [${tone.toUpperCase()}]. Ensure the Tone and Context reflect this choice perfectly.`;
  }
  
  return prompt;
}

// Sleep helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callPollinations(text, systemPrompt, model) {
  try {
    const res = await fetch('https://text.pollinations.ai/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 150)}`);
    }

    const data = await res.json();
    if (!data.choices?.[0]?.message) throw new Error('Invalid response structure');
    return data.choices[0].message.content.trim();
  } catch (e) {
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
// MAIN ENHANCE — Pollinations Multi-Pass Architecture
// ═══════════════════════════════════════════════════════════════

async function enhancePrompt(text, tone, settings) {
  const startTime = Date.now();
  const errors = [];
  
  for (const prov of FREE_PROVIDERS) {
    let retries = 2; // Allow up to 2 retries per model if queue is full
    
    while (retries >= 0) {
      try {
        console.log(`PromptFlow: Pass 1 (Engineering) on ${prov.name}...`);
        const pass1Result = await callPollinations(text, getPass1SystemPrompt(tone, settings), prov.model);
        
        console.log(`PromptFlow: Pass 2 (Scoring & Refinement) on ${prov.name}...`);
        const pass2Result = await callPollinations(pass1Result, PASS2_SYSTEM, prov.model);
        
        const elapsed = Date.now() - startTime;
        console.log(`PromptFlow: Multi-Pass on ${prov.name} finished in ${elapsed}ms`);
        return { text: cleanText(pass2Result), provider: prov.name, time: elapsed };
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
