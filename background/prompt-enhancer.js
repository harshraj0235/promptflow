/**
 * PromptFlow Pro — Prompt Enhancer
 * ==================================
 * A fully rule-based (zero API) prompt enhancement engine.
 * Uses pattern matching, heuristics, and a curated set of
 * prompt-engineering best practices to improve user prompts.
 *
 * Enhancement modes:
 *   • clarify          — Improve specificity and remove vagueness
 *   • structured       — Reformat into Role / Context / Task / Format
 *   • chain-of-thought — Add step-by-step reasoning scaffolding
 *   • professional     — Apply formal tone and expert framing
 *
 * @module background/prompt-enhancer
 */

/* ═══════════════════════════════════════════════
 *  Lexicons & Pattern Libraries
 * ═══════════════════════════════════════════════ */

/** Words / phrases considered vague and imprecise */
const VAGUE_TERMS = [
  { pattern: /\bgood\b/gi, replacement: 'high-quality' },
  { pattern: /\bbad\b/gi, replacement: 'suboptimal' },
  { pattern: /\bbig\b/gi, replacement: 'substantial' },
  { pattern: /\bsmall\b/gi, replacement: 'concise' },
  { pattern: /\bnice\b/gi, replacement: 'well-crafted' },
  { pattern: /\bstuff\b/gi, replacement: 'elements' },
  { pattern: /\bthings\b/gi, replacement: 'aspects' },
  { pattern: /\ba lot\b/gi, replacement: 'extensively' },
  { pattern: /\bkind of\b/gi, replacement: '' },
  { pattern: /\bsort of\b/gi, replacement: '' },
  { pattern: /\bbasically\b/gi, replacement: '' },
  { pattern: /\bjust\b/gi, replacement: '' },
  { pattern: /\breally\b/gi, replacement: '' },
  { pattern: /\bvery\b/gi, replacement: 'highly' },
  { pattern: /\bmaybe\b/gi, replacement: 'consider' },
  { pattern: /\bI think\b/gi, replacement: '' },
  { pattern: /\bI guess\b/gi, replacement: '' },
];

/** Filler sentence starters to remove */
const FILLER_STARTERS = [
  /^(So,?\s*)/i,
  /^(Well,?\s*)/i,
  /^(Okay,?\s*so\s*)/i,
  /^(Um,?\s*)/i,
  /^(Hey,?\s*)/i,
  /^(Hi,?\s*)/i,
  /^(Hello,?\s*)/i,
  /^(Please\s*)/i,
  /^(Can you\s*)/i,
  /^(Could you\s*)/i,
  /^(I want you to\s*)/i,
  /^(I need you to\s*)/i,
  /^(I'd like you to\s*)/i,
];

/** Intent keywords for classification */
const INTENT_SIGNALS = {
  creative: [
    'write', 'story', 'poem', 'creative', 'fiction', 'narrative', 'character',
    'dialogue', 'script', 'song', 'lyrics', 'essay', 'blog', 'article',
    'content', 'copywriting', 'slogan', 'tagline', 'imagine',
  ],
  technical: [
    'code', 'function', 'api', 'debug', 'error', 'programming', 'algorithm',
    'database', 'sql', 'python', 'javascript', 'react', 'deploy', 'server',
    'architecture', 'regex', 'docker', 'kubernetes', 'devops', 'testing',
  ],
  analytical: [
    'analyze', 'analyse', 'compare', 'evaluate', 'assess', 'review', 'data',
    'statistics', 'research', 'study', 'report', 'metrics', 'trends',
    'breakdown', 'insight', 'findings', 'hypothesis',
  ],
  educational: [
    'explain', 'teach', 'tutorial', 'learn', 'understand', 'concept',
    'example', 'definition', 'difference', 'how does', 'what is',
    'why does', 'beginner', 'guide', 'introduction',
  ],
  business: [
    'email', 'proposal', 'strategy', 'marketing', 'sales', 'presentation',
    'pitch', 'meeting', 'agenda', 'stakeholder', 'roi', 'budget',
    'project', 'timeline', 'roadmap', 'kpi',
  ],
  conversational: [
    'chat', 'talk', 'discuss', 'opinion', 'advice', 'recommend',
    'suggest', 'help me', 'what should', 'how should',
  ],
};

/** Role suggestions based on detected intent */
const ROLE_SUGGESTIONS = {
  creative: 'an experienced creative writer with a strong command of narrative techniques',
  technical: 'a senior software engineer with deep expertise in modern development practices',
  analytical: 'a data analyst skilled in turning raw information into actionable insights',
  educational: 'a patient and knowledgeable educator who explains concepts clearly',
  business: 'a seasoned business strategist with expertise in corporate communications',
  conversational: 'a thoughtful advisor who provides balanced, well-reasoned guidance',
  general: 'a knowledgeable assistant with broad expertise',
};

/** Output format suggestions based on intent */
const FORMAT_SUGGESTIONS = {
  creative: 'Use vivid language, varied sentence structure, and engaging pacing.',
  technical: 'Include code examples with comments, use proper formatting, and explain trade-offs.',
  analytical: 'Present findings in a structured format with bullet points, data references, and clear conclusions.',
  educational: 'Use clear headings, numbered steps, relatable analogies, and concrete examples.',
  business: 'Use a professional tone, include executive summary, key points, and actionable next steps.',
  conversational: 'Respond in a friendly yet informative tone with practical suggestions.',
  general: 'Organise the response with clear sections and provide concrete examples where relevant.',
};

/* ═══════════════════════════════════════════════
 *  PromptEnhancer class
 * ═══════════════════════════════════════════════ */

export class PromptEnhancer {
  /* ────────────────────────────────────────────
   *  Main Enhancement Entry Point
   * ──────────────────────────────────────────── */

  /**
   * Enhance a prompt using the specified mode.
   *
   * @param {string} prompt — The raw user prompt.
   * @param {'clarify'|'structured'|'chain-of-thought'|'professional'} mode
   * @returns {string} The enhanced prompt.
   */
  enhance(prompt, mode = 'clarify') {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return prompt || '';
    }

    const cleaned = this.#cleanUp(prompt);

    switch (mode) {
      case 'clarify':
        return this.#enhanceClarify(cleaned);
      case 'structured':
        return this.#enhanceStructured(cleaned);
      case 'chain-of-thought':
        return this.#enhanceChainOfThought(cleaned);
      case 'professional':
        return this.#enhanceProfessional(cleaned);
      default:
        return this.#enhanceClarify(cleaned);
    }
  }

  /* ────────────────────────────────────────────
   *  Analysis & Suggestions
   * ──────────────────────────────────────────── */

  /**
   * Analyse a prompt and return a quality score with suggestions.
   *
   * @param {string} prompt — The raw prompt.
   * @returns {{ score: number, suggestions: string[], strengths: string[], intent: string }}
   *   `score` is 0-100; higher is better.
   */
  analyzePrompt(prompt) {
    if (!prompt || prompt.trim().length === 0) {
      return { score: 0, suggestions: ['The prompt is empty. Write a clear request.'], strengths: [], intent: 'general' };
    }

    const text = prompt.trim();
    let score = 50; // baseline
    const suggestions = [];
    const strengths = [];
    const intent = this.detectIntent(prompt);

    // ── Length check ──
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 5) {
      score -= 20;
      suggestions.push('Your prompt is very short. Add more context and specifics for better results.');
    } else if (wordCount >= 10 && wordCount <= 150) {
      score += 10;
      strengths.push('Good length — detailed enough without being overly verbose.');
    } else if (wordCount > 150) {
      score -= 5;
      suggestions.push('Consider trimming the prompt. Focus on the core request and essential context.');
    }

    // ── Specificity ──
    const hasNumbers = /\d/.test(text);
    if (hasNumbers) {
      score += 5;
      strengths.push('Includes specific numbers or quantities.');
    }

    const hasQuotes = /["'`]/.test(text);
    if (hasQuotes) {
      score += 3;
      strengths.push('Uses quotes or examples for clarity.');
    }

    // ── Vagueness detection ──
    let vagueCount = 0;
    for (const { pattern } of VAGUE_TERMS) {
      const matches = text.match(pattern);
      if (matches) vagueCount += matches.length;
    }
    if (vagueCount > 3) {
      score -= 15;
      suggestions.push('Contains multiple vague or filler words. Be more specific and direct.');
    } else if (vagueCount > 0) {
      score -= vagueCount * 3;
      suggestions.push('Remove filler words like "just", "basically", "kind of" for a clearer prompt.');
    } else {
      score += 5;
      strengths.push('Language is precise and free of vague filler words.');
    }

    // ── Structure ──
    const hasRole = /act as|you are|role|persona/i.test(text);
    if (hasRole) {
      score += 10;
      strengths.push('Specifies a role or persona for the AI.');
    } else {
      suggestions.push('Consider starting with a role definition: "Act as a [role]…"');
    }

    const hasFormat = /format|output|structure|list|bullet|table|json|markdown|step/i.test(text);
    if (hasFormat) {
      score += 8;
      strengths.push('Specifies desired output format.');
    } else {
      suggestions.push('Specify the desired output format (bullet points, table, paragraph, etc.).');
    }

    const hasConstraints = /\b(do not|don't|avoid|must|should|limit|maximum|minimum|at least|no more than)\b/i.test(text);
    if (hasConstraints) {
      score += 7;
      strengths.push('Includes constraints or boundaries.');
    } else {
      suggestions.push('Add constraints like length limits, tone preferences, or what to avoid.');
    }

    // ── Context ──
    const hasContext = /context|background|scenario|situation|given that|assuming/i.test(text);
    if (hasContext) {
      score += 8;
      strengths.push('Provides relevant context or background.');
    } else if (wordCount > 10) {
      suggestions.push('Add context about your situation, audience, or goal for more relevant responses.');
    }

    // ── Examples ──
    const hasExample = /example|e\.g\.|for instance|such as|like this/i.test(text);
    if (hasExample) {
      score += 7;
      strengths.push('Includes examples to guide the output.');
    } else {
      suggestions.push('Providing an example of the desired output can dramatically improve results.');
    }

    // ── Question clarity ──
    const questionCount = (text.match(/\?/g) || []).length;
    if (questionCount > 3) {
      score -= 5;
      suggestions.push('Multiple questions detected. Focus on one clear question at a time for best results.');
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return { score, suggestions, strengths, intent };
  }

  /**
   * Return a list of specific improvement suggestions.
   *
   * @param {string} prompt
   * @returns {string[]}
   */
  suggestImprovements(prompt) {
    const analysis = this.analyzePrompt(prompt);
    return analysis.suggestions;
  }

  /**
   * Detect the primary intent of a prompt.
   *
   * @param {string} prompt
   * @returns {'creative'|'technical'|'analytical'|'educational'|'business'|'conversational'|'general'}
   */
  detectIntent(prompt) {
    if (!prompt) return 'general';

    const lower = prompt.toLowerCase();
    const scores = {};

    for (const [intent, keywords] of Object.entries(INTENT_SIGNALS)) {
      scores[intent] = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) scores[intent]++;
      }
    }

    // Find the intent with the highest score
    let best = 'general';
    let bestScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }

    return bestScore >= 1 ? best : 'general';
  }

  /**
   * Add explicit output constraints to a prompt.
   *
   * @param {string} prompt — The prompt to augment.
   * @returns {string}
   */
  addConstraints(prompt) {
    if (!prompt) return '';

    const intent = this.detectIntent(prompt);
    const constraints = [];

    // Universal constraints
    if (!/\blength\b|words?\b|paragraph|sentence/i.test(prompt)) {
      constraints.push('Keep the response concise and focused — aim for 200-400 words unless more detail is explicitly needed.');
    }

    if (!/\btone\b|style\b|voice\b/i.test(prompt)) {
      const toneMap = {
        creative: 'Use an engaging and vivid tone.',
        technical: 'Use a clear, precise technical tone.',
        analytical: 'Use an objective and evidence-based tone.',
        educational: 'Use a clear, approachable, and encouraging tone.',
        business: 'Use a professional and authoritative tone.',
        conversational: 'Use a friendly and helpful tone.',
        general: 'Use a clear and helpful tone.',
      };
      constraints.push(toneMap[intent] || toneMap.general);
    }

    if (!/\bavoid\b|don't\b|do not\b/i.test(prompt)) {
      constraints.push('Avoid unnecessary jargon, repetition, and filler content.');
    }

    if (constraints.length === 0) return prompt;

    return `${prompt.trim()}\n\nConstraints:\n${constraints.map((c) => `- ${c}`).join('\n')}`;
  }

  /**
   * Identify and resolve vague language in a prompt.
   *
   * @param {string} prompt
   * @returns {string} The prompt with vague terms replaced or removed.
   */
  removeAmbiguity(prompt) {
    if (!prompt) return '';

    let result = prompt;

    // Replace vague terms with precise alternatives
    for (const { pattern, replacement } of VAGUE_TERMS) {
      result = result.replace(pattern, replacement);
    }

    // Clean up double spaces from removed words
    result = result.replace(/\s{2,}/g, ' ').trim();

    // Fix sentence-initial lowercase after removals
    result = result.replace(/(?:^|[.!?]\s+)([a-z])/g, (match, letter) => {
      return match.slice(0, -1) + letter.toUpperCase();
    });

    return result;
  }

  /* ────────────────────────────────────────────
   *  Private Enhancement Modes
   * ──────────────────────────────────────────── */

  /**
   * Basic cleanup: trim, remove fillers, fix spacing.
   * @param {string} text
   * @returns {string}
   */
  #cleanUp(text) {
    let result = text.trim();

    // Remove filler starters
    for (const pattern of FILLER_STARTERS) {
      result = result.replace(pattern, '');
    }

    // Capitalise first character
    result = result.charAt(0).toUpperCase() + result.slice(1);

    // Normalise whitespace
    result = result.replace(/\s{2,}/g, ' ');

    // Ensure ends with punctuation
    if (!/[.!?]$/.test(result)) {
      result += '.';
    }

    return result;
  }

  /**
   * MODE: Clarify — improve specificity and remove vagueness.
   * @param {string} prompt
   * @returns {string}
   */
  #enhanceClarify(prompt) {
    let result = this.removeAmbiguity(prompt);
    const intent = this.detectIntent(result);

    // Add specificity markers if missing
    if (!/\bspecifically\b|\bdetail\b|\bfocus on\b/i.test(result)) {
      result = result.replace(/\.$/, ', providing specific details and concrete examples.');
    }

    // Ensure the prompt asks for actionable output
    if (!/\bprovide\b|\bgive\b|\blist\b|\bexplain\b|\bdescribe\b|\bcreate\b/i.test(result)) {
      const actionVerb = {
        creative: 'Create',
        technical: 'Implement',
        analytical: 'Analyze and present',
        educational: 'Explain in detail',
        business: 'Develop',
        conversational: 'Provide',
        general: 'Provide',
      }[intent] || 'Provide';

      result = `${actionVerb}: ${result.charAt(0).toLowerCase() + result.slice(1)}`;
    }

    return result;
  }

  /**
   * MODE: Structured — format as Role / Context / Task / Format.
   * @param {string} prompt
   * @returns {string}
   */
  #enhanceStructured(prompt) {
    const intent = this.detectIntent(prompt);
    const role = ROLE_SUGGESTIONS[intent] || ROLE_SUGGESTIONS.general;
    const format = FORMAT_SUGGESTIONS[intent] || FORMAT_SUGGESTIONS.general;

    // Extract or synthesise context
    let context = '';
    const contextMatch = prompt.match(/(?:context|background|situation|about)[:.]?\s*(.+?)(?:\.|$)/i);
    if (contextMatch) {
      context = contextMatch[1].trim();
    } else {
      context = `The user needs assistance with a ${intent} task.`;
    }

    // The core task is the cleaned prompt itself
    const task = this.removeAmbiguity(prompt);

    return [
      `**Role:** Act as ${role}.`,
      '',
      `**Context:** ${context}`,
      '',
      `**Task:** ${task}`,
      '',
      `**Format:** ${format}`,
    ].join('\n');
  }

  /**
   * MODE: Chain-of-Thought — add step-by-step reasoning scaffolding.
   * @param {string} prompt
   * @returns {string}
   */
  #enhanceChainOfThought(prompt) {
    const intent = this.detectIntent(prompt);
    const cleaned = this.removeAmbiguity(prompt);

    const thinkingSteps = {
      creative: [
        'Identify the key theme, audience, and desired emotional tone.',
        'Brainstorm 2-3 unique angles or approaches.',
        'Select the strongest approach and outline the structure.',
        'Draft the content with vivid details and engaging pacing.',
        'Review for coherence, originality, and impact.',
      ],
      technical: [
        'Understand the technical requirements and constraints.',
        'Consider edge cases, error scenarios, and performance implications.',
        'Design the solution architecture and choose appropriate patterns.',
        'Implement the solution with clean, documented code.',
        'Review for correctness, efficiency, and maintainability.',
      ],
      analytical: [
        'Identify the key variables and data points to examine.',
        'Determine the appropriate analytical framework or methodology.',
        'Gather and organize the relevant information.',
        'Perform the analysis, noting patterns and anomalies.',
        'Synthesize findings into clear, actionable conclusions.',
      ],
      educational: [
        'Assess the likely knowledge level of the learner.',
        'Break the concept into foundational building blocks.',
        'Explain each block using simple language and analogies.',
        'Provide concrete examples that reinforce understanding.',
        'Summarize key takeaways and suggest next learning steps.',
      ],
      business: [
        'Define the business objective and success criteria.',
        'Analyze the current situation and key stakeholders.',
        'Evaluate options with pros, cons, and risk assessment.',
        'Develop a recommended approach with clear rationale.',
        'Outline implementation steps, timeline, and metrics.',
      ],
      conversational: [
        'Understand the core question or concern being raised.',
        'Consider multiple perspectives on the topic.',
        'Identify the most relevant and practical advice.',
        'Present the advice with supporting reasoning.',
        'Offer follow-up considerations or alternatives.',
      ],
      general: [
        'Understand the core request and desired outcome.',
        'Break the problem into manageable parts.',
        'Address each part systematically with clear reasoning.',
        'Combine insights into a coherent response.',
        'Review for completeness and accuracy.',
      ],
    };

    const steps = thinkingSteps[intent] || thinkingSteps.general;

    return [
      cleaned,
      '',
      'Think through this step by step:',
      ...steps.map((step, i) => `${i + 1}. ${step}`),
      '',
      'After completing your reasoning, present a clear, well-organized final answer.',
    ].join('\n');
  }

  /**
   * MODE: Professional — formal tone with expert framing.
   * @param {string} prompt
   * @returns {string}
   */
  #enhanceProfessional(prompt) {
    const intent = this.detectIntent(prompt);
    const role = ROLE_SUGGESTIONS[intent] || ROLE_SUGGESTIONS.general;
    const cleaned = this.removeAmbiguity(prompt);

    // Upgrade language to professional register
    let professional = cleaned
      .replace(/\bhelp me\b/gi, 'assist in')
      .replace(/\bgive me\b/gi, 'provide')
      .replace(/\btell me\b/gi, 'elaborate on')
      .replace(/\bfigure out\b/gi, 'determine')
      .replace(/\bcome up with\b/gi, 'develop')
      .replace(/\bget\b/gi, 'obtain')
      .replace(/\bmake\b/gi, 'create')
      .replace(/\bfix\b/gi, 'resolve')
      .replace(/\buse\b/gi, 'utilise')
      .replace(/\bshow\b/gi, 'demonstrate')
      .replace(/\bcheck\b/gi, 'evaluate')
      .replace(/\bstart\b/gi, 'initiate')
      .replace(/\bend\b/gi, 'conclude')
      .replace(/\bpick\b/gi, 'select');

    // Clean up double spaces
    professional = professional.replace(/\s{2,}/g, ' ').trim();

    return [
      `As ${role}, please address the following:`,
      '',
      professional,
      '',
      'Requirements:',
      '- Provide a thorough, evidence-based response.',
      '- Use industry-standard terminology where appropriate.',
      '- Structure the response with clear sections and headings.',
      '- Include actionable recommendations or next steps.',
      '- Maintain a professional and authoritative tone throughout.',
    ].join('\n');
  }
}
