export const moments = ['ENTRY', '2× MILESTONE', 'ORIGINAL EXIT', 'SCENARIO PEAK', '+1 DAY', 'ENDING'];
export const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

export function simulatePath(choice, investment, ending, step = 5, peak = 3) {
  if (!Number.isInteger(choice) || choice < 0 || choice > 6 || !Number.isFinite(investment) || investment <= 0 || investment > 1e9 || !Number.isFinite(peak) || peak < 2.4 || peak > 100 || !Number.isFinite(ending) || ending < 0 || ending > peak || !Number.isInteger(step) || step < 0 || step > 5) throw new RangeError('Choose a valid path, amount, and timeline step.');
  const prices = [1, 2, 2.4, peak, peak / 2, ending];
  let units = investment, cash = 0, contributed = investment;
  const actions = ['You enter the timeline. Your original position is still open.'];
  for (let day = 1; day <= step; day++) {
    let sold = 0;
    let action = units === 0 ? 'You already exited. Your cash stays unchanged as the market moves.' : 'You hold your remaining tokens. Their paper value moves with the market.';
    if (day === 1 && choice === 5) { sold = investment / 2; action = 'At 2×, you sell half. Your initial investment is back in cash; the rest stays in tokens.'; }
    if (day === 2 && choice === 2) { sold = units / 2; action = 'At the original exit, you sell 50% and keep 50% for another ending.'; }
    if (day === 2 && choice === 3) { units += investment * 2 / prices[day]; contributed += investment * 2; action = 'Instead of selling, you add twice your starting amount. Your total contribution is now 3× the original.'; }
    if (day === 3 && choice === 1) { sold = units; action = 'With perfect hindsight, you sell at the scenario peak. This assumes every token can sell at that price.'; }
    if (day === 4 && choice === 4) { sold = units; action = 'One day after the scenario peak, you sell everything at half the peak price.'; }
    if (day === 5 && choice === 6) { sold = units; action = 'You hold to the scenario ending, then sell all your tokens at the chosen price.'; }
    cash += sold * prices[day]; units -= sold;
    actions.push(action);
  }
  const held = units * prices[step], total = cash + held;
  const baseline = step >= 2 ? investment * 2.4 : investment * prices[step];
  return { prices, cash, held, total, contributed, profit: total - contributed, baseline, baselineProfit: baseline - investment, difference: total - contributed - (baseline - investment), actions };
}

export function reportLines({ choice, investment, ending, peak, token, demo, decision, outcome }) {
  const result = simulatePath(choice, investment, ending, 5, peak);
  const path = decision || `PATH ${String(choice + 1).padStart(2, '0')}`;
  const outcomeLabel = outcome?.label || 'UNKNOWN OUTCOME';
  return [
    'WHATIF // TIMELINE REPORT',
    `${demo ? 'MEMORY TIMELINE' : 'WHAT-IF TIMELINE'} | ${token}`,
    `${outcome?.emoji || '↳'} WHAT IF I ${path}?`,
    `OUTCOME: ${outcomeLabel} · ${money(Math.abs(result.difference))} VS BASELINE`,
    `SCENARIO: ${path}`,
    `Starting amount: ${money(investment)}`,
    `Total contributed: ${money(result.contributed)}`,
    `Baseline exit (assumed 2.4x): ${money(investment * 2.4)}`,
    `Baseline profit: ${money(investment * 1.4)}`,
    `Alternate value: ${money(result.total)}`,
    `Cash from modeled sales: ${money(result.cash)}`,
    `Tokens still held: ${money(result.held)}`,
    `Alternate profit / loss: ${money(result.profit)}`,
    `Profit difference: ${money(result.difference)}`,
    `Assumed peak: ${peak}x | Ending: ${ending}x entry`,
    'Source: price assumptions and starting amount entered in the timeline.',
    'Executable sale proceeds: unavailable.',
    'Historical liquidity: unavailable. Fees, taxes, slippage excluded.',
  ];
}

function drawOutcomeBadge(ctx, outcome) {
  if (!outcome) return;
  const color = outcome.key === 'great_escape' || outcome.key === 'market_crash' ? '#d88f88' : outcome.key === 'unknown' ? '#e8bd75' : '#a4e68a';
  ctx.fillStyle = '#112016'; ctx.fillRect(934, 42, 208, 74);
  ctx.strokeStyle = color; ctx.strokeRect(934, 42, 208, 74);
  ctx.font = '30px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; ctx.fillStyle = '#dcdcc7'; ctx.fillText(outcome.emoji, 950, 83);
  // The text label stays legible if this browser cannot draw a color emoji in Canvas.
  ctx.font = 'bold 10px monospace'; ctx.fillStyle = color; ctx.fillText(`[${outcome.label}]`, 990, 83, 136);
}

export async function exportReport(lines, outcome) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = Math.max(900, 126 + lines.length * 46);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PNG export is unavailable in this browser.');
  ctx.fillStyle = '#080D0B'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#334A3A'; ctx.lineWidth = 2; ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
  drawOutcomeBadge(ctx, outcome);
  lines.forEach((line, index) => {
    ctx.font = index === 0 ? 'bold 30px monospace, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' : '20px monospace, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillStyle = index === 0 ? '#A4E68A' : index < 3 ? '#E8BD75' : '#DCDCC7';
    ctx.fillText(line, 60, 80 + index * 46, 1080);
  });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create the PNG. Please try again.');
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'whatif-timeline-report.png'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
