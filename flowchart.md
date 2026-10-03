# Simulated Mobile Money Platform — System Flowcharts

This document provides visual flowcharts and architectural diagrams for the **AI-Based Mobile Money Fraud Detection System** (demonstrating **Account Takeover Detection [ATOD]** and **Transaction Anomaly Detection**).

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Clients["Client Surfaces"]
        WebClient["Web Client App & Mobile Simulator<br/>(React + Tailwind)<br/>Port 5173"]
        AdminPortal["Fraud Admin Portal<br/>(React + Tailwind)<br/>Port 5174"]
    end

    subgraph Backend["Backend & Real-Time Sync (Port 5000)"]
        APIGateway["Express REST API<br/>/auth, /transaction, /admin"]
        SocketServer["Socket.io WebSocket Engine<br/>Real-Time Broadcasts"]
        GEO["Geospatial & Speed Engine<br/>(Haversine Distance)"]
        ANOM["Anomaly Engine<br/>(Z-Score Volumetrics)"]
        DBService["Database Service Layer<br/>(Mongoose Models)"]
    end

    subgraph MLEngine["FastAPI ML Scoring Engine (Port 8000)"]
        FraudEngine["FastAPI Router<br/>(POST /)"]
        Pydantic["Pydantic Validator<br/>(18 Features)"]
        Model["XGBoost Regressor<br/>(model.sav)"]
    end

    subgraph Storage["Database Layer"]
        MongoDB[("MongoDB Atlas Cloud<br/>momo_fraud")]
    end

    WebClient <-->|"REST APIs & WebSockets"| APIGateway
    AdminPortal <-->|"Admin APIs & SOC Live Feed"| APIGateway

    APIGateway <--> SocketServer
    APIGateway --> GEO
    APIGateway --> ANOM
    APIGateway -->|"18-Feature Vector"| FraudEngine
    FraudEngine --> Pydantic --> Model
    Model -->|"Raw Risk Score ~3-20"| APIGateway
    APIGateway <--> DBService
    DBService <--> MongoDB

    classDef client fill:#f0f9ff,stroke:#0284c7,stroke-width:2px;
    classDef backend fill:#fef2f2,stroke:#dc2626,stroke-width:2px;
    classDef ml fill:#fefce8,stroke:#ca8a04,stroke-width:2px;
    classDef storage fill:#f0fdf4,stroke:#16a34a,stroke-width:2px;
    class WebClient,AdminPortal client;
    class APIGateway,SocketServer,GEO,ANOM,DBService backend;
    class FraudEngine,Pydantic,Model ml;
    class MongoDB storage;
```

---

## 2. User Onboarding, Device Registration & Layered Login Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant App as Web / Mobile App
    participant API as Express Backend (Port 5000)
    participant DB as MongoDB Atlas

    Note over User,App: === REGISTRATION (POST /) ===
    User->>App: Enter Full Name, Email, Ghana Card, Password
    App->>App: Capture Device Fingerprint & GPS Location
    App->>API: POST / { fullName, email, ghanaCard, password, device, location }
    API->>API: Validate via Joi Schema (Ghana Card: GHA-XXXXXXXXX-X)
    API->>DB: Check if Email Already Exists
    alt Email Already Registered
        API-->>App: 400 "User already registered"
    else New User
        API->>API: Bcrypt Hash Password (salt rounds: 10)
        API->>DB: Insert UserRegister Document (balance: 50,000 GHS)
        API->>API: Generate JWT Token (id, email)
        API-->>App: 200 OK { user, token } + Set JWT Cookie
    end

    Note over User,App: === FACIAL BIOMETRIC ENROLLMENT ===
    App->>App: Activate Camera for Facial Liveness Scan
    App->>App: Run Landmark Mesh Matching (Client-Side)
    App->>App: Store Biometric Enrollment Locally

    Note over User,App: === LOGIN (POST /login) ===
    User->>App: Enter Email, Ghana Card, Password
    App->>API: POST /login { email, ghanaCard, password }
    API->>DB: Query User by Email
    API->>API: Bcrypt Compare Password Hash
    API->>API: Validate Ghana Card Match
    alt Credentials Invalid
        API-->>App: 404 "email, Password, or ghanacard not valid"
    else Valid Credentials
        API->>API: Generate JWT Token
        API-->>App: 200 OK { token, user } + Set JWT Cookie
    end

    Note over User,App: === FACIAL BIOMETRIC VERIFICATION ===
    App->>App: Activate Camera for Facial Liveness Scan
    App->>App: Compare Against Enrolled Biometric Token
    App->>App: Grant Session Access on Match
    App->>App: Connect to Socket.io for Real-Time Sync
```

---

## 3. Transaction Execution & AI Fraud Detection Decision Flow

```mermaid
flowchart TD
    Start(["User Submits Transaction<br/>(Amount, Receiver, Location, Device)"]) --> AuthCheck{"JWT Auth Valid?<br/>(authUser Middleware)"}

    AuthCheck -- No --> RejectAuth["401 Unauthorized<br/>'Authentication Required'"]
    AuthCheck -- Yes --> FrozenCheck{"Account Status?"}

    FrozenCheck -- Frozen --> RejectFrozen["403 Forbidden<br/>'Wallet Frozen — Contact Fraud Support'"]
    FrozenCheck -- Active --> DupeCheck{"Duplicate Within 4s?<br/>(Idempotency Guard)"}

    DupeCheck -- Yes --> ReturnExisting["Return Existing Transaction<br/>(Prevent Double-Submit)"]
    DupeCheck -- No --> ChannelDetect{"Determine Channel"}

    ChannelDetect -- "Cash In (Deposit)" --> BypassFraud["Bypass Fraud Evaluation<br/>normalizedScore = 0.01"]
    ChannelDetect -- "Send Money / Cash Out" --> FeatureExtract["Build 18-Feature Binary Vector"]

    subgraph Extraction["Feature Extraction Pipeline"]
        FeatureExtract --> F1["is_new_user: ≤1 lifetime txns?"]
        FeatureExtract --> F2["device_changed: Device fingerprint mismatch?"]
        FeatureExtract --> F3["txn_unusual_location: Haversine >30km & suspicious velocity?"]
        FeatureExtract --> F4["txn_unusual_amount: Z-Score ≥3.0 or amount >4x baseline?"]
        FeatureExtract --> F5["account_takeover_risk: Device + Location anomaly compound?"]
        FeatureExtract --> F6["has_multiple_anomalies: ≥2 signals active?"]
    end

    F1 & F2 & F3 & F4 & F5 & F6 --> MLCall["POST 18 Features to FastAPI ML Engine<br/>(http://localhost:8000)"]
    MLCall --> Normalize["Normalize Raw Score<br/>(rawScore - 3.0) / 17.0 → 0.0–1.0"]

    Normalize --> RiskEval{"Risk Assessment"}

    RiskEval -- "Score <60% & No Anomaly Flags" --> Clean["Status: COMPLETED<br/>Full Amount Deducted<br/>Balance Updated in MongoDB"]
    RiskEval -- "Score ≥60% OR Amount Anomaly<br/>OR Device+Location Anomaly" --> Blocked["Status: BLOCKED<br/>Model A Zero-Deduction Defense<br/>0.00 GHS Deducted"]

    BypassFraud --> CashInComplete["Status: COMPLETED<br/>Balance Credited (+Amount)<br/>Recorded in Admin Telemetry"]

    Clean --> SocketClean["Socket: admin:transaction:new<br/>(status: completed)"]
    CashInComplete --> SocketCashIn["Socket: admin:transaction:new<br/>(channel: cash_in)"]

    Blocked --> CreateCase["Auto-Create Fraud Case<br/>(CASE-XXXX-XXXX)<br/>Insert into 'cases' Collection"]
    CreateCase --> SocketBlocked["Socket: admin:case:new<br/>Socket: admin:transaction:new<br/>(status: blocked)"]

    classDef success fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef danger fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    classDef warning fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    classDef process fill:#f1f5f9,stroke:#64748b,stroke-width:2px;
    classDef bypass fill:#f0f9ff,stroke:#0284c7,stroke-width:2px;

    class Clean,CashInComplete,SocketClean,SocketCashIn success;
    class Blocked,RejectAuth,RejectFrozen danger;
    class CreateCase,SocketBlocked warning;
    class FeatureExtract,F1,F2,F3,F4,F5,F6,MLCall,Normalize,RiskEval process;
    class BypassFraud,ReturnExisting bypass;
```

---

## 4. Fraud Analyst Admin Portal (SOC) Workflow

```mermaid
flowchart TD
    AnalystLogin(["Analyst Logs In<br/>(POST /admin/login)"]) --> AdminDashboard["Admin SOC Dashboard<br/>Live Transaction Feed & Incident Queue"]

    AdminDashboard --> FilterCases["Filter Cases By:<br/>- ATOD vs Transaction Anomaly<br/>- Risk Level: Critical / High / Medium<br/>- Status: Open / Under Review"]

    FilterCases --> ViewDetail["Open Case Detail View<br/>(GET /admin/cases/:id)"]

    subgraph Comparison["Forensic Signal Review"]
        ViewDetail --> Comp1["ML Risk Score<br/>(e.g. 72% — High Risk)"]
        ViewDetail --> Comp2["Device Fingerprint Mismatch<br/>Known: dev_web_chrome vs Current: unknown_device"]
        ViewDetail --> Comp3["Geolocation Jump<br/>Known: Accra (5.6°N) → Current: Tamale (9.4°N)"]
        ViewDetail --> Comp4["Amount Anomaly<br/>Baseline Avg: GH₵ 200 → Attempt: GH₵ 4,500"]
    end

    Comp1 & Comp2 & Comp3 & Comp4 --> AnalystDecision{"Analyst Action Decision"}

    AnalystDecision -- "Pathway B: False-Positive Clearance" --> ActApprove["POST /admin/cases/:id/approve<br/>Status → 'approved'<br/>Auto-Reactivate Wallet"]
    AnalystDecision -- "Pathway A: Confirmed Fraud" --> ActBlock["POST /admin/cases/:id/block<br/>Status → 'blocked'"]
    AnalystDecision -- "Escalate to Tier 2" --> ActEscalate["POST /admin/cases/:id/escalate<br/>Assign Senior Reviewer"]
    AnalystDecision -- "Freeze User Account" --> ActFreeze["POST /admin/users/:userId/freeze<br/>User status → 'frozen' in MongoDB"]

    ActApprove & ActBlock & ActEscalate & ActFreeze --> AddNotes["Append Analyst Notes<br/>(POST /admin/cases/:id/notes)<br/>Immutable Audit Trail"]
    AddNotes --> BroadcastAdmin["Broadcast Socket Update<br/>admin:case:updated<br/>account:frozen / account:unfrozen"]

    classDef action fill:#eff6ff,stroke:#2563eb,stroke-width:2px;
    classDef audit fill:#fdf4ff,stroke:#c026d3,stroke-width:2px;
    classDef danger fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    classDef success fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    class ActApprove success;
    class ActBlock,ActFreeze danger;
    class ActEscalate action;
    class AddNotes,BroadcastAdmin audit;
```

---

## 5. MongoDB Atlas Document Schema Diagram (ERD)

```mermaid
erDiagram
    UserRegister ||--o{ UserInputs : "sends transactions"
    UserRegister ||--o{ Case : "involved in"
    UserInputs ||--o| Case : "generates"

    UserRegister {
        ObjectId _id PK
        string fullName
        string email UK
        string password
        string ghanaCard
        string device
        object location
        number balance
        string status
        string frozenReason
        date frozenAt
        date createdAt
        date updatedAt
    }

    UserInputs {
        ObjectId _id PK
        ObjectId userID FK
        number amount
        string SenderPhone
        string receiverPhone
        string status
        string channel
        string transactionType
        string reason
        string fraudScore
        string region
        string city
        string country
        object location
        string device
        date createdAt
        date updatedAt
    }

    Case {
        ObjectId _id PK
        string caseId UK
        string transactionId
        ObjectId userId FK
        string userName
        string userPhone
        string detectionType
        string riskLevel
        string status
        mixed transaction
        array signals
        mixed userProfile
        array analystNotes
        date createdAt
        date updatedAt
    }
```

---

## 6. Risk Scoring & Model A Defense Policy

```mermaid
flowchart LR
    subgraph RawScore["XGBoost Raw Output"]
        RS["Raw Score Range: ~3.0 — ~20.0"]
    end

    subgraph Normalization["Min-Max Normalization"]
        NORM["(rawScore - 3.0) / 17.0<br/>Clamped to 0.0 — 1.0"]
    end

    subgraph Tiers["Risk Tier Classification"]
        LOW["LOW (0–30%)<br/>✅ Approved<br/>Full deduction"]
        MED["MEDIUM (30–60%)<br/>✅ Allowed<br/>Full deduction"]
        HIGH["HIGH (60–80%)<br/>🛡️ Auto-Blocked<br/>0.00 GHS deducted<br/>Case auto-created"]
        CRIT["CRITICAL (80–100%)<br/>🛡️ Auto-Blocked<br/>0.00 GHS deducted<br/>Case auto-created"]
    end

    RS --> NORM
    NORM --> LOW
    NORM --> MED
    NORM --> HIGH
    NORM --> CRIT

    classDef safe fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef warn fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    classDef block fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    class LOW,MED safe;
    class HIGH warn;
    class CRIT block;
```
