# WhatIf — Your past is playable

React/JavaScript visual experience with a code-drawn 2D pixel landscape, GSAP parallax, Motion transitions, and a Three.js collectible coin. Audio is opt-in; no persistent storage, backend, or user tracking. Optional desktop wallet connections are read-only.

Run `npm install`, then `npm run dev`. Check with `npm test` and `npm run build`.

Transaction formats are detected locally: EVM uses `0x` plus 64 hex characters; Solana uses Base58 decoding and exactly 64 decoded bytes (including leading zero bytes). Invalid input never calls RPC. EVM hashes cannot identify their chain, so select Ethereum, Base, or Arbitrum One; Solana signatures automatically use mainnet. Other networks are explicitly unsupported.

Real lookups call PublicNode EVM and Solana mainnet JSON-RPC directly from the browser, verify network identity and transaction identity, and check an EVM receipt when mined. The UI distinguishes invalid format, not found on the selected network, unsupported network, and API failure. Requests time out after 20 seconds and are cancelled when input changes or a demo loads. Public RPC availability, browser CORS policies, rate limits, and retained history may limit lookups. Verification trusts the RPC response; it is not independent cryptographic proof. Never place secret API keys in frontend code.

“Try Demo Trade” loads a local synthetic historical trade without any RPC calls. All fictional results display “DEMO MODE.” No transaction data is stored. The original workspace had no trade-analysis engine; live results show verified transaction details, not fabricated historical prices, swap interpretation, or simulated outcomes.

Protocol references: [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/), [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction), [PublicNode endpoints](https://www.publicnode.com/).

Pixelify Sans and DM Sans load from Google Fonts; system fonts are used if unavailable. Artwork is original SVG, with no downloaded image dependencies. Reduced-motion preferences disable environmental animation.

## Optional wallet connection

The header uses `@wallet-standard/app` discovery and each selected provider’s `standard:connect`, `standard:events`, and `standard:disconnect` features. Only exact Phantom and Solflare registrations with Solana chains and compatible features are enabled. No global provider, wallet adapters, embedded SDKs, mobile redirects, signing, or transaction methods are used. Mobile/in-app browsers are excluded. The simulator never depends on a wallet.

Connections and logs exist only in React memory. Refresh requires another Connect click, even if the extension retains site permissions. `{ silent: false }` requests the extension’s approval flow; the extension controls whether already-authorized sites see another popup. A site cannot force wallets to forget an earlier approval. Cancellation/timeout discards late responses locally; close pending extension popups yourself. If extension disconnect fails, the app clears its session and explains how to revoke site access.

Wallet Standard registrations have no authenticated extension identity or transport field. We accept only the named standard providers on desktop, reject duplicate names, and ship no web/mobile connection fallbacks. As with other browser dapps, this trusts installed extensions and the page environment. An undetected wallet may be missing, disabled, or still initializing; late registrations update automatically. Optional SOL balance is omitted.

Run `npm run test:wallet` for browser acceptance checks using explicitly mocked Wallet Standard registrations. These exercise UI and permission-call handling, not real extension approval windows. For a real-extension smoke test, use a desktop browser with Phantom, Solflare, then both installed: connect each explicitly, approve/reject/unlock in the extension, switch the authorized Solana account, revoke access, copy the address, and refresh. Also verify installation links with both disabled and run a simulation while disconnected. No funded wallet is needed.

Wallet references: [Wallet Standard discovery](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/app/src/wallets.ts), [permission request semantics](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/features/src/connect.ts). Bundled provider icons come from the MIT-licensed [Anza wallet adapters](https://github.com/anza-xyz/wallet-adapter) (Phantom and Solflare); brand marks belong to their owners.
