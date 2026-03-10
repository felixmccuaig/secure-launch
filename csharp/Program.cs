using System.Text.Encodings.Web;
using System.Text.Json;
using SecureLaunchDemo;

var lyrebirdPublicKey = Environment.GetEnvironmentVariable("LYREBIRD_PUBLIC_KEY");
var lyrebirdUrl = Environment.GetEnvironmentVariable("LYREBIRD_URL") ?? "https://app.lyrebirdhealth.com";

if (string.IsNullOrEmpty(lyrebirdPublicKey))
{
    Console.Error.WriteLine("Error: LYREBIRD_PUBLIC_KEY environment variable is not set.");
    Console.Error.WriteLine("Set it to the base64-encoded JWK public key from Lyrebird's API settings.");
    Environment.Exit(1);
}

if (!SecureLaunch.IsValidPublicKey(lyrebirdPublicKey))
{
    Console.Error.WriteLine("Error: LYREBIRD_PUBLIC_KEY is not a valid base64-encoded EC P-256 JWK.");
    Environment.Exit(1);
}

// Mock patient data (same as the SvelteKit demo)
var patientData = new PatientData
{
    PAT_FIRST_NAME = "John",
    PAT_LAST_NAME = "Smith",
    PAT_GENDER = "M",
    PAT_DOB = "19850615",
    PAT_ACCT = "PAT_12345",
    PAT_MRN = "MRN_98765",
    USER = "DR_789",
    USER_NAME = "Dr. Jane Wilson",
    USER_EMAIL = "jane.wilson@clinic.com",
};

Console.WriteLine("Generating secure launch URL...");
Console.WriteLine();

var url = SecureLaunch.GenerateLaunchUrl(patientData, lyrebirdPublicKey, lyrebirdUrl);

Console.WriteLine($"Launch URL: {url}");
Console.WriteLine();

// Also show the encrypted payload for debugging
var payload = SecureLaunch.EncryptPatientData(patientData, lyrebirdPublicKey);
Console.WriteLine("Encrypted payload:");
Console.WriteLine(JsonSerializer.Serialize(payload, new JsonSerializerOptions
{
    WriteIndented = true,
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
}));
