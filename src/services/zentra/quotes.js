const logger = require('../../config/logger');

// Load quotes from external JSON to keep data clean and maintainable
const QUOTES = require('../../data/quotes.json');

/**
 * Simple hash function for deterministic randomness
 */
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = (hash << 5) - hash + char;
    // eslint-disable-next-line no-bitwise
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Get daily quote based on userId and date
 * Uses seed(userId + date) for deterministic daily selection
 * @param {string} userId - User ID
 * @param {string} [date] - Optional date string (YYYY-MM-DD or ISO). Defaults to today.
 * @returns {Object} Daily quote
 */
const getDailyQuote = (userId, date) => {
  const dateKey = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const seed = `${userId}-${dateKey}`;
  const hash = simpleHash(seed);
  const index = hash % QUOTES.length;

  const quote = QUOTES[index];

  logger.info('[Quotes] Selected quote #%d for user %s on %s', quote.id, userId, dateKey);

  return {
    id: quote.id,
    text: quote.text,
    author: quote.author,
    category: quote.category,
    date: dateKey,
  };
};

/**
 * Get all quotes (for admin/debugging)
 */
const getAllQuotes = () => QUOTES;

/**
 * Get quotes by category
 */
const getQuotesByCategory = (category) => QUOTES.filter((q) => q.category === category);

module.exports = {
  getDailyQuote,
  getAllQuotes,
  getQuotesByCategory,
  QUOTES,
};
