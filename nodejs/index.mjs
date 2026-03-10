import { generateLaunchUrl, encryptPatientData, isValidPublicKey } from "./secure-launch.mjs";

const lyrebirdPublicKey = process.env.LYREBIRD_PUBLIC_KEY;
const lyrebirdUrl = process.env.LYREBIRD_URL || "https://app.lyrebirdhealth.com";

if (!lyrebirdPublicKey) {
  console.error("Error: LYREBIRD_PUBLIC_KEY environment variable is not set.");
  console.error("Set it to the base64-encoded JWK public key from Lyrebird's API settings.");
  process.exit(1);
}

if (!isValidPublicKey(lyrebirdPublicKey)) {
  console.error("Error: LYREBIRD_PUBLIC_KEY is not a valid base64-encoded EC P-256 JWK.");
  process.exit(1);
}

// Mock patient data (same as the SvelteKit demo)
const patientData = {
  PAT_FIRST_NAME: "John",
  PAT_LAST_NAME: "Smith",
  PAT_GENDER: "M",
  PAT_DOB: "19850615",
  PAT_ACCT: "PAT_12345",
  PAT_MRN: "MRN_98765",
  USER: "DR_789",
  USER_NAME: "Dr. Jane Wilson",
  USER_EMAIL: "jane.wilson@clinic.com",
};

console.log("Generating secure launch URL...\n");

const { url } = await generateLaunchUrl(patientData, lyrebirdPublicKey, lyrebirdUrl);
console.log(`Launch URL: ${url}\n`);

// Also show the encrypted payload for debugging
const payload = await encryptPatientData(patientData, lyrebirdPublicKey);
console.log("Encrypted payload:");
console.log(JSON.stringify(payload, null, 2));
