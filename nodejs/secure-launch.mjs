import { webcrypto } from "node:crypto";

/**
 * @typedef {Object} PatientData
 * @property {string} PAT_FIRST_NAME - Patient first name (required)
 * @property {string} PAT_LAST_NAME - Patient last name (required)
 * @property {string} PAT_GENDER - Patient gender M/F/U/O (required)
 * @property {string} PAT_ACCT - Patient account/ID number (required)
 * @property {string} USER - Clinician user ID (required)
 * @property {string} [PAT_DOB] - Date of birth (YYYYMMDD)
 * @property {string} [PAT_MRN] - Medical record number
 * @property {string} [USER_NAME] - Clinician full name
 * @property {string} [USER_EMAIL] - Clinician email
 */

/**
 * @typedef {Object} EncryptedPayload
 * @property {"1.1"} version
 * @property {string} ephemeralPublicKey - Base64 encoded ephemeral public key (JWK)
 * @property {string} ciphertext - Base64 encoded encrypted data
 * @property {string} iv - Base64 encoded initialization vector
 * @property {string} authTag - Base64 encoded authentication tag
 */

const REQUIRED_FIELDS = [
  "PAT_FIRST_NAME",
  "PAT_LAST_NAME",
  "PAT_GENDER",
  "PAT_ACCT",
  "USER",
];

/**
 * Derives an AES-256-GCM key from an ECDH key agreement.
 * @param {CryptoKey} privateKey
 * @param {CryptoKey} publicKey
 * @returns {Promise<CryptoKey>}
 */
async function deriveAESKey(privateKey, publicKey) {
  return await webcrypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Validates that a base64-encoded public key is a valid EC P-256 JWK.
 * @param {string} base64PublicKey
 * @returns {boolean}
 */
export function isValidPublicKey(base64PublicKey) {
  try {
    const decoded = Buffer.from(base64PublicKey, "base64").toString("utf-8");
    const jwk = JSON.parse(decoded);
    return jwk.kty === "EC" && jwk.crv === "P-256" && !!jwk.x && !!jwk.y;
  } catch {
    return false;
  }
}

/**
 * Encrypts patient data using ECIES (ECDH P-256 + AES-256-GCM).
 * @param {PatientData} patientData
 * @param {string} base64PublicKey - Base64-encoded JWK public key from Lyrebird
 * @returns {Promise<EncryptedPayload>}
 */
export async function encryptPatientData(patientData, base64PublicKey) {
  // Validate required fields
  const missingFields = REQUIRED_FIELDS.filter((f) => !patientData[f]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  // Decode and parse Lyrebird's public key
  const publicKeyJson = Buffer.from(base64PublicKey, "base64").toString("utf-8");
  const publicKeyJWK = JSON.parse(publicKeyJson);

  // Generate ephemeral ECDH keypair
  const ephemeralKeyPair = await webcrypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
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
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Import ephemeral private key
  const ephemeralPrivateKey = await webcrypto.subtle.importKey(
    "jwk",
    ephemeralPrivateKeyJWK,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );

  // Derive shared AES key
  const sharedKey = await deriveAESKey(ephemeralPrivateKey, lyrebirdPublicKey);

  // Create payload with timestamp
  const payload = {
    timestamp: Date.now(),
    patientData,
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  // Generate random IV (12 bytes for AES-GCM)
  const iv = webcrypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-256-GCM
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    sharedKey,
    plaintext,
  );

  // AES-GCM returns ciphertext + auth tag combined; last 16 bytes are the tag
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
 * Generates a full secure launch URL for Lyrebird.
 * @param {PatientData} patientData
 * @param {string} base64PublicKey - Base64-encoded JWK public key from Lyrebird
 * @param {string} lyrebirdUrl - Lyrebird base URL
 * @returns {Promise<{url: string, encryptedPayload: string}>}
 */
export async function generateLaunchUrl(patientData, base64PublicKey, lyrebirdUrl) {
  const encryptedPayload = await encryptPatientData(patientData, base64PublicKey);
  const payloadJson = JSON.stringify(encryptedPayload);
  const encodedPayload = encodeURIComponent(payloadJson);
  return {
    url: `${lyrebirdUrl}/app?encryptedPayload=${encodedPayload}`,
    encryptedPayload: payloadJson,
  };
}
