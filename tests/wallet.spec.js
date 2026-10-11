import { test, expect } from '@playwright/test';

const address = '1'.repeat(32), nextAddress = '1'.repeat(31) + '2';

async function setup(page, names = ['Phantom', 'Solflare']) {
  await page.addInitScript(({ names, address }) => {
    const calls = [], providers = {}, removers = {};
    let registry;
    const account = (value = address) => ({ address: value, publicKey: Uint8Array.from({ length: 32 }, (_, i) => i === 31 && value.endsWith('2') ? 1 : 0), chains: ['solana:mainnet'], features: [] });
    function add(name, initialized = true) {
      const listeners = new Set();
      const provider = {
        version: '1.0.0', name, icon: 'data:image/svg+xml;base64,', chains: ['solana:mainnet'], accounts: [account()], mode: 'approve',
        features: {
          'standard:connect': { version: '1.0.0', connect: async options => {
            calls.push({ name, method: 'connect', options });
            if (provider.mode === 'reject') throw Object.assign(new Error('User rejected request'), { code: 4001 });
            if (provider.mode === 'locked') throw new Error('Wallet is locked');
            if (provider.mode === 'interrupted') throw new Error('Port closed');
            if (provider.mode === 'pending') return new Promise(resolve => { provider.resolve = resolve; });
            if (provider.mode === 'evm') return { accounts: [{ ...account(), chains: ['eip155:1'] }] };
            if (provider.mode === 'invalid') return { accounts: [{ ...account(), address: 'bad' }] };
            if (!provider.accounts.length) provider.accounts = [account()];
            return { accounts: provider.accounts };
          } },
          'standard:disconnect': { version: '1.0.0', disconnect: async () => {
            calls.push({ name, method: 'disconnect' });
            if (provider.mode === 'disconnect-error') throw new Error('Disconnected port');
            provider.change([]);
          } },
          'standard:events': { version: '1.0.0', on: (event, listener) => { listeners.add(listener); return () => listeners.delete(listener); } },
          'solana:signTransaction': { signTransaction: () => { throw new Error('Signing must never be called'); } },
        },
        change(accounts) { provider.accounts = accounts; [...listeners].forEach(listener => listener({ accounts })); },
        listenerCount: () => listeners.size,
      };
      if (!initialized) delete provider.features['standard:connect'];
      providers[name] = provider;
      if (registry) removers[name] = registry.register(provider);
      return provider;
    }
    names.forEach(name => add(name));
    window.addEventListener('wallet-standard:app-ready', event => {
      registry = event.detail;
      Object.values(providers).forEach(provider => { removers[provider.name] = registry.register(provider); });
    });
    window.walletTest = { calls, providers, add, account, remove: name => removers[name]() };
  }, { names, address });
  await page.goto('/');
}
const open = page => page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
const select = (page, name) => page.getByRole('button', { name: `Connect ${name}`, exact: true }).click();
const connectedButton = page => page.getByRole('button', { name: /Solana wallet .*Open wallet details/ });

test('missing extensions show official installation links; simulator works without a wallet', async ({ page }) => {
  await setup(page, ['Other Wallet']);
  await open(page);
  await expect(page.getByText('STATUS: NOT DETECTED')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Install Phantom browser extension' })).toHaveAttribute('href', 'https://phantom.com/download');
  await expect(page.getByRole('link', { name: 'Install Solflare browser extension' })).toHaveAttribute('href', 'https://www.solflare.com/download/');
  await expect(page.getByRole('button', { name: 'Connect Phantom' })).toHaveCount(0);
  await page.screenshot({ path: '/tmp/whatif-wallet-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '[ EXPLORE A TRADE ]', exact: true }).click();
  await expect(page.getByText('MEMORY / USD TIMELINE LOADED.')).toBeVisible();
  await page.getByRole('button', { name: /OPEN TIMELINE/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => walletTest.calls)).toEqual([]);
});

for (const name of ['Phantom', 'Solflare']) {
  test(`${name}: explicit selected-provider connection, terminal output, clipboard, disconnect, refresh`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setup(page);
    expect(await page.evaluate(() => walletTest.calls)).toEqual([]);
    await open(page); await select(page, name);
    await expect(connectedButton(page)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('log').getByText('CONNECTION ESTABLISHED')).toBeVisible();
    expect(await page.evaluate(() => walletTest.calls)).toEqual([{ name, method: 'connect', options: { silent: false } }]);
    await connectedButton(page).click();
    await expect(page.getByRole('dialog', { name: 'Connected wallet' }).getByRole('heading', { name })).toBeVisible();
    await expect(page.getByLabel('Full public address')).toHaveText(address);
    if (name === 'Phantom') await page.screenshot({ path: '/tmp/whatif-wallet-connected.png' });
    await page.getByRole('button', { name: 'COPY ADDRESS', exact: true }).click();
    await expect(page.getByText('Full address copied.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
    await expect(page.getByRole('link', { name: 'VIEW ON SOLSCAN' })).toHaveAttribute('href', `https://solscan.io/account/${address}`);
    await page.getByRole('button', { name: 'DISCONNECT WALLET' }).click();
    await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
    expect(await page.evaluate(() => walletTest.calls.at(-1))).toEqual({ name, method: 'disconnect' });
    await open(page); await select(page, name);
    await expect(connectedButton(page)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
    expect(await page.evaluate(() => ({ calls: walletTest.calls, local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }))).toEqual({ calls: [], local: 0, session: 0, cookie: '' });
  });
}

test('account changes, revoked access and provider removal reset the session', async ({ page }) => {
  await setup(page); await open(page); await select(page, 'Phantom');
  await expect(connectedButton(page)).toBeVisible();
  await page.evaluate(value => walletTest.providers.Phantom.change([walletTest.account(value)]), nextAddress);
  await expect(connectedButton(page)).toContainText('1111...1112');
  await page.evaluate(() => walletTest.providers.Phantom.change([]));
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
  await open(page); await select(page, 'Solflare');
  await expect(connectedButton(page)).toBeVisible();
  await page.evaluate(() => walletTest.remove('Solflare'));
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
  expect(await page.evaluate(() => walletTest.providers.Solflare.listenerCount())).toBe(0);
});

for (const [mode, message] of [['reject', 'Connection rejected.'], ['locked', 'Wallet locked.'], ['interrupted', 'Connection interrupted.'], ['evm', 'did not authorize a valid Solana account'], ['invalid', 'did not authorize a valid Solana account']]) {
  test(`${mode} leaves a disconnected, retryable session`, async ({ page }) => {
    await setup(page);
    await page.evaluate(mode => { walletTest.providers.Phantom.mode = mode; }, mode);
    await open(page); await select(page, 'Phantom');
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(connectedButton(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Connect Phantom' })).toBeEnabled();
    await page.evaluate(() => { walletTest.providers.Phantom.mode = 'approve'; });
    await select(page, 'Phantom'); await expect(connectedButton(page)).toBeVisible();
  });
}

test('late registration and uninitialized providers update without opening a popup', async ({ page }) => {
  await setup(page, []); await open(page);
  await page.evaluate(() => walletTest.add('Phantom', false));
  await expect(page.getByText('NOT INITIALIZED', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Phantom' })).toBeDisabled();
  await page.evaluate(() => walletTest.add('Solflare'));
  await expect(page.getByRole('button', { name: 'Connect Solflare' })).toBeEnabled();
  expect(await page.evaluate(() => walletTest.calls)).toEqual([]);
  await select(page, 'Solflare'); await expect(connectedButton(page)).toBeVisible();
});

test('cancelled and timed-out requests ignore late approval', async ({ page }) => {
  await setup(page); await page.clock.install();
  await page.evaluate(() => { walletTest.providers.Phantom.mode = 'pending'; });
  await open(page); await select(page, 'Phantom');
  await expect(page.getByText(/Waiting for Phantom approval/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Solflare' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.evaluate(() => walletTest.providers.Phantom.resolve({ accounts: [walletTest.account()] }));
  await expect(connectedButton(page)).toHaveCount(0);
  await open(page); await select(page, 'Phantom');
  await page.clock.fastForward(60001);
  await expect(page.getByRole('alert')).toContainText('Connection timed out');
  await page.evaluate(() => walletTest.providers.Phantom.resolve({ accounts: [walletTest.account()] }));
  await expect(connectedButton(page)).toHaveCount(0);
});

test('disconnect failure clears local state; clipboard failure gives a manual alternative', async ({ page }) => {
  await setup(page); await open(page); await select(page, 'Phantom');
  await connectedButton(page).click();
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
  await page.getByRole('button', { name: 'COPY ADDRESS', exact: true }).click();
  await expect(page.getByText(/Clipboard unavailable/)).toBeVisible();
  await page.evaluate(() => { walletTest.providers.Phantom.mode = 'disconnect-error'; });
  await page.getByRole('button', { name: 'DISCONNECT WALLET' }).click();
  await open(page);
  await expect(page.getByRole('alert')).toContainText('could not confirm disconnection');
});

test('mobile excludes providers and explains desktop requirement without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => { Object.defineProperty(navigator, 'userAgent', { value: 'iPhone' }); });
  await setup(page);
  await open(page);
  await expect(page.getByText(/Desktop browser extensions are required/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Phantom' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connect Solflare' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/whatif-wallet-mobile.png' });
});

test('keyboard modal focus stays trapped and reduced-motion is respected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page); await open(page);
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('.wallet-modal').contains(document.activeElement))).toBe(true);
  }
  expect(await page.locator('.wallet-modal .cursor').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeFocused();
});
