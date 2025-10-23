import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { webcrypto } from "node:crypto";
import { ENCRYPTION_KEY, LYREBIRD_URL } from "$env/static/private";

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
 * Encrypts patient data using AES-256-CBC encryption
 * This matches the encryption format expected by Lyrebird's secure launch
 */
async function encryptPatientData(
  data: PatientData,
  keyHex: string,
): Promise<string> {
  // Convert data to form-encoded string (key1=value1&key2=value2)
  const dataStr = Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // Generate random IV (16 bytes)
  const iv = webcrypto.getRandomValues(new Uint8Array(16));

  // Import the encryption key
  const key = Buffer.from(keyHex, "hex");
  const cryptoKey = await webcrypto.subtle.importKey(
    "raw",
    key,
    "AES-CBC",
    false,
    ["encrypt"],
  );

  // Encrypt the data
  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    cryptoKey,
    new TextEncoder().encode(dataStr),
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Base64 encode and URL encode
  const base64 = Buffer.from(combined).toString("base64");
  return encodeURIComponent(base64);
}

/**
 * Validates that an encryption key is in the correct format
 */
function isValidEncryptionKey(encryptionKey: string): boolean {
  // Check if it's a valid hex string
  if (!/^[0-9a-fA-F]+$/.test(encryptionKey)) {
    return false;
  }

  // AES-256 requires 64 hex characters (32 bytes)
  const validLengths = [32, 48, 64];
  return validLengths.includes(encryptionKey.length);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Validate encryption key
    if (!ENCRYPTION_KEY || !isValidEncryptionKey(ENCRYPTION_KEY)) {
      return json(
        {
          error:
            "Invalid or missing ENCRYPTION_KEY. Must be a 32, 48, or 64 character hex string.",
        },
        { status: 500 },
      );
    }

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

    // Encrypt the patient data
    const encryptedPayload = await encryptPatientData(
      patientData,
      ENCRYPTION_KEY,
    );

    // Generate the secure launch URL
    const url = `${LYREBIRD_URL}/app?encryptedPayload=${encryptedPayload}`;

    return json({ url, encryptedPayload });
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
