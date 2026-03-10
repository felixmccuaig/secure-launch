# Secure Launch Demo - Node.js Reference Implementation

Node.js reference implementation of Lyrebird Health's **Secure Launch V2** using ECIES (ECDH P-256 + AES-256-GCM).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (uses built-in `webcrypto`)

## Setup

1. Set environment variables:
   ```bash
   export LYREBIRD_PUBLIC_KEY=<base64-encoded-JWK-public-key>
   export LYREBIRD_URL=https://app.lyrebirdhealth.com
   ```

2. Run the demo:
   ```bash
   node index.mjs
   ```

## Integration

Import the functions directly into your Node.js application:

```js
import { generateLaunchUrl } from "./secure-launch.mjs";

const { url } = await generateLaunchUrl(
  {
    PAT_FIRST_NAME: "John",
    PAT_LAST_NAME: "Smith",
    PAT_GENDER: "M",
    PAT_DOB: "19850615",
    PAT_ACCT: "PAT_12345",
    USER: "DR_789",
  },
  publicKey,
  "https://app.lyrebirdhealth.com",
);
```

No external dependencies required — uses Node.js built-in `webcrypto`.

## How It Works

See the [main README](../README.md) for a full explanation of the ECIES encryption scheme.
