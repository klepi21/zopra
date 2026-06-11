import { normalizeAnswer } from './answerNormalizer';
import logger from './logger';

/**
 * Validates whether an answer is valid for a given category and starts with the target letter.
 * Returns true (valid), false (invalid), or null (AI unavailable — show answer without badge).
 */
export async function validateAnswer(
  answer: string,
  letter: string,
  category: string
): Promise<boolean | null> {
  const normAnswer = normalizeAnswer(answer);
  const normLetter = normalizeAnswer(letter);

  // Empty answer or missing letter — definitively invalid, no need for AI
  if (!normAnswer || !normLetter) return false;

  // Basic Rule 1: Must start with the target letter
  if (normAnswer.charAt(0) !== normLetter) {
    return false;
  }

  // Basic Rule 2: Must be longer than 1 character
  if (normAnswer.length <= 1) {
    return false;
  }

  // If no API key is configured, skip AI validation entirely — show answer without AI badge
  if (!process.env.GEMINI_API_KEY) {
    logger.info(`No GEMINI_API_KEY set; skipping AI validation for "${normAnswer}"`);
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second hard timeout

  try {
    const prompt = `You are a strict, expert judge for the Greek word game "Όνομα Ζώο Πράγμα" (Stop).
Category: "${category}"
Letter: "${normLetter}"
Answer submitted: "${normAnswer}"

RULES:
1. The answer MUST be a real, valid Greek word or entity that accurately fits the Category.
2. The answer MUST start with the Letter "${normLetter}".
3. It must not be a swear word, profanity, or gibberish. (For example, "ΣΚΑΤΑ" means shit and is NOT a valid name or word for the game, it must be rejected).
4. Do not be overly pedantic about exact spelling if it clearly represents a valid entity, but do reject completely fake words.

Is this answer valid? Reply with ONLY "true" or "false". No other text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toLowerCase();

      logger.info(`Gemini evaluated "${normAnswer}" for category "${category}": ${text}`);

      if (text && text.includes('true')) return true;
      if (text && text.includes('false')) return false;

      // Ambiguous response — treat as unvalidated rather than wrongly rejecting
      logger.warn(`Gemini returned ambiguous response for "${normAnswer}": "${text}"`);
      return null;
    } else {
      const errText = await response.text();
      logger.error(`Gemini API error: ${response.status} ${response.statusText} - ${errText}`);
      // API error — skip badge rather than falsely approving or rejecting
      return null;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    // Timeout (AbortError) or network failure — show answer without AI badge so game continues
    logger.warn(`Gemini API timed out or failed for "${normAnswer}", skipping AI badge`, err);
    return null;
  }
}
