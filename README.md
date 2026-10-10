# WhatIf — Your past is playable

React/JavaScript visual experience with a code-drawn 2D pixel landscape, GSAP parallax, Motion transitions, and a Three.js collectible coin. Audio is opt-in; no storage, backend, wallet connection, or user tracking.

Run `npm install`, then `npm run dev`. Check with `npm test` and `npm run build`.

Transaction formats are detected locally: EVM uses `0x` plus 64 hex characters; Solana uses Base58 decoding and exactly 64 decoded bytes (including leading zero bytes). Invalid input never calls RPC. EVM hashes cannot identify their chain, so select Ethereum, Base, or Arbitrum One; Solana signatures automatically use mainnet. Other networks are explicitly unsupported.

Real lookups call PublicNode EVM and Solana mainnet JSON-RPC directly from the browser, verify network identity and transaction identity, and check an EVM receipt when mined. The UI distinguishes invalid format, not found on the selected network, unsupported network, and API failure. Requests time out after 20 seconds and are cancelled when input changes or a demo loads. Public RPC availability, browser CORS policies, rate limits, and retained history may limit lookups. Verification trusts the RPC response; it is not independent cryptographic proof. Never place secret API keys in frontend code.

“Try Demo Trade” loads a local synthetic historical trade without any RPC calls. All fictional results display “DEMO MODE.” No transaction data is stored. The original workspace had no trade-analysis engine; live results show verified transaction details, not fabricated historical prices, swap interpretation, or simulated outcomes.

Protocol references: [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/), [Solana getTransaction](https://solana.com/docs/rpc/http/gettransaction), [PublicNode endpoints](https://www.publicnode.com/).

Pixelify Sans and DM Sans load from Google Fonts; system fonts are used if unavailable. Artwork is original SVG, with no downloaded image dependencies. Reduced-motion preferences disable environmental animation.
