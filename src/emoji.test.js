import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFinancialOutcome, decisionEmoji, emoji, terminalEmoji } from './emoji.js';
import { reportLines, simulatePath } from './scenario.js';

test('all seven decisions have their required emoji and preserve their labels', () => {
  assert.deepEqual(emoji.decisions.map(({ emoji: symbol, label }) => [symbol, label]), [
    ['💎', 'NEVER SOLD'], ['🚀', 'SOLD AT ATH'], ['⚖️', 'SOLD 50%, HELD 50%'], ['🪙', 'BOUGHT 2× MORE'],
    ['⏳', 'SOLD ONE DAY LATER'], ['🛡️', 'TOOK INITIAL INVESTMENT AT 2×'], ['🕰️', 'HELD UNTIL TODAY'],
  ]);
  emoji.decisions.forEach((item, index) => assert.equal(decisionEmoji(index), item));
  assert.equal(decisionEmoji(7), null);
});

test('terminal mapping follows emitted wallet and transaction states', () => {
  assert.equal(terminalEmoji('VALIDATING INPUT...'), emoji.terminal.scanning);
  assert.equal(terminalEmoji('TRANSACTION VERIFIED · TRADE RECONSTRUCTION UNAVAILABLE'), emoji.terminal.warning);
  assert.equal(terminalEmoji('REQUESTING PERMISSION...'), emoji.wallet.approval);
  assert.equal(terminalEmoji('CONNECTION ESTABLISHED'), emoji.wallet.connected);
  assert.equal(terminalEmoji('ADDRESS: 7xK9...pQ2m'), emoji.wallet.address);
  assert.equal(terminalEmoji('WALLET CONNECTION FAILED. NO ACCOUNT CONNECTED.'), emoji.wallet.rejected);
  assert.equal(terminalEmoji('STOPPED · API failure'), emoji.terminal.error);
  assert.equal(terminalEmoji('SCENARIO PRICE DATA FOUND.'), emoji.terminal.historyFound);
});

test('financial classifier keeps profit comparison primary and exposes qualified signals', () => {
  assert.deepEqual(Object.values(emoji.outcomes).map(({ emoji: symbol, label }) => [symbol, label]), [
    ['💀', 'FUMBLE'], ['🫡', 'GREAT ESCAPE'], ['💎', 'DIAMOND HANDS'], ['🚀', 'TO THE MOON'], ['📉', 'MARKET CRASH'], ['🤔', 'UNKNOWN OUTCOME'],
  ]);
  const fumble = classifyFinancialOutcome(simulatePath(1, 1000, .7, 5, 3), { choice: 1, reliable: true });
  assert.equal(fumble.outcome, emoji.outcomes.FUMBLE);
  assert.equal(fumble.comparison, emoji.outcomes.FUMBLE);

  const escape = classifyFinancialOutcome(simulatePath(0, 1000, .7, 5, 3), { choice: 0, reliable: true });
  assert.equal(escape.outcome, emoji.outcomes.GREAT_ESCAPE);
  assert.equal(escape.comparison, emoji.outcomes.GREAT_ESCAPE);
  assert.ok(escape.signals.includes(emoji.outcomes.MARKET_CRASH));

  const hands = classifyFinancialOutcome(simulatePath(0, 1000, 2.4, 5, 3), { choice: 0, reliable: true });
  assert.equal(hands.outcome, emoji.outcomes.DIAMOND_HANDS);
  assert.equal(hands.comparison, emoji.outcomes.UNKNOWN);
  assert.ok(hands.signals.includes(emoji.outcomes.DIAMOND_HANDS));

  const moon = classifyFinancialOutcome(simulatePath(1, 1000, .7, 5, 8.6), { choice: 1, reliable: true });
  assert.equal(moon.outcome, emoji.outcomes.FUMBLE);
  assert.ok(moon.signals.includes(emoji.outcomes.TO_THE_MOON));

  const crash = classifyFinancialOutcome(simulatePath(0, 1000, .4, 5, 3), { choice: 0, reliable: true });
  assert.equal(crash.outcome, emoji.outcomes.GREAT_ESCAPE);
  assert.ok(crash.signals.includes(emoji.outcomes.MARKET_CRASH));

  const losingHold = classifyFinancialOutcome(simulatePath(0, 1000, .4, 5, 8.6), { choice: 0, reliable: true });
  assert.ok(!losingHold.signals.includes(emoji.outcomes.DIAMOND_HANDS));

  const equalThenCrash = classifyFinancialOutcome(simulatePath(4, 1000, .4, 5, 4.8), { choice: 4, reliable: true });
  assert.equal(equalThenCrash.outcome, emoji.outcomes.MARKET_CRASH);
});

test('unreconstructed, malformed, and ambiguous calculations stay unknown', () => {
  const result = simulatePath(1, 1000, .7, 5, 3);
  assert.equal(classifyFinancialOutcome(result, { choice: 1 }).outcome, emoji.outcomes.UNKNOWN);
  assert.equal(classifyFinancialOutcome({}, { reliable: true }).outcome, emoji.outcomes.UNKNOWN);
  assert.equal(classifyFinancialOutcome({ ...result, difference: 0 }, { choice: 1, reliable: true }).outcome, emoji.outcomes.UNKNOWN);
  assert.equal(classifyFinancialOutcome(result, { choice: 7, reliable: true }).outcome, emoji.outcomes.UNKNOWN);
});

test('share-card lines retain an emoji attempt and a textual outcome fallback', () => {
  const lines = reportLines({ choice: 0, investment: 1000, ending: .7, peak: 8.6, token: 'MEMORY', demo: true, decision: 'NEVER SOLD', outcome: emoji.outcomes.GREAT_ESCAPE });
  assert.ok(lines.includes('🫡 WHAT IF I NEVER SOLD?'));
  assert.ok(lines.some(line => line.startsWith('OUTCOME: GREAT ESCAPE')));
});
