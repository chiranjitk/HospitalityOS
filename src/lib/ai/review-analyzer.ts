/**
 * Rule-based review sentiment analyzer for StaySuite HospitalityOS
 * Analyzes guest review text for sentiment and category detection
 */

interface SentimentResult {
  score: number;       // 0 to 1 (0=negative, 0.5=neutral, 1=positive)
  label: string;       // positive, neutral, negative, mixed
  categories: string[];// detected categories
}

// Positive keywords with weights
const POSITIVE_WORDS: Record<string, number> = {
  'excellent': 1.0, 'amazing': 1.0, 'wonderful': 0.9, 'fantastic': 1.0,
  'great': 0.8, 'beautiful': 0.8, 'perfect': 1.0, 'love': 0.9, 'loved': 0.9,
  'comfortable': 0.7, 'clean': 0.7, 'friendly': 0.8, 'helpful': 0.8,
  'polite': 0.7, 'professional': 0.7, 'spacious': 0.7, 'modern': 0.6,
  'delicious': 0.9, 'tasty': 0.8, 'impeccable': 0.9, 'outstanding': 1.0,
  'superb': 1.0, 'brilliant': 0.9, 'recommend': 0.8, 'recommended': 0.8,
  'impressive': 0.8, 'luxurious': 0.8, 'convenient': 0.6, 'quiet': 0.6,
  'relaxing': 0.7, 'stunning': 0.9, 'gorgeous': 0.9, 'magnificent': 0.9,
  'phenomenal': 1.0, 'exceptional': 0.9, 'memorable': 0.7, 'enjoy': 0.7,
  'enjoyed': 0.7, 'pleasant': 0.7, 'satisfied': 0.7, 'worth': 0.6,
  'good': 0.5, 'nice': 0.4, 'decent': 0.3, 'fine': 0.2, 'okay': 0.1,
  'best': 0.9, 'awesome': 0.9, 'incredible': 0.9, 'marvelous': 0.9,
  'spectacular': 1.0, 'paradise': 0.9, 'heavenly': 0.9,
  'well-maintained': 0.7, 'spotless': 0.8, 'welcoming': 0.8,
};

// Negative keywords with weights
const NEGATIVE_WORDS: Record<string, number> = {
  'terrible': -1.0, 'horrible': -1.0, 'awful': -1.0, 'disgusting': -1.0,
  'dirty': -0.8, 'noisy': -0.7, 'rude': -0.9, 'unhelpful': -0.8,
  'unprofessional': -0.8, 'broken': -0.7, 'old': -0.4, 'outdated': -0.6,
  'smelly': -0.8, 'overpriced': -0.7, 'expensive': -0.5, 'worst': -1.0,
  'bad': -0.7, 'poor': -0.7, 'slow': -0.5, 'cold': -0.4,
  'uncomfortable': -0.7, 'cramped': -0.6, 'tiny': -0.4, 'small': -0.3,
  'filthy': -1.0, 'nasty': -0.9, 'disappointed': -0.7, 'disappointing': -0.7,
  'frustrating': -0.7, 'unacceptable': -0.9, 'complaint': -0.8,
  'problem': -0.5, 'issues': -0.5, 'issue': -0.4, 'bug': -0.7,
  'insects': -0.9, 'roach': -0.9, 'cockroach': -0.9, 'mold': -0.9,
  'stain': -0.7, 'stained': -0.7, 'unpleasant': -0.7, 'never again': -0.9,
  'avoid': -0.8, 'warned': -0.7, 'rip-off': -0.9, 'scam': -1.0,
  'unfriendly': -0.8, 'neglected': -0.7, 'neglect': -0.7,
  'misleading': -0.8, 'cancelled': -0.6, 'overbooked': -0.7,
  'waited': -0.5, 'ignored': -0.7, 'unresponsive': -0.8,
};

// Category keyword mappings
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  cleanliness: ['clean', 'dirty', 'spotless', 'filthy', 'smelly', 'mold', 'stain', 'hygiene', 'sanitary', 'dust', 'dusty', 'housekeeping', 'tidy', 'messy', 'unclean'],
  service: ['staff', 'service', 'friendly', 'rude', 'helpful', 'unhelpful', 'professional', 'unprofessional', 'welcoming', 'attentive', 'front desk', 'reception', 'check-in', 'check-in', 'concierge', 'management'],
  location: ['location', 'central', 'convenient', 'remote', 'accessible', 'nearby', 'walkable', 'close to', 'far from', 'neighborhood', 'area', 'surrounding'],
  value: ['price', 'value', 'overpriced', 'expensive', 'cheap', 'affordable', 'worth', 'money', 'cost', 'rate', 'deal', 'bargain', 'budget'],
  rooms: ['room', 'bed', 'bathroom', 'shower', 'towels', 'spacious', 'cramped', 'tiny', 'comfortable', 'uncomfortable', 'decor', 'furniture', 'amenities', 'tv', 'wifi', 'internet', 'air conditioning', 'heating', 'view', 'balcony', 'minibar'],
  food: ['food', 'breakfast', 'dinner', 'lunch', 'restaurant', 'bar', 'buffet', 'delicious', 'tasty', 'menu', 'chef', 'cuisine', 'meal', 'coffee', 'dining'],
};

// Negation words
const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'neither', 'nor', "n't", 'dont', 'doesnt', 'didnt',
  'wasnt', 'werent', 'isnt', 'arent', 'wont', 'wouldnt', 'couldnt', 'shouldnt',
  'havent', 'hasnt', 'hadnt',
]);

/**
 * Analyze review sentiment using rule-based keyword matching
 */
export async function analyzeReviewSentiment(reviewText: string): Promise<SentimentResult> {
  if (!reviewText || reviewText.trim().length === 0) {
    return { score: 0.5, label: 'neutral', categories: [] };
  }

  const text = reviewText.toLowerCase();
  const words = text.split(/\s+/);

  // Calculate sentiment score
  let positiveScore = 0;
  let negativeScore = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  // Check positive keywords
  for (const [word, weight] of Object.entries(POSITIVE_WORDS)) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        const wordIndex = text.indexOf(match.toLowerCase());
        const isNegated = checkNegation(words, wordIndex);
        if (isNegated) {
          negativeScore += weight * 0.5;
          negativeCount++;
        } else {
          positiveScore += weight;
          positiveCount++;
        }
      }
    }
  }

  // Check negative keywords
  for (const [word, weight] of Object.entries(NEGATIVE_WORDS)) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        const wordIndex = text.indexOf(match.toLowerCase());
        const isNegated = checkNegation(words, wordIndex);
        if (isNegated) {
          positiveScore += Math.abs(weight) * 0.3;
          positiveCount++;
        } else {
          negativeScore += Math.abs(weight);
          negativeCount++;
        }
      }
    }
  }

  // Calculate final score (0 to 1)
  const totalSentiment = positiveScore + negativeScore;
  let score: number;
  if (totalSentiment === 0) {
    score = 0.5; // neutral
  } else {
    score = positiveScore / totalSentiment;
  }

  // Boost extremes slightly
  if (positiveScore > 3) score = Math.min(score + 0.05, 1.0);
  if (negativeScore > 3) score = Math.max(score - 0.05, 0.0);

  // Determine label
  let label: string;
  const hasPositive = positiveCount > 0;
  const hasNegative = negativeCount > 0;

  if (!hasPositive && !hasNegative) {
    label = 'neutral';
  } else if (hasPositive && hasNegative) {
    const ratio = positiveCount / (positiveCount + negativeCount);
    if (ratio > 0.7) label = 'positive';
    else if (ratio < 0.3) label = 'negative';
    else label = 'mixed';
  } else if (hasPositive) {
    label = score > 0.6 ? 'positive' : 'neutral';
  } else {
    label = score < 0.4 ? 'negative' : 'neutral';
  }

  // Detect categories
  const categories = detectCategories(text);

  return { score: Math.round(score * 100) / 100, label, categories };
}

/**
 * Detect categories mentioned in the review text
 */
function detectCategories(text: string): string[] {
  const detected: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
      if (regex.test(text)) {
        if (!detected.includes(category)) {
          detected.push(category);
        }
        break; // One keyword match per category is enough
      }
    }
  }

  return detected;
}

/**
 * Check if a word at a given index is negated
 */
function checkNegation(words: string[], targetWordIndex: number): boolean {
  // Look back up to 3 words for negation
  const lookback = Math.min(3, targetWordIndex);
  const startIndex = Math.max(0, targetWordIndex - lookback);

  for (let i = startIndex; i < targetWordIndex; i++) {
    const word = words[i]?.replace(/[.,!?;:'"]/g, '');
    if (word && NEGATION_WORDS.has(word.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Escape special regex characters in a word
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
