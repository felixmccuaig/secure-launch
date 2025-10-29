import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { webcrypto } from "node:crypto";
import { LYREBIRD_PUBLIC_KEY, LYREBIRD_URL } from "$env/static/private";

interface PatientData {
  PAT_FIRST_NAME: string;
  PAT_LAST_NAME: string;
  PAT_GENDER: string;
  PAT_DOB: string;
  PAT_ACCT: string;
  PAT_MRN?: string;
  USER: string;
  USER_NAME?: string;
  USER_EMAIL?: string;
}

/**
 * Encrypted payload structure for V2 (ECIES)
 */
interface EncryptedPayload {
  version: "1.1";
  ephemeralPublicKey: string; // Base64 encoded ephemeral public key (JWK)
  ciphertext: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector for AES-GCM
  authTag: string; // Base64 encoded authentication tag for AES-GCM
}

/**
 * Derive AES-256-GCM key from ECDH shared secret
 */
async function deriveAESKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  return await webcrypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256, // 256-bit key
    },
    false, // not extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts patient data using ECIES (Elliptic Curve Integrated Encryption Scheme)
 * This is the V2 secure launch format using ECDH with P-256 curve
 */
async function encryptPatientData(
  data: PatientData,
  publicKeyJWK: JsonWebKey,
): Promise<EncryptedPayload> {
  // Generate ephemeral keypair for this encryption
  const ephemeralKeyPair = await webcrypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256", // NIST P-256 curve
    },
    true, // extractable
    ["deriveKey", "deriveBits"],
  );

  // Export ephemeral keys
  const ephemeralPublicKeyJWK = await webcrypto.subtle.exportKey(
    "jwk",
    ephemeralKeyPair.publicKey,
  );
  const ephemeralPrivateKeyJWK = await webcrypto.subtle.exportKey(
    "jwk",
    ephemeralKeyPair.privateKey,
  );

  // Import Lyrebird's public key
  const lyrebirdPublicKey = await webcrypto.subtle.importKey(
    "jwk",
    publicKeyJWK,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    [],
  );

  // Import ephemeral private key
  const ephemeralPrivateKey = await webcrypto.subtle.importKey(
    "jwk",
    ephemeralPrivateKeyJWK,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    ["deriveKey"],
  );

  // Derive shared AES key
  const sharedKey = await deriveAESKey(
    ephemeralPrivateKey,
    lyrebirdPublicKey,
  );

  // Create payload with metadata
  const timestamp = Date.now();
  const payload = {
    timestamp,
    patientData: data,
  };

  // Convert to JSON string
  const plaintext = JSON.stringify(payload);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = webcrypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-GCM
  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128, // 128-bit authentication tag
    },
    sharedKey,
    new TextEncoder().encode(plaintext),
  );

  // AES-GCM returns ciphertext + auth tag combined
  // Split them: last 16 bytes are the tag
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, -16);
  const authTag = encryptedArray.slice(-16);

  return {
    version: "1.1",
    ephemeralPublicKey: Buffer.from(
      JSON.stringify(ephemeralPublicKeyJWK),
    ).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    authTag: Buffer.from(authTag).toString("base64"),
  };
}

/**
 * Validates that a public key is in the correct format (base64-encoded JWK)
 */
function isValidPublicKey(publicKey: string): boolean {
  try {
    // Decode base64
    const decoded = globalThis.Buffer.from(publicKey, "base64").toString("utf-8");
    const jwk = JSON.parse(decoded) as JsonWebKey;

    // Validate it's an EC key with P-256 curve
    return jwk.kty === "EC" && jwk.crv === "P-256" && !!jwk.x && !!jwk.y;
  } catch {
    return false;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Validate public key
    if (!LYREBIRD_PUBLIC_KEY || !isValidPublicKey(LYREBIRD_PUBLIC_KEY)) {
      return json(
        {
          error:
            "Invalid or missing LYREBIRD_PUBLIC_KEY. Must be a base64-encoded JWK with EC P-256 curve.",
        },
        { status: 500 },
      );
    }

    // Parse Lyrebird's public key
    const publicKeyJson = globalThis.Buffer.from(LYREBIRD_PUBLIC_KEY, "base64").toString("utf-8");
    const publicKeyJWK = JSON.parse(publicKeyJson) as JsonWebKey;

    // Parse patient data from request
    const patientData: PatientData = await request.json();

    // Validate required fields
    const requiredFields = [
      "PAT_FIRST_NAME",
      "PAT_LAST_NAME",
      "PAT_GENDER",
      "PAT_ACCT",
      "USER",
    ];
    const missingFields = requiredFields.filter(
      (field) => !patientData[field as keyof PatientData],
    );

    if (missingFields.length > 0) {
      return json(
        {
          error: `Missing required fields: ${missingFields.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Encrypt the patient data using ECIES
    const encryptedPayload = await encryptPatientData(
      patientData,
      publicKeyJWK,
    );

    // Convert payload to JSON string and URL encode
    const payloadJson = JSON.stringify(encryptedPayload);
    const encodedPayload = encodeURIComponent(payloadJson);

    // Generate the secure launch URL
    const url = `${LYREBIRD_URL}/app?encryptedPayload=${encodedPayload}`;

    return json({ url, encryptedPayload: payloadJson });
  } catch (error) {
    console.error("Error generating secure launch URL:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate secure launch URL",
      },
      { status: 500 },
    );
  }
};
