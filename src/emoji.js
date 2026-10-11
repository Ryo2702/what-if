const entry = (emoji, label) => Object.freeze({ emoji, label });
const outcome = (key, emoji, label) => Object.freeze({ key, emoji, label });

// One vocabulary keeps terminal text, wallet status, decisions, and results consistent.
export const emoji = Object.freeze({
  terminal: Object.freeze({
    scanning: entry('🔍', 'SCANNING TRANSACTION'),
    discovered: entry('👀', 'TRANSACTION DISCOVERED'),
    loading: entry('⏳', 'RECONSTRUCTING HISTORY'),
    verified: entry('✅', 'TRANSACTION VERIFIED'),
    purchase: entry('🪙', 'TOKEN PURCHASE DETECTED'),
    historyFound: entry('📈', 'HISTORICAL PRICE DATA FOUND'),
    complete: entry('🔥', 'SIMULATION COMPLETE'),
    warning: entry('⚠️', 'HISTORICAL DATA UNAVAILABLE'),
    error: entry('❌', 'OPERATION FAILED'),
    locked: entry('🔒', 'WALLET CONNECTION REJECTED'),
  }),
  wallet: Object.freeze({
    detecting: entry('🔍', 'DETECTING WALLET EXTENSIONS'),
    detected: entry('👛', 'WALLET DETECTED'),
    approval: entry('🔐', 'REQUESTING WALLET APPROVAL'),
    connected: entry('✅', 'WALLET CONNECTED'),
    address: entry('🔗', 'PUBLIC ADDRESS'),
    disconnected: entry('🔌', 'WALLET DISCONNECTED'),
    rejected: entry('❌', 'USER REJECTED CONNECTION'),
  }),
  reactions: Object.freeze({
    waiting: entry('⏳', 'WAITING FOR DATA'),
    success: entry('✅', 'SUCCESS'),
    purchase: entry('🪙', 'TOKEN PURCHASE'),
    positive: entry('🚀', 'POSITIVE SIMULATION'),
    loss: entry('💀', 'MAJOR LOSS'),
    error: entry('❌', 'ERROR'),
  }),
  decisions: Object.freeze([
    entry('💎', 'NEVER SOLD'),
    entry('🚀', 'SOLD AT ATH'),
    entry('⚖️', 'SOLD 50%, HELD 50%'),
    entry('🪙', 'BOUGHT 2× MORE'),
    entry('⏳', 'SOLD ONE DAY LATER'),
    entry('🛡️', 'TOOK INITIAL INVESTMENT AT 2×'),
    entry('🕰️', 'HELD UNTIL TODAY'),
  ]),
  outcomes: Object.freeze({
    FUMBLE: outcome('fumble', '💀', 'FUMBLE'),
    GREAT_ESCAPE: outcome('great_escape', '🫡', 'GREAT ESCAPE'),
    DIAMOND_HANDS: outcome('diamond_hands', '💎', 'DIAMOND HANDS'),
    TO_THE_MOON: outcome('to_the_moon', '🚀', 'TO THE MOON'),
    MARKET_CRASH: outcome('market_crash', '📉', 'MARKET CRASH'),
    UNKNOWN: outcome('unknown', '🤔', 'UNKNOWN OUTCOME'),
  }),
});

export function decisionEmoji(index) {
  return Number.isInteger(index) ? emoji.decisions[index] || null : null;
}

// This only recognizes states already emitted by the app; it never upgrades a warning into success.
export function terminalEmoji(line) {
  if (typeof line !== 'string') return null;
  const value = line.toUpperCase();
  if (/WALLET LOCKED/.test(value)) return emoji.terminal.locked;
  if (/WALLET CONNECTION (?:FAILED|TIMED OUT|CANCELLED)|USER REJECTED CONNECTION|NO AUTHORIZED SOLANA ACCOUNT/.test(value)) return emoji.wallet.rejected;
  if (/^STOPPED|INVALID (?:FORMAT|TRANSACTION)|REQUEST CANCELLED/.test(value)) return emoji.terminal.error;
  if (/HISTORICAL (?:PRICES|DATA|LIQUIDITY).*UNAVAILABLE|TRADE RECONSTRUCTION UNAVAILABLE/.test(value)) return emoji.terminal.warning;
  if (/WALLET DISCONNECTED|LOCAL SESSION CLEARED/.test(value)) return emoji.wallet.disconnected;
  if (/(?:PUBLIC )?ADDRESS:|WALLET ACCOUNT CHANGED/.test(value)) return emoji.wallet.address;
  if (/REQUESTING (?:PERMISSION|WALLET APPROVAL)/.test(value)) return emoji.wallet.approval;
  if (/INITIALIZING WALLET CONNECTION|DETECTING WALLET EXTENSION/.test(value)) return emoji.wallet.detecting;
  if (/^PROVIDER: (PHANTOM|SOLFLARE)/.test(value)) return emoji.wallet.detected;
  if (/CONNECTION ESTABLISHED|STATUS: CONNECTED/.test(value)) return emoji.wallet.connected;
  if (/TRANSACTION VERIFIED|NETWORK VERIFIED/.test(value)) return emoji.terminal.verified;
  if (/MARKET (?:SNAPSHOT )?MATCHED|FORMAT VALIDATED/.test(value)) return emoji.terminal.discovered;
  if (/VALIDATING INPUT|VERIFYING RPC|FETCHING (?:CURRENT )?MARKET SNAPSHOT/.test(value)) return emoji.terminal.scanning;
  if (/LOADING HISTORICAL|RECONSTRUCTING HISTORY/.test(value)) return emoji.terminal.loading;
  if (/TOKEN PURCHASE/.test(value)) return emoji.terminal.purchase;
  if (/HISTORICAL PRICE DATA FOUND|SCENARIO PRICE DATA FOUND/.test(value)) return emoji.terminal.historyFound;
  if (/ANALYSIS COMPLETE|TIMELINE COMPLETE|SIMULATION COMPLETE/.test(value)) return emoji.terminal.complete;
  return null;
}

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const closeEnough = (left, right) => Math.abs(left - right) <= Math.max(.005, Math.abs(left), Math.abs(right)) * 1e-9;
const materialGain = (value, scale = 1) => value > Math.max(.005, Math.abs(scale) * 1e-9);
const MOON_TOTAL_MULTIPLE = 5; // Five times contributed capital is the major-gain milestone.
const CRASH_ENDING_RATIO = .5; // Ending at least 50% below the scenario peak is a market crash.

function isCalculatedResult(result) {
  if (!result || !['total', 'contributed', 'profit', 'baselineProfit', 'difference', 'held'].every(key => isFiniteNumber(result[key]))) return false;
  return result.total >= 0 && result.held >= 0 && result.contributed > 0 && priceChange(result) && closeEnough(result.profit, result.total - result.contributed) && closeEnough(result.difference, result.profit - result.baselineProfit);
}

function priceChange(result) {
  const prices = result?.prices;
  if (!Array.isArray(prices) || prices.length < 2) return null;
  const entry = prices[0], ending = prices[prices.length - 1], peak = Math.max(...prices);
  return isFiniteNumber(entry) && entry > 0 && isFiniteNumber(ending) && ending >= 0 && isFiniteNumber(peak) ? { entry, ending, peak } : null;
}

function classified(outcome, comparison = emoji.outcomes.UNKNOWN, signals = []) {
  const frozenSignals = Object.freeze([...signals]);
  return Object.freeze({ outcome, primary: outcome, comparison, signals: frozenSignals });
}

/**
 * Returns a primary comparison plus compatible market signals. `reliable` must be
 * true only when the result has a reconstructed trade and price history. FUMBLE
 * and GREAT_ESCAPE therefore remain explicit whenever the profit comparison exists;
 * moon, crash, and holding states are exposed as signals instead of hiding it.
 */
export function classifyFinancialOutcome(result, { choice, reliable = false } = {}) {
  if (reliable !== true || (choice !== undefined && (!Number.isInteger(choice) || choice < 0 || choice >= emoji.decisions.length)) || !isCalculatedResult(result)) return classified(emoji.outcomes.UNKNOWN);

  const signals = [];
  const prices = priceChange(result);
  if (prices && prices.peak > prices.entry && prices.ending <= prices.peak * CRASH_ENDING_RATIO) signals.push(emoji.outcomes.MARKET_CRASH);
  if (result.total / result.contributed >= MOON_TOTAL_MULTIPLE) signals.push(emoji.outcomes.TO_THE_MOON);
  if (result.held > 0 && materialGain(result.profit, result.contributed)) signals.push(emoji.outcomes.DIAMOND_HANDS);

  const comparison = result.difference > Math.max(.005, Math.abs(result.baselineProfit) * 1e-9)
    ? emoji.outcomes.FUMBLE
    : result.difference < -Math.max(.005, Math.abs(result.baselineProfit) * 1e-9)
      ? emoji.outcomes.GREAT_ESCAPE
      : emoji.outcomes.UNKNOWN;
  return classified(comparison === emoji.outcomes.UNKNOWN ? signals[0] || comparison : comparison, comparison, signals);
}
