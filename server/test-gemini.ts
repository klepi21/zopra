import dotenv from 'dotenv';
dotenv.config();

const prompt = `You are a strict, expert judge for the Greek word game "Όνομα Ζώο Πράγμα" (Stop).
Category: "Επάγγελμα"
Letter: "Θ"
Answer submitted: "ΘΡΑΝΙΟ"

RULES:
1. The answer MUST be a real, valid Greek word or entity that accurately fits the Category.
2. The answer MUST start with the Letter "Θ".
3. It must not be a swear word, profanity, or gibberish. (For example, "ΣΚΑΤΑ" means shit and is NOT a valid name or word for the game, it must be rejected).
4. Do not be overly pedantic about exact spelling if it clearly represents a valid entity, but do reject completely fake words.

Is this answer valid? Reply with ONLY "true" or "false". No other text.`;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1 },
  }),
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data)))
.catch(err => console.error(err));
