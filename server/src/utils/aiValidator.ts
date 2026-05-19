import { normalizeAnswer } from './answerNormalizer';
import logger from './logger';

/**
 * Validates whether an answer is valid for a given category and starts with the target letter.
 * Supports fallback to rule-based verification when API keys are not present.
 */
export async function validateAnswer(
  answer: string,
  letter: string,
  category: string
): Promise<boolean> {
  const normAnswer = normalizeAnswer(answer);
  const normLetter = normalizeAnswer(letter);

  if (!normAnswer || !normLetter) return false;

  // Basic Rule 1: Must start with the target letter
  if (normAnswer.charAt(0) !== normLetter) {
    return false;
  }

  // Basic Rule 2: Must be longer than 1 character
  if (normAnswer.length <= 1) {
    return false;
  }

  // If Gemini API key is provided, perform full LLM validation
  if (process.env.GEMINI_API_KEY) {
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toLowerCase();
        
        logger.info(`Gemini evaluated "${normAnswer}" for category "${category}": ${text}`);

        if (text && text.includes('true')) return true;
        if (text && text.includes('false')) return false;

        // If we got a response but it wasn't exactly true/false, default to rejecting just in case
        if (text) return false;
      } else {
        const errText = await response.text();
        logger.error(`Gemini API error: ${response.status} ${response.statusText} - ${errText}`);
      }
    } catch (err) {
      logger.error('Gemini API validation failed, falling back', err);
    }
  }

  // Fallback: if API fails completely or we couldn't parse it, reject it. 
  // It's better to wrongly reject than to blindly accept gibberish.
  logger.warn(`Fallback triggered for ${normAnswer}, rejecting by default.`);
  return false;
}
