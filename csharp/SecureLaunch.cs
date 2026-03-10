using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SecureLaunchDemo;

/// <summary>
/// Patient data fields for the secure launch payload.
/// </summary>
public class PatientData
{
    // Required fields
    public required string PAT_FIRST_NAME { get; set; }
    public required string PAT_LAST_NAME { get; set; }
    public required string PAT_GENDER { get; set; }
    public required string PAT_ACCT { get; set; }
    public required string USER { get; set; }

    // Optional fields
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PAT_DOB { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PAT_MRN { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? USER_NAME { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? USER_EMAIL { get; set; }
}

/// <summary>
/// Encrypted payload structure for Secure Launch V2 (ECIES).
/// </summary>
public class EncryptedPayload
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = "1.1";

    [JsonPropertyName("ephemeralPublicKey")]
    public required string EphemeralPublicKey { get; set; }

    [JsonPropertyName("ciphertext")]
    public required string Ciphertext { get; set; }

    [JsonPropertyName("iv")]
    public required string Iv { get; set; }

    [JsonPropertyName("authTag")]
    public required string AuthTag { get; set; }
}

/// <summary>
/// JWK (JSON Web Key) representation for EC P-256 keys.
/// Matches the field order and extra fields that Web Crypto API's exportKey("jwk") produces.
/// </summary>
public class Jwk
{
    [JsonPropertyName("key_ops")]
    public string[] KeyOps { get; set; } = [];

    [JsonPropertyName("ext")]
    public bool Ext { get; set; } = true;

    [JsonPropertyName("kty")]
    public string Kty { get; set; } = "EC";

    [JsonPropertyName("x")]
    public required string X { get; set; }

    [JsonPropertyName("y")]
    public required string Y { get; set; }

    [JsonPropertyName("crv")]
    public string Crv { get; set; } = "P-256";

    [JsonPropertyName("d")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? D { get; set; }
}

/// <summary>
/// Implements Secure Launch V2 encryption using ECIES (Elliptic Curve Integrated Encryption Scheme)
/// with ECDH P-256 and AES-256-GCM.
/// </summary>
public static class SecureLaunch
{
    // Use relaxed encoding to match JavaScript's JSON.stringify output.
    // The default encoder escapes '+' as '\u002B' which produces different URLs.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>
    /// Encrypts patient data using ECIES and returns the encrypted payload.
    /// </summary>
    public static EncryptedPayload EncryptPatientData(PatientData data, string base64PublicKey)
    {
        // Decode and parse the Lyrebird public key (base64-encoded JWK)
        var publicKeyJson = Encoding.UTF8.GetString(Convert.FromBase64String(base64PublicKey));
        var lyrebirdJwk = JsonSerializer.Deserialize<Jwk>(publicKeyJson)
            ?? throw new InvalidOperationException("Failed to parse public key JWK");

        if (lyrebirdJwk.Kty != "EC" || lyrebirdJwk.Crv != "P-256")
            throw new InvalidOperationException("Public key must be an EC key with P-256 curve");

        // Import Lyrebird's public key
        using var lyrebirdPublicKey = ECDiffieHellman.Create(new ECParameters
        {
            Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint
            {
                X = Base64UrlDecode(lyrebirdJwk.X),
                Y = Base64UrlDecode(lyrebirdJwk.Y),
            }
        });

        // Generate ephemeral ECDH keypair
        using var ephemeralKey = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        var ephemeralParams = ephemeralKey.ExportParameters(includePrivateParameters: false);

        // Export ephemeral public key as JWK
        var ephemeralPublicJwk = new Jwk
        {
            X = Base64UrlEncode(ephemeralParams.Q.X!),
            Y = Base64UrlEncode(ephemeralParams.Q.Y!),
        };

        // Derive shared secret via ECDH
        // Web Crypto API's deriveKey with ECDH + AES-GCM uses the raw x-coordinate
        // of the ECDH shared point as key material. For P-256 this is exactly 32 bytes,
        // which matches AES-256's key size.
        var aesKey = ephemeralKey.DeriveRawSecretAgreement(lyrebirdPublicKey.PublicKey);

        // Create payload with timestamp
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var payload = new
        {
            timestamp,
            patientData = data,
        };
        var plaintext = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload, JsonOptions));

        // Generate random IV (12 bytes for AES-GCM)
        var iv = RandomNumberGenerator.GetBytes(12);

        // Encrypt with AES-256-GCM
        var ciphertext = new byte[plaintext.Length];
        var authTag = new byte[16]; // 128-bit auth tag

        using var aesGcm = new AesGcm(aesKey, tagSizeInBytes: 16);
        aesGcm.Encrypt(iv, plaintext, ciphertext, authTag);

        return new EncryptedPayload
        {
            EphemeralPublicKey = Convert.ToBase64String(
                Encoding.UTF8.GetBytes(JsonSerializer.Serialize(ephemeralPublicJwk, JsonOptions))),
            Ciphertext = Convert.ToBase64String(ciphertext),
            Iv = Convert.ToBase64String(iv),
            AuthTag = Convert.ToBase64String(authTag),
        };
    }

    /// <summary>
    /// Generates the full secure launch URL for Lyrebird.
    /// </summary>
    public static string GenerateLaunchUrl(PatientData data, string base64PublicKey, string lyrebirdUrl)
    {
        var encryptedPayload = EncryptPatientData(data, base64PublicKey);
        var payloadJson = JsonSerializer.Serialize(encryptedPayload, JsonOptions);
        var encodedPayload = Uri.EscapeDataString(payloadJson);
        return $"{lyrebirdUrl}/app?encryptedPayload={encodedPayload}";
    }

    /// <summary>
    /// Validates that a base64-encoded public key is in the correct format.
    /// </summary>
    public static bool IsValidPublicKey(string base64PublicKey)
    {
        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(base64PublicKey));
            var jwk = JsonSerializer.Deserialize<Jwk>(json);
            return jwk is { Kty: "EC", Crv: "P-256" }
                && !string.IsNullOrEmpty(jwk.X)
                && !string.IsNullOrEmpty(jwk.Y);
        }
        catch
        {
            return false;
        }
    }

    // Base64url decode (RFC 7515) - used for JWK parameters
    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }

    // Base64url encode (RFC 7515) - used for JWK parameters
    private static string Base64UrlEncode(byte[] input)
    {
        return Convert.ToBase64String(input)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
