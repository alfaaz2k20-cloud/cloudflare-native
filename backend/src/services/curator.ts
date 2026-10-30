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
WEBSITE: https://tch.alfaazcollective.org
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
- When asked about Tchandervar, explain that it is an initiative and offshoot born out of Alfaaz Collective (tch.alfaazcollective.org).
- Its philosophy is "It belongs to where it lives", curating authentic valley art and handcrafted frames for living spaces, hotels, and offices.

CONFIDENTIALITY:
- Uphold the Strict Confidentiality Guardrails regarding recruitment scoring, psychometric parameters, and internal recruiter tools.

KNOWLEDGE BASE:
${ALFAAZ_KNOWLEDGE}
`.trim();

export function offlineCuratorResponse(question: string): string {
  const q = (question || '').toLowerCase();
  if (/tchandervar|sister|offshoot|tch|frame|commercial|decor/.test(q)) {
    return (
      "Tchandervar (tch.alfaazcollective.org) is an official initiative and offshoot born out of the Alfaaz Collective. " +
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

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
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
    "art, architecture, photography, film, philosophy, or literature. Focus on a specific, authentic, and scholarly " +
    "topic that resonates with local identity while connecting to a broader human narrative."
  );

  const systemPrompt = `You are Curator AI for the Alfaaz Collective, a senior polymath, scholarly researcher, and poetic voice.
TASK: Generate an exhaustive, deeply detailed, and evocative academic journal article (minimum 1500+ words).
TONE: Academic, dense, grounded in Kashmiri/Himalayan nuances, and globally philosophical.
STRUCTURE:
- Evocative title and a concise philosophical excerpt.
- 5 to 6 comprehensive sections with <h2> headings.
- Include architectural, poetic, or historical quotes using <blockquote>.
- MANDATORY FINAL SECTION: <h3>References & Scholarly Citations</h3> containing a numbered list (<ol>) of 5 to 7 authentic academic, historical, or philosophical citations (e.g., Sir Walter Lawrence, Ram Chandra Kak, Gaston Bachelard, Keith Critchlow, Christopher Alexander, Martin Heidegger, Agha Shahid Ali, Lal Ded, etc.) with year, publisher, and specific contextual notes.
OUTPUT REQUIREMENTS:
- MUST be a strictly valid JSON object.
- Format: {"title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>..."}
- "content" must use HTML tags (<p>, <h2>, <h3>, <blockquote>, <ol>, <li>, <em>, <strong>).
- Avoid unescaped raw newlines or illegal escape sequences inside JSON strings.`;

  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
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
    title: "The Geometry of Stillness: Pinjrakari, Khatamband, and the Metaphysics of Kashmiri Vernacular Space",
    excerpt: "An architectural and philosophical inquiry into how traditional Kashmiri woodwork mediates light, sacred privacy, and contemplative geography against the backdrop of Islamic geometry and modern phenomenology.",
    content: `<p class="lead-paragraph">In the labyrinthine alleyways of old Srinagar—where the Jhelum curves like a calligraphic ligature through Shehr-e-Khaas—architecture was never conceived as an imposition of brute force against landscape. Rather, the historic Kashmiri dwelling functioned as a permeable membrane, a tactile threshold where the domestic interior engaged in a continuous, quiet colloquy with water, mist, and season. At the apex of this architectural ethos stands <em>Pinjrakari</em>: the ancient craft of assembling intricate geometric wooden lattices without the intrusion of a single nail, fastener, or adhesive drop. Here, timber ceases to be mere framing; it becomes a mathematical meditation on light, boundary, and sanctuary.</p>

<h2>1. The Poetics of the Threshold: Light as a Living Membrane</h2>
<p>To cross into a traditional Kashmiri room bounded by Pinjra screens is to enter a modified state of temporal perception. In conventional modern architecture, fenestration is dominated by the brutalist polarity of sheet glass—an absolute transparency that simultaneously creates thermal exposure and visual vulnerability. In contrast, the Pinjra master crafts a nuanced gradient of visibility. Looking outward from within the shadowed timbered sanctum, the bustling river ghats and chinar groves are visible in crisp clarity; yet looking from without, the passerby sees only an impenetrable tapestry of rhythm and shade.</p>
<p>This perceptual duality touches upon what Gaston Bachelard characterized in <em>The Poetics of Space</em> as the dialectics of outside and inside. The screen does not wall off reality; it refines it. Sunbeams passing through the hexagonal star-matrices of the lattice are broken into shifting constellations across untreated cedar floors. As the sun traverses the Pir Panjal range, the geometry within the room shifts continuously—turning the living floor into an astronomical clock where time is experienced not as mechanical urgency, but as contemplative unfolding.</p>

<h2>2. Pinjrakari: The Joinery of Void and Solid</h2>
<p>The technical brilliance of Pinjrakari lies in its absolute reliance on dry-joinery (<em>dovetailing, tenon-and-mortise, and precision lap-joints</em>). Using fine local deodar (<em>Cedrus deodara</em>) and walnut timbers seasoned through mountain winters, the artisan (<em>Pinjragar</em>) cuts miniature battens into precise polygonal interlocking components. The geometric vocabulary is deeply rooted in classical Islamic tessellation: six-fold rosettes (<em>Shesh-Pehlu</em>), octagrams (<em>Hasht-Pehlu</em>), and intricate decagonal strapwork reminiscent of Persian girih tiles.</p>
<p>What elevates Pinjrakari beyond mere ornamentation is its structural thermodynamics. Himalayan timber breathes; it expands under the high humidity of spring rains and contracts during the severe arid freezes of <em>Chillai Kalan</em>. Glued or nailed joints would inevitably buckle, splinter, and fracture under these seismic and hygroscopic stresses. By permitting microscopic flex within each interlocking node, the Pinjra screen accommodates seasonal movement without structural fatigue. The emptiness between the wood is not empty; it is structural room for breath.</p>

<h2>3. Khatamband: Ceilings as Terrestrial Cosmologies</h2>
<p>If Pinjrakari governs the horizontal horizon of the room, <em>Khatamband</em> crowns its vertical axis. Introduced into the Kashmir Valley during the fourteenth century under the spiritual and cultural patronage of Mir Sayyid Ali Hamadani (Shah-e-Hamadan), Khatamband is the art of assembling small geometric pine and fir moldings into ornate ceiling mosaics.</p>
<blockquote>"The craftsman works in silence, fitting polygon into polygon until the roof over man's head mirrors the infinite geometry of the vault above." — Ram Chandra Kak, <em>Ancient Monuments of Kashmir</em> (1933)</blockquote>
<p>In classical Khatamband patterns—such as <em>Murabba</em>, <em>Dawazdah</em>, and <em>Hasht-Gull</em>—each ceiling represents a terrestrial microcosm. Unlike European painted frescoes that fix a single perspectival vanishing point, Islamic geometric woodwork avoids representational hierarchy. The recursive repetitions draw the human gaze upward into infinite symmetry, embodying the metaphysical principle of <em>Tawhid</em> (the underlying Divine Unity governing apparent multiplicity). The acoustic consequence is equally profound: the multi-faceted wooden facets scatter soundwaves, producing an intimate, hushed acoustic warmth ideally suited for poetry recitation, zikr, and Sufiana Kalam.</p>

<h2>4. A Dialogue with Global Phenomenology: Heidegger and Alexander</h2>
<p>When placed in conversation with Western spatial philosophy, the vernacular architecture of Kashmir offers a vital corrective to the alienation of contemporary urbanism. In his seminal essay <em>Building Dwelling Thinking</em>, Martin Heidegger argued that mortals dwell when they save the earth and receive the sky—when building preserves the "fourfold" of earth, sky, divinities, and mortals. The Kashmiri house was an ecological manifestation of this preservation. Its clay-and-timber walls (<em>Dhajji-Dewari</em>) possessed low thermal mass and high ductility, absorbing tectonic shocks where rigid masonry crumbled.</p>
<p>Furthermore, Christopher Alexander in <em>A Pattern Language</em> notes that human well-being requires "Trellised Walks", "Light on Two Sides of Every Room", and "Sanctuary Spaces". Long before these concepts were codified in modern architectural theory, the master builders of Srinagar had integrated them intuitively. The Pinjra window is never merely an aperture; it is an inhabited furniture piece—a wide window seat (<em>dub</em>) cantilevered over the canal, allowing the resident to be simultaneously suspended above the water while shielded within domestic safety.</p>

<h2>5. Ecology, Memory, and the Perils of Modern Erasure</h2>
<p>Today, this architectural legacy stands at an alarming precipice. The rapid transition toward reinforced cement concrete (RCC), aluminum extrusions, and synthetic glazing has created structures that are seismically precarious and thermally hostile to the Himalayan climate. Concrete trap rooms require excessive electric heating in winter and artificial cooling in summer, severing the dweller's organic relationship with the seasons.</p>
<p>Yet the loss is not merely physical; it is cultural and epistemological. When the craft of Pinjrakari decays, we lose a tactile lexicon of patience, mathematical literacy, and spiritual geometry that took half a millennium to evolve. The Alfaaz Collective regards these historical forms not as inert relics for nostalgic museumification, but as living theoretical blueprints for a sustainable, poetic, and grounded future.</p>

<hr style="margin: 3rem 0; border: none; border-top: 1px solid var(--grid-border);" />

<h3>References & Scholarly Citations</h3>
<ol style="font-size: 12px; line-height: 1.8; color: var(--text-secondary); padding-left: 1.2rem;">
  <li><strong>Lawrence, Sir Walter R.</strong> (1895). <em>The Valley of Kashmir</em>. London: Oxford University Press. (Documenting indigenous woodworking guilds, forestry practices, and the architectural taxonomy of Shehr-e-Khaas).</li>
  <li><strong>Kak, Ram Chandra.</strong> (1933). <em>Ancient Monuments of Kashmir</em>. London: The India Society. (Authoritative survey of timber architecture, bridge engineering, and medieval joinery traditions).</li>
  <li><strong>Bachelard, Gaston.</strong> (1958). <em>The Poetics of Space</em> (<em>La Poétique de l'espace</em>). Paris: Presses Universitaires de France. (Phenomenological inquiry into domestic enclosures, thresholds, and intimate geometries).</li>
  <li><strong>Critchlow, Keith.</strong> (1976). <em>Islamic Patterns: An Analytical and Cosmological Approach</em>. London: Thames & Hudson. (Mathematical deconstruction of recursive girih geometries, proportional harmonics, and star-polygons).</li>
  <li><strong>Alexander, Christopher, Ishikawa, S., & Silverstein, M.</strong> (1977). <em>A Pattern Language: Towns, Buildings, Construction</em>. New York: Oxford University Press. (Patterns 159: "Light on Two Sides", 179: "Alcoves", and 238: "Filtered Light").</li>
  <li><strong>Heidegger, Martin.</strong> (1951). <em>Building Dwelling Thinking</em> (<em>Bauen Wohnen Denken</em>). Lecture presented at the Darmstadt Colloquium.</li>
  <li><strong>Ali, Agha Shahid.</strong> (1997). <em>The Country Without a Post Office</em>. New York: W.W. Norton & Company. (Poetic evocations of Kashmiri domestic memory, light through latticed balconies, and historical endurance).</li>
</ol>`
  };
}
