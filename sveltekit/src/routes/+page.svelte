<script lang="ts">
  // Mock patient data - editable
  let mockPatient = {
    firstName: "John",
    lastName: "Smith",
    gender: "M",
    dateOfBirth: "1985-06-15",
    patientId: "PAT_12345",
    mrn: "MRN_98765",
    clinicianId: "DR_789",
    clinicianName: "Dr. Jane Wilson",
    clinicianEmail: "jane.wilson@clinic.com",
  };

  let isGenerating = false;
  let launchUrl = "";
  let errorMessage = "";

  async function launchLyrebird() {
    try {
      isGenerating = true;
      errorMessage = "";

      // Call our API endpoint to generate the encrypted payload
      const response = await fetch("/api/secure-launch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          PAT_FIRST_NAME: mockPatient.firstName,
          PAT_LAST_NAME: mockPatient.lastName,
          PAT_GENDER: mockPatient.gender,
          PAT_DOB: mockPatient.dateOfBirth.replace(/-/g, ""), // Format as YYYYMMDD
          PAT_ACCT: mockPatient.patientId,
          PAT_MRN: mockPatient.mrn,
          USER: mockPatient.clinicianId,
          USER_NAME: mockPatient.clinicianName,
          USER_EMAIL: mockPatient.clinicianEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate launch URL");
      }

      const data = await response.json();
      launchUrl = data.url;

      // Open Lyrebird in a new window
      window.open(launchUrl, "_blank");
    } catch (error) {
      console.error("Error launching Lyrebird:", error);
      errorMessage =
        error instanceof Error ? error.message : "Failed to launch Lyrebird";
    } finally {
      isGenerating = false;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
</script>

<div class="container">
  <header>
    <h1>EMR System - Mock Patient Record</h1>
    <p class="subtitle">Secure Launch Demo with Lyrebird Health</p>
  </header>

  <main>
    <div class="patient-card">
      <div class="card-header">
        <h2>Patient Information</h2>
        <span class="badge">Active</span>
      </div>

      <div class="patient-details">
        <div class="detail-row">
          <span class="label">First Name:</span>
          <input
            type="text"
            class="value-input"
            bind:value={mockPatient.firstName}
            placeholder="First name"
          />
        </div>

        <div class="detail-row">
          <span class="label">Last Name:</span>
          <input
            type="text"
            class="value-input"
            bind:value={mockPatient.lastName}
            placeholder="Last name"
          />
        </div>

        <div class="detail-row">
          <span class="label">Patient ID:</span>
          <span class="value">{mockPatient.patientId}</span>
        </div>

        <div class="detail-row">
          <span class="label">MRN:</span>
          <span class="value">{mockPatient.mrn}</span>
        </div>

        <div class="detail-row">
          <span class="label">Date of Birth:</span>
          <span class="value">{formatDate(mockPatient.dateOfBirth)}</span>
        </div>

        <div class="detail-row">
          <span class="label">Gender:</span>
          <span class="value"
            >{mockPatient.gender === "M" ? "Male" : "Female"}</span
          >
        </div>

        <div class="detail-row">
          <span class="label">Clinician:</span>
          <span class="value">{mockPatient.clinicianName}</span>
        </div>
      </div>

      <div class="actions">
        <button
          class="btn-primary"
          on:click={launchLyrebird}
          disabled={isGenerating}
        >
          {#if isGenerating}
            <span class="spinner"></span>
            Launching...
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Open Lyrebird in Context
          {/if}
        </button>

        {#if errorMessage}
          <div class="error-message">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {errorMessage}
          </div>
        {/if}
      </div>
    </div>

    {#if launchUrl}
      <div class="debug-section">
        <h3>Generated Launch URL (for debugging):</h3>
        <div class="code-block">
          <code>{launchUrl}</code>
        </div>
      </div>
    {/if}

    <div class="info-section">
      <h3>How it works (Secure Launch V2):</h3>
      <ol>
        <li>
          <strong>Asymmetric Encryption:</strong> Uses ECDH with P-256 curve (public-key cryptography)
        </li>
        <li>
          <strong>Ephemeral Keys:</strong> Each launch generates a new temporary keypair for forward secrecy
        </li>
        <li>
          <strong>Authenticated Encryption:</strong> AES-256-GCM ensures both confidentiality and integrity
        </li>
        <li>
          <strong>Timestamp Validation:</strong> 5-minute window prevents replay attacks
        </li>
        <li>
          The encrypted payload is appended to the Lyrebird URL as a JSON object
        </li>
        <li>
          Lyrebird decrypts the payload using its private key and pre-fills patient information
        </li>
      </ol>
    </div>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  header {
    text-align: center;
    color: white;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem 0;
    font-weight: 700;
  }

  .subtitle {
    font-size: 1.1rem;
    opacity: 0.9;
    margin: 0;
  }

  main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .patient-card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #f0f0f0;
  }

  .card-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #333;
  }

  .badge {
    background: #10b981;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .patient-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .detail-row {
    display: flex;
    padding: 0.75rem 0;
  }

  .label {
    font-weight: 600;
    color: #666;
    min-width: 150px;
  }

  .value {
    color: #333;
  }

  .value-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    color: #333;
    transition: border-color 0.2s;
  }

  .value-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .btn-primary {
    background: #667eea;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: #5568d3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    background: #fee;
    border: 1px solid #fcc;
    color: #c33;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .debug-section,
  .info-section {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  }

  h3 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.25rem;
  }

  .code-block {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
    font-family: "Courier New", monospace;
    font-size: 0.875rem;
    word-break: break-all;
  }

  ol {
    margin: 0;
    padding-left: 1.5rem;
    color: #555;
    line-height: 1.8;
  }

  li {
    margin-bottom: 0.5rem;
  }

  @media (max-width: 640px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 1.75rem;
    }

    .patient-card {
      padding: 1.5rem;
    }

    .detail-row {
      flex-direction: column;
      gap: 0.25rem;
    }

    .label {
      min-width: auto;
    }

    .value-input {
      width: 100%;
    }
  }
</style>
