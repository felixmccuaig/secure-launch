# Secure Launch Demo - Lyrebird Health Integration (V2)

This is a minimal SvelteKit application that demonstrates how to implement **Secure Launch V2** with Lyrebird Health using **asymmetric encryption (ECDH with P-256)**. It simulates an EMR system launching Lyrebird with encrypted patient context.

## Features

- Mock patient record page
- Secure launch button that opens Lyrebird with encrypted patient data
- **ECIES (Elliptic Curve Integrated Encryption Scheme)** with ECDH P-256 curve
- AES-256-GCM authenticated encryption
- Timestamp validation to prevent replay attacks
- Environment-based configuration with public key

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with Lyrebird's public key:
   ```
   LYREBIRD_PUBLIC_KEY=<base64-encoded-public-key-from-lyrebird>
   LYREBIRD_URL=https://app.lyrebirdhealth.com
   ```

   **Important:** The public key must be obtained from your Lyrebird organization's API settings after setting up Secure Launch V2. This is a base64-encoded JWK (JSON Web Key) with an EC P-256 curve.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3001`

## How It Works

### Secure Launch V2 - Asymmetric Encryption with ECIES

Secure Launch V2 uses **ECIES (Elliptic Curve Integrated Encryption Scheme)** which combines the benefits of asymmetric and symmetric encryption:

1. **Key Generation (One-time setup in Lyrebird):**
   - Lyrebird generates an ECDH keypair using the P-256 curve (also known as secp256r1 or prime256v1)
   - The **public key** is shared with the EMR system
   - The **private key** is securely stored in Lyrebird and never leaves the system

2. **Encryption Process (Each launch):**
   - EMR generates an **ephemeral ECDH keypair** (temporary, used only for this encryption)
   - EMR performs ECDH key agreement between:
     - Ephemeral private key (EMR's temporary key)
     - Lyrebird's public key (static key)
   - This produces a **shared secret**
   - The shared secret is used to derive an **AES-256-GCM key**
   - Patient data + timestamp are encrypted with AES-GCM
   - The payload includes:
     - `version`: "1.1" (identifies V2 format)
     - `ephemeralPublicKey`: EMR's temporary public key (base64 JWK)
     - `ciphertext`: Encrypted patient data (base64)
     - `iv`: Initialization vector for AES-GCM (base64)
     - `authTag`: Authentication tag for integrity verification (base64)

3. **Decryption Process (Lyrebird side):**
   - Lyrebird receives the encrypted payload
   - Lyrebird performs ECDH key agreement between:
     - Its private key (static key)
     - Ephemeral public key from the payload (EMR's temporary key)
   - This produces the same **shared secret**
   - The shared secret derives the same **AES-256-GCM key**
   - Patient data is decrypted and timestamp is validated (must be within 5 minutes)

4. **Launch URL format:**
   ```
   https://app.lyrebirdhealth.com/app?encryptedPayload=<url-encoded-json>
   ```
   Where the JSON contains: `{"version":"1.1","ephemeralPublicKey":"...","ciphertext":"...","iv":"...","authTag":"..."}`

### Why V2 is More Secure

1. **No Shared Secrets:** Unlike V1 (AES-CBC with shared key), V2 uses public-key cryptography. The EMR never has access to Lyrebird's private key.

2. **Forward Secrecy:** Each encryption uses a new ephemeral keypair, so compromising one session doesn't affect others.

3. **Authenticated Encryption:** AES-GCM provides both confidentiality and integrity/authenticity in a single operation.

4. **Replay Attack Prevention:** Timestamps are included and validated (5-minute window).

5. **Standard Cryptography:** Uses NIST P-256 curve and standard ECIES construction, well-studied and widely implemented.

### Patient Data Fields

**Required fields:**
- `PAT_FIRST_NAME` - Patient first name
- `PAT_LAST_NAME` - Patient last name
- `PAT_GENDER` - Patient gender (M/F/U/O)
- `PAT_ACCT` - Patient account/ID number
- `USER` - Clinician user ID

**Optional fields:**
- `PAT_DOB` - Date of birth (YYYYMMDD format)
- `PAT_MRN` - Medical record number
- `USER_NAME` - Clinician full name
- `USER_EMAIL` - Clinician email

## Security Considerations

1. **Public Key Management:**
   - Public keys can be safely stored in environment variables and version control
   - The corresponding private key never leaves Lyrebird's secure storage
   - Public keys should still be validated before use

2. **Timestamp Validation:**
   - V2 includes timestamp validation (5-minute window)
   - This prevents replay attacks where an attacker tries to reuse old encrypted payloads
   - Ensure system clocks are synchronized (use NTP)

3. **Ephemeral Key Generation:**
   - A new ephemeral keypair is generated for each encryption
   - This provides forward secrecy - past sessions cannot be decrypted if the ephemeral key is compromised
   - The ephemeral private key is discarded immediately after encryption

4. **Production Deployment:**
   - Use environment-based configuration
   - Enable HTTPS for all communications
   - Implement proper access controls
   - Monitor and log secure launch attempts
   - Validate the integrity of patient data before encryption

## Integration with Lyrebird

To integrate this with your actual Lyrebird organization:

1. **Configure Secure Launch V2 in Lyrebird:**
   - Log in to Lyrebird as an organization admin
   - Navigate to Organization → API
   - Set up Secure Launch V2 (asymmetric encryption)
   - Lyrebird will generate an ECDH keypair and display the public key

2. **Copy the Public Key:**
   - Copy the base64-encoded public key from Lyrebird
   - Add it to your `.env` file as `LYREBIRD_PUBLIC_KEY`
   - The public key is in JWK format and looks like: `eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6Ii4uLiIsInkiOiIuLi4ifQ==`

3. **Test the Integration:**
   - Start your demo app: `npm run dev`
   - Click "Open Lyrebird in Context" button
   - Verify patient data is pre-filled in Lyrebird
   - Check that a patient record is created
   - The URL will contain a JSON payload with version "1.1"

## API Endpoint

### POST /api/secure-launch

Generates an encrypted launch URL for Lyrebird.

**Request Body:**
```json
{
  "PAT_FIRST_NAME": "John",
  "PAT_LAST_NAME": "Smith",
  "PAT_GENDER": "M",
  "PAT_DOB": "19850615",
  "PAT_ACCT": "PAT_12345",
  "PAT_MRN": "MRN_98765",
  "USER": "DR_789",
  "USER_NAME": "Dr. Jane Wilson",
  "USER_EMAIL": "jane.wilson@clinic.com"
}
```

**Response:**
```json
{
  "url": "https://app.lyrebirdhealth.com/app?encryptedPayload=...",
  "encryptedPayload": "..."
}
```

## Troubleshooting

**"Invalid or missing LYREBIRD_PUBLIC_KEY" error:**
- Verify your `.env` file exists and contains `LYREBIRD_PUBLIC_KEY`
- Ensure the key is a valid base64-encoded JWK with EC P-256 curve
- Get the public key from Lyrebird's API settings (Secure Launch V2 section)

**Patient data not showing in Lyrebird:**
- Verify the public key is correct and matches Lyrebird's V2 configuration
- Check browser console for errors
- Ensure all required fields are provided
- Verify your system clock is accurate (for timestamp validation)

**"Secure launch V2 is not enabled" error in Lyrebird:**
- Configure Secure Launch V2 in Lyrebird's API settings first
- Verify you're using the correct organization
- Ensure you set up V2 (asymmetric) not V1 (symmetric)

**"Encrypted payload has expired" error:**
- The payload timestamp is older than 5 minutes
- Check system clock synchronization on both EMR and Lyrebird servers
- Generate a fresh encrypted payload

## Learn More

- [Lyrebird Health Documentation](https://help.lyrebirdhealth.com)
- [SvelteKit Documentation](https://kit.svelte.dev)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
