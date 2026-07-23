# Soga MVP - Backend & Hedera Architecture (DDiB)

## 1. System Overview
A decentralized healthcare Proof of Concept (MVP) developed for the DDiB program. The system utilizes Payload CMS (Node.js/TypeScript) with MongoDB to manage off-chain centralized data, and the Hedera Consensus Service (HCS Testnet) to secure immutable medical records. To accommodate the local South African market, patient interactions and consent management are conducted entirely via SMS using Twilio.

## 2. Database Structure (Payload CMS & MongoDB Collections)
To manage the simulated entities and off-chain data, the following Payload collections are required:

| Collection | Key Fields | Purpose |
| :--- | :--- | :--- |
| **Patients** | `patientId`, `phoneNumber`, `name`, `topicsArray` | Stores mock patient data and their associated HCS Topic IDs. |
| **Facilities** | `facilityId`, `type (Hospital/Lab/Pharmacy)`, `name` | Manages the participating mock healthcare facilities. |
| **Doctors** | `doctorId`, `name`, `facilityId`, `specialty` | Manages doctor accounts and their access credentials. |
| **Visits** | `patientId`, `doctorId`, `date`, `status` | Handles scheduling and appointments (100% off-chain). |
| **OTP_Logs** | `phoneNumber`, `otpCode`, `expiresAt`, `isValid` | Stores temporary SMS OTPs for consent verification. |

## 3. Hedera HCS Integration & Data Encryption
Since this is an MVP, **Hedera Testnet** is used via the `@hashgraph/sdk` to avoid transaction costs while proving the workflow.

* **Encryption First (AES-256-GCM):** No plaintext sensitive medical data (PHI) or personally identifiable information (PII) is ever pushed to the blockchain. The Payload backend encrypts all payloads before submitting them to HCS. The network only sees cryptographic hashes and ciphertext.
* **Static Topics:** Upon patient creation, HCS Topics are automatically generated for Doctor Reports, Medical Orders, and Prescriptions.
* **Dynamic Topics:** A new unique Topic is created for each specific category of Lab Tests upon the first request.
* **Decryption Logic:** Data is only decrypted on the server-side when a doctor submits the correct OTP provided by the patient, enforcing patient-driven access control.

## 4. SMS Workflow (Twilio Integration)
The Twilio SMS API is integrated directly into Payload CMS to manage the entire patient lifecycle without requiring a smartphone app.

* **Consent & Access Flow:** 
  Doctor requests file access -> Payload generates an OTP -> Twilio sends an SMS to the patient (e.g., *"Your consent code for Dr. Smith is 1234"*) -> Patient provides the code to the doctor -> Doctor inputs the OTP -> Backend decrypts and serves the data.
* **ID Retrieval Flow:**
  Patient texts a keyword (e.g., "5") to the Twilio number -> A Payload webhook receives the request, queries the `Patients` collection via the phone number -> Twilio replies with the ID (e.g., *"Your Soga ID is: SOG-9876"*).
* **Automated Reminders:**
  Payload CMS cron jobs check daily for upcoming appointments or medication schedules and trigger Twilio SMS alerts (e.g., *"Reminder: Your fasting blood test is scheduled for tomorrow"*).

## 5. Required Environment Variables (.env)
The following keys are essential for the backend, encryption, and external network connections:

* `PAYLOAD_SECRET`: Payload CMS encryption secret.
* `MONGODB_URI`: Connection string for the MongoDB instance.
* `ENCRYPTION_KEY`: A 32-byte secret key used for AES-256-GCM encryption/decryption of Hedera payloads.
* `HEDERA_NETWORK`: Set to `testnet`.
* `HEDERA_ACCOUNT_ID`: Your Hedera Testnet account ID.
* `HEDERA_PRIVATE_KEY`: Your Hedera Testnet private key.
* `TWILIO_ACCOUNT_SID`: Your Twilio Account SID.
* `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token.
* `TWILIO_PHONE_NUMBER`: The dedicated Twilio number used for sending and receiving system messages.