# Secure Launch Demo - C# Reference Implementation

C# reference implementation of Lyrebird Health's **Secure Launch V2** using ECIES (ECDH P-256 + AES-256-GCM).

## Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) or later

## Setup

1. Set environment variables:
   ```bash
   export LYREBIRD_PUBLIC_KEY=<base64-encoded-JWK-public-key>
   export LYREBIRD_URL=https://app.lyrebirdhealth.com
   ```

2. Run the demo:
   ```bash
   dotnet run
   ```

## Integration

The `SecureLaunch` static class can be used directly in any .NET application:

```csharp
var patientData = new PatientData
{
    PAT_FIRST_NAME = "John",
    PAT_LAST_NAME = "Smith",
    PAT_GENDER = "M",
    PAT_DOB = "19850615",
    PAT_ACCT = "PAT_12345",
    USER = "DR_789",
};

var url = SecureLaunch.GenerateLaunchUrl(patientData, publicKey, "https://app.lyrebirdhealth.com");
```

## How It Works

See the [main README](../README.md) for a full explanation of the ECIES encryption scheme.
