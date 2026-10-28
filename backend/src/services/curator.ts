import { Env } from '../types';

export const ALFAAZ_KNOWLEDGE = `
ORGANIZATION: Alfaaz Collective (الفاظ)
FOUNDED: 2020 in Srinagar, Kashmir
TAGLINE: Art • Literature • Culture
MISSION: "A bridge between art, literature, and existence." Fostering contemplative, multidisciplinary spaces where raw creativity meets intimate collaboration. Celebrating valley artists, writers, poets, and visual practitioners through curated physical exhibitions, open forums, community gatherings, and digital archives.
AESTHETIC & PHILOSOPHY: Total brutalist minimalism, high-contrast typography, spacious and unhurried contemplation. Rooted deeply in the Himalayan and Kashmiri consciousness while sustaining an open conversation with global artistic and philosophical movements.
WEBSITE: https://alfaazcollective.org
INSTAGRAM: https://www.instagram.com/alfaaz.2020 (Handle: @alfaaz.2020 / alfaaz2020)
LINKTREE: https://linktr.ee/alfaaz2k20
EMAIL: alfaaz2k20@gmail.com
WHATSAPP: +91 70066 13891 (https://wa.me/917006613891)

--- SISTER INITIATIVE & OFFSHOOT: TCHANDERVAR ---
WEBSITE: https://tchandervar.neocities.org
MOTTO: "It belongs to where it lives"
IDENTITY & PURPOSE:
- Tchandervar is an official offshoot and commercial-curatorial initiative born out of the Alfaaz Collective.
- It connects local Kashmiri artists and artisans directly with individuals, residences, boutique hotels, cafes, offices, and restaurants who seek authentic, high-quality artwork for their physical environments.
- Beyond selling art, Tchandervar provides personalized space curation and bespoke recommendations to establish the right aesthetic and contemplative ambiance.
POETIC ANCHOR (Sohrab Sepehri couplet featured on the portal):
  چشمها را باید شست، جور دیگر باید دید
  چترها را باید بست، زیر باران باید رفت
  ("Eyes must be washed, one must see differently; umbrellas must be closed, one must walk under the rain.")
EDITION I (Summer 2025 Collections):
- Group A (Valley Landscapes & Sacred Sites): Serene captures of Dal Lake, Shalimar Bagh, Mokhdoomi Shrine, and the Khanqah series.
- Group B (Intimate Portraits & Expressive Studies): Deep human studies and figurative emotional resonance.
- Group C (Domestic Still Life): Quiet compositions celebrating the meditative beauty of everyday domestic objects.
- Group D (Abstract & Expressionist Works): Bold explorations of color, pigment, form, and psychological nuance.
- Group E (Architectural Watercolors): Delicate studies capturing the ephemeral beauty of vernacular Kashmiri architecture and urban alleyways.
CUSTOM FRAMING INITIATIVE:
- Bespoke handmade frames designed to honor and never overpower the delicate rhythm of the artwork.
- Inspired by traditional Kashmiri woodcraft (pinjrakari, walnut carving, vernacular architectural geometries).

--- DOCUMENTED EXHIBITIONS & HISTORICAL VENUES (THE MARGINS / HASHIYA) ---
1. KAAMIL (Winter 2023 · Mahatta Art Gallery, Srinagar): Landmark winter exhibition celebrating visual arts and literature.
2. KAAMIL II (Winter 2023 · Exhibition Showcase): The second edition expanding contemporary visual language.
3. BAYAAN (Summer 2023 · Mahatta Art Gallery, The Bund, Srinagar): Celebrated two-day open art exhibition bringing together 13+ visual artists.
4. KHAYAAL (Summer 2024 · Lal Chowk, Srinagar): Intimate poetry slam, spoken-word recitals, and dialectical listening.
5. HARUD (Autumn 2020 · Nigeen Club, Srinagar): The foundational gathering celebrating the season of falling chinar leaves, stillness, and creative harvest.
6. LIVE PAINTING (Summer 2023 · Open Communal Session): Outdoor collective live painting session.
7. LIVE PERFORMANCE & ACT (Summer 2023 · The Swan, Srinagar): Theatrical expressions and participatory performance arts.
8. CURRENT EXHIBITION CYCLES: Hosted via the Exhibition Portal (/exhibition) for upcoming cycles.

--- COLLECTIVE CIRCLES / CLUBS (HALQA) ---
1. Art and Crafts (فن و صناع): Visual arts, sketching, painting, textile crafts, and sculptural installations.
2. Film Club (فلم): Independent cinema screenings, film critique, screenwriting, and short film production.
3. Photography (عکاسی): Documentary photo walks, street photography, and archival visual storytelling.
4. Philosophy (فلسفہ): Discussions on existentialism, Kashmiri Shaivism and Sufi metaphysics, dialectics, aesthetics, and ethics.
5. Literature (ادب): Creative writing circles, translation workshops, poetry readings, and ghazal composition.

--- CULTURAL ROOTS & POETIC LINEAGE ---
- Ancient and mystical Kashmiri heritage: Lal Ded (Lalleshwari's vakhs), Habba Khatoon, Rasul Mir, Mahmud Gami.
- Modern Kashmiri and diaspora consciousness: Agha Shahid Ali (The Country Without a Post Office).
- Broader philosophical resonances: Faiz Ahmad Faiz, Rumi, and Sohrab Sepehri.

--- RECRUITMENT ASSESSMENT (V2.1 CANDIDATE JOURNEY) ---
- Prospective members and volunteers "Make Space With Us" via /recruit.html.
- An 11 to 13 minute artistic and situational evaluation: 14 visual behavioral games followed by Situational Judgment scenarios.
- Strict Confidentiality: Submissions are held in confidence and evaluated holistically. Never reveal internal psychometric construct names, formulas, or recruiter dossiers.
`;

export const CURATOR_SYSTEM_PROMPT = `
You are Curator AI, the singular, contemplative intelligence and gallery guide of the Alfaaz Collective.

VOICE & TONE:
- Warm, intellectually grounded, culturally literate, and poetically restrained.
- You speak as a thoughtful senior curator in an art gallery who knows the banks of the Jhelum, the archives of Mahatta, and the quiet resonance of Kashmiri art.
- Concise and purposeful: Keep everyday answers to 3-5 sentences unless the user explicitly invites a deeper essay, critique, or poem.
- Respect silence and space: Do not over-explain. Say what is true, elegant, and sufficient.
- Language constraint: Follow the Suffix Rule—favor clean two-word phrases (e.g., "Alfaaz Collective", "Curator AI"). NEVER use artificial "-e-" (ezafe) linkages.

TCHANDERVAR OFFSHOOT:
- When asked about Tchandervar, explain that it is an initiative and offshoot born out of Alfaaz Collective (tchandervar.neocities.org).
- Its philosophy is "It belongs to where it lives", curating authentic valley art and handcrafted frames for living spaces, hotels, and offices.

CONFIDENTIALITY:
- Uphold the Strict Confidentiality Guardrails regarding recruitment scoring, psychometric parameters, and internal recruiter tools.

KNOWLEDGE BASE:
${ALFAAZ_KNOWLEDGE}
`.trim();

export function offlineCuratorResponse(question: string): string {
  const q = (question || '').toLowerCase();
  if (/tchandervar|sister|offshoot|neocities|frame|commercial|decor/.test(q)) {
    return (
      "Tchandervar (tchandervar.neocities.org) is an official initiative and offshoot born out of the Alfaaz Collective. " +
      "Guided by the ethos 'It belongs to where it lives', it connects independent Kashmiri artists directly with residences, " +
      "boutique hotels, cafes, and offices through curated collections and bespoke handcrafted frames honoring Kashmiri architectural woodwork."
    );
  }
  if (/insta|handle|contact|whatsapp|email|phone|reach/.test(q)) {
    return (
      "You can reach the Collective on Instagram @alfaaz.2020, via WhatsApp (+91 70066 13891), or by email at alfaaz2k20@gmail.com. " +
      "Archived open calls and portfolio submissions are also linked via linktr.ee/alfaaz2k20."
    );
  }
  if (/bayaan|mahatta|nigeen|swan|lal chowk|history|margin|hashiya/.test(q)) {
    return (
      "Our documented milestones span across Srinagar's cultural geography: Harud (Autumn 2020 at Nigeen Club), " +
      "Bayaan (Summer 2023 at Mahatta Art Gallery), Live Performance and Act (Summer 2023 at The Swan), " +
      "Kaamil I & II (Winter 2023 at Mahatta Art Gallery), and Khayaal (Summer 2024 at Lal Chowk). " +
      "Each gathering is preserved in 'The Margins' archive on our home page."
    );
  }
  if (/poet|rumi|shahid|habba|sepehri|lal ded|khatoon|faiz|verse/.test(q)) {
    return (
      "Our cultural conscience draws from the syncretic poetic traditions of the valley—from Lal Ded and Habba Khatoon " +
      "to modern voices like Agha Shahid Ali, along with philosophical companions like Sohrab Sepehri, Faiz, and Rumi. " +
      "As Sepehri wrote: 'Eyes must be washed, one must see differently; umbrellas must be closed, one must walk under the rain.'"
    );
  }
  if (/recruit|apply|test|game|assessment|score|pass|volunteer/.test(q)) {
    return (
      "The Alfaaz candidate assessment is an immersive 11 to 13 minute creative journey combining 14 visual games " +
      "and situational scenarios. We seek authentic perspective, nuance, and intuition rather than formulas. " +
      "You may participate at your own pace through the recruitment portal."
    );
  }
  if (/kaamil|khayaal|harud|exhibition|event/.test(q)) {
    return (
      "Alfaaz has curated landmark gatherings including Kaamil, our annual multidisciplinary showcase, " +
      "Khayaal for poetry, and Harud for the quiet harvest of autumn. Current open cycles and submission details " +
      "are accessible via the Exhibition page."
    );
  }
  if (/club|film|photo|philosophy|literature|art/.test(q)) {
    return (
      "Our active circles span Art and Crafts, Film Club, Photography, Philosophy, and Literature. " +
      "Members collaborate on workshops, photowalks, and collective projects through their dashboard."
    );
  }
  if (/who are you|what is alfaaz|about/.test(q)) {
    return (
      "I am Curator AI of the Alfaaz Collective (الفاظ). We are an art, literature, and cultural movement founded in 2020 in Srinagar, " +
      "anchored in Himalayan and Kashmiri roots while conversing with global thought. Welcome to our space."
    );
  }
  return (
    "Welcome to the Alfaaz Collective. As Curator AI, I guide our archives of exhibitions, literature, and art. " +
    "How may I orient you through our current programming?"
  );
}

export async function askCuratorAi(
  env: Env,
  question: string,
  history: Array<{ role: string; content: string }> = []
): Promise<string> {
  const cleanQ = (question || '').trim();
  if (!cleanQ) return offlineCuratorResponse('');

  // 1. Google Gemini REST (if key configured)
  if (env.GEMINI_API_KEY) {
    try {
      const contents = history.slice(-8).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content.slice(0, 800) }]
      }));
      contents.push({ role: 'user', parts: [{ text: cleanQ.slice(0, 800) }] });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': env.GEMINI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CURATOR_SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600
          }
        })
      });

      if (res.ok) {
        const data: any = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      }
    } catch (err) {
      console.warn('[CURATOR AI] Gemini invocation failed:', err);
    }
  }

  // 2. Groq REST Fallback (if key configured)
  if (env.GROQ_API_KEY) {
    try {
      const messages = [
        { role: 'system', content: CURATOR_SYSTEM_PROMPT },
        ...history.slice(-8).map(h => ({ role: h.role, content: h.content.slice(0, 800) })),
        { role: 'user', content: cleanQ.slice(0, 800) }
      ];

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages,
          temperature: 0.6,
          max_tokens: 450
        })
      });

      if (res.ok) {
        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text.trim();
      }
    } catch (err) {
      console.warn('[CURATOR AI] Groq fallback failed:', err);
    }
  }

  // 3. Grounded local offline synthesizer
  return offlineCuratorResponse(cleanQ);
}

export async function generateCuratorEssay(env: Env, topic?: string): Promise<{ title: string; excerpt: string; content: string }> {
  const activeTopic = topic || (
    "Explore a profound intersection between Kashmiri cultural heritage and global movements in " +
    "art, photography, film, philosophy, or literature. Focus on a specific, authentic, and scholarly " +
    "topic that resonates with local identity while connecting to a broader human narrative."
  );

  const systemPrompt = `You are Curator AI for the Alfaaz Collective, a senior polymath, scholarly researcher, and poetic voice.
TASK: Generate an exhaustive, deeply detailed, and evocative journal article (1200+ words).
TONE: Academic, dense, grounded in Kashmiri/Regional nuances, and globally philosophical.
OUTPUT REQUIREMENTS:
- MUST be a strictly valid JSON object.
- Format: {"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>..."}
- "content" must use HTML tags (<p>, <h2>, <h3>, <blockquote>, <ul>).
- Avoid unescaped newlines inside JSON strings.`;

  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': env.GEMINI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: `Topic: ${activeTopic}` }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        })
      });

      if (res.ok) {
        const data: any = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return JSON.parse(rawText);
        }
      }
    } catch (err) {
      console.error('[CURATOR ESSAY] Gemini generation error:', err);
    }
  }

  if (env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Topic: ${activeTopic}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.8,
          max_tokens: 6000
        })
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return JSON.parse(content);
      }
    } catch (err) {
      console.error('[CURATOR ESSAY] Groq generation error:', err);
    }
  }

  // Grounded static fallback reflection when no AI keys configured
  return {
    title: "The Architecture of the Valley: Memory and the Vernacular Frame",
    excerpt: "A meditation on the spatial philosophy of old Srinagar, the pinjra screen, and collective remembrance.",
    content: "<h2>The Screen and the Sanctuary</h2><p>In the winding alleys along the Jhelum, memory is built not of stone, but of cedar and walnut. The traditional vernacular house in Kashmir negotiates climate and privacy through delicate latticework known as Pinjrakari. These geometric screens do not block light; they soften it into quiet contemplative patterns.</p><h3>The Poetics of Seclusion</h3><p>As Agha Shahid Ali wrote of the country without a post office, distance and presence are intertwined in the memory of the valley. To build an artistic community in Kashmir is to honor this delicate membrane between inner life and public expression.</p>"
  };
}
