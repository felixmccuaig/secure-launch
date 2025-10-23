# Secure Launch Demo - Lyrebird Health Integration

This is a minimal SvelteKit application that demonstrates how to implement secure launch with Lyrebird Health. It simulates an EMR system launching Lyrebird with encrypted patient context.

## Features

- Mock patient record page
- Secure launch button that opens Lyrebird with encrypted patient data
- AES-256-CBC encryption matching Lyrebird's secure launch specification
- Environment-based configuration for encryption keys

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

   Generate a secure encryption key (32 bytes = 64 hex characters for AES-256):
   ```bash
   openssl rand -hex 32
   ```

   Update `.env` with your encryption key:
   ```
   ENCRYPTION_KEY=your_64_character_hex_key_here
   PUBLIC_LYREBIRD_URL=https://app.lyrebirdhealth.com
   ```

   **Important:** This encryption key must match the key configured in your Lyrebird organization's API settings.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3001`

## How It Works

### Encryption Process

1. Patient data is structured as key-value pairs:
   ```
   PAT_FIRST_NAME=John&PAT_LAST_NAME=Smith&PAT_GENDER=M&...
   ```

2. Data is encrypted using AES-256-CBC:
   - A random 16-byte IV (Initialization Vector) is generated
   - Data is encrypted with the shared encryption key
   - IV and ciphertext are combined
   - Result is base64 encoded and URL encoded

3. Launch URL is generated:
   ```
   https://app.lyrebirdhealth.com/app?encryptedPayload=...
   ```

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

1. **Encryption Key Management:**
   - Never commit encryption keys to version control
   - Store keys securely in environment variables
   - Use different keys for development, staging, and production
   - Rotate keys periodically

2. **Key Sharing:**
   - The encryption key must be securely shared with Lyrebird
   - Configure the same key in your Lyrebird organization's API settings
   - Use secure channels for key distribution

3. **Production Deployment:**
   - Use environment-based configuration
   - Enable HTTPS for all communications
   - Implement proper access controls
   - Monitor and log secure launch attempts

## Integration with Lyrebird

To integrate this with your actual Lyrebird organization:

1. **Configure Secure Launch in Lyrebird:**
   - Log in to Lyrebird as an organization admin
   - Navigate to Organization → API
   - Click "Set Up" under Secure Launch
   - Save the generated encryption key

2. **Use the Encryption Key:**
   - Copy the encryption key from Lyrebird
   - Add it to your `.env` file as `ENCRYPTION_KEY`

3. **Test the Integration:**
   - Click "Open Lyrebird in Context" button
   - Verify patient data is pre-filled in Lyrebird
   - Check that a patient record is created

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

**"Invalid or missing ENCRYPTION_KEY" error:**
- Verify your `.env` file exists and contains `ENCRYPTION_KEY`
- Ensure the key is a valid 64-character hex string
- Generate a new key using: `openssl rand -hex 32`

**Patient data not showing in Lyrebird:**
- Verify the encryption key matches between your app and Lyrebird
- Check browser console for errors
- Ensure all required fields are provided

**"Secure launch is not enabled" error in Lyrebird:**
- Configure secure launch in Lyrebird's API settings first
- Verify you're using the correct organization

## Learn More

- [Lyrebird Health Documentation](https://help.lyrebirdhealth.com)
- [SvelteKit Documentation](https://kit.svelte.dev)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
