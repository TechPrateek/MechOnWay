# AWS Serverless Deployment Guide: MechOnWay MVP

This guide provides step-by-step instructions for deploying the **MechOnWay** roadside assistance platform to Amazon Web Services (AWS) using a production-quality, zero-idle-cost serverless architecture.

---

## 1. Architecture Overview & Resource Catalog

The backend runs entirely on AWS serverless technologies. No virtual machines (EC2), containers (ECS), or relational database instances (RDS) are required, ensuring zero ongoing idle charges.

```
                  ┌───────────────────────────────┐
                  │ Next.js Frontend              │
                  │ (AWS Amplify / Vercel / S3)   │
                  └──────────────┬────────────────┘
                                 │ HTTPS
                                 ▼
                  ┌───────────────────────────────┐
                  │ Amazon API Gateway            │
                  │ HTTP API (v2)                 │
                  └──────────────┬────────────────┘
                                 │ Proxy Event
                                 ▼
                  ┌───────────────────────────────┐
                  │ AWS Lambda (Node.js 20.x)     │
                  │ ARM64 Graviton2 (Pay-as-you-go)│
                  └──────────────┬────────────────┘
                                 │ Least-Privilege IAM
                                 ▼
                  ┌───────────────────────────────┐
                  │ Amazon DynamoDB               │
                  │ On-Demand (PAY_PER_REQUEST)   │
                  │ • MechOnWay-Requests          │
                  │ • MechOnWay-Mechanics         │
                  └───────────────────────────────┘
```

### AWS Resource Inventory

| AWS Resource | Logical ID in SAM | Purpose | Cost Model & Metering |
|---|---|---|---|
| **DynamoDB Requests Table** | `RequestsTable` | Stores roadside assistance work orders, status lifecycle timeline, customer contact info, and GPS coordinates. | On-Demand (`PAY_PER_REQUEST`). $1.25/M Write Request Units, $0.25/M Read Request Units. 25 GB free storage. |
| **DynamoDB Mechanics Table** | `MechanicsTable` | Stores technician profiles, vehicle compatibility, supported repair capabilities, and live availability. | On-Demand (`PAY_PER_REQUEST`). $1.25/M Write Request Units, $0.25/M Read Request Units. |
| **API Gateway HTTP API** | `MechOnWayHttpApi` | Secure HTTP v2 API Gateway providing REST endpoints, CORS preflight handling, and request routing. | $1.00 / million requests (1M calls/mo free under 12-Month Free Tier only). |
| **AWS Lambda Function** | `BackendFunction` | Executes RequestService and MechanicService domain logic, status machine validation, and nearest mechanic ranking. | $0.20 / million requests + $0.0000133334/GB-s on ARM64 (1M requests & 3.2M sec compute free/month under Always Free Tier). |
| **CloudWatch Log Group** | `BackendLogGroup` | Collects execution and error logs with strict 7-day auto-expiry retention. | Ingestion: $0.50/GB beyond 5 GB free tier. Storage: $0.03/GB-month beyond 5 GB free tier. |
| **IAM Execution Role** | Managed by SAM | Grants scoped permissions (`dynamodb:*`) strictly on the two tables and their indexes. | Free |

---

## 2. Cost Analysis, Metering & Risk Factors

> [!WARNING]
> **No Absolute "$0.00" Guarantees**: While serverless pay-as-you-go architectures have zero charges when completely idle, charges **can and will accrue** under specific usage patterns, account lifecycle stages, and external traffic. Review the pricing breakdown below before deploying.

### Service-by-Service Pricing & Charge Drivers

1. **Amazon DynamoDB (On-Demand Mode)**:
   - **How it's billed**: DynamoDB on-demand charges per Request Unit ($1.25 per million WRUs, $0.25 per million RRUs in `us-east-1`).
   - **Important Free Tier Distinction**: The famous "25 RCU / 25 WCU free tier" applies **only to Provisioned capacity mode**, not to Pay-Per-Request (On-Demand) mode. In On-Demand mode, writes and reads generate small fractional charges from request 1 unless specific promo credits apply.
   - **Storage**: The first 25 GB of data storage is free indefinitely. Beyond 25 GB, storage costs $0.25/GB-month.
   - **Global Secondary Indexes (GSIs)**: Every write or update to an item with an indexed attribute (`status`, `currentStatus`, `rating`) consumes additional WRUs on the respective GSI.

2. **Amazon API Gateway (HTTP API v2)**:
   - **How it's billed**: $1.00 per million requests for the first 300 million requests/month.
   - **Free Tier Eligibility**: The 1,000,000 requests/month allowance is part of the **12-Month Free Tier**. If your AWS account is older than 12 months, **all API Gateway calls are billable** ($0.000001 per request).

3. **AWS Lambda (Compute & Invocations)**:
   - **Always Free Tier**: 1,000,000 invocations/month and 3,200,000 compute seconds (for ARM64 at 128MB) are available under the "Always Free" tier (does not expire after 12 months).
   - **Exceeding Free Tier**: Additional invocations cost $0.20 per 1M requests, plus $0.0000133334 per GB-second of execution time.
   - **Exposure Risk**: Since HTTP API routes are publicly accessible by default, repeated client polling, automated bot traffic, or denial-of-service attempts could drive invocation counts beyond the free tier.

4. **Amazon CloudWatch Logs (Retention & Ingestion)**:
   - **Ingestion**: 5 GB of log data ingestion per month is free. Beyond that, ingestion costs $0.50 per GB.
   - **Storage**: 5 GB of log storage is free. Beyond that, storage costs $0.03 per GB-month.
   - **Retention Risk Mitigated**: By default, AWS Lambda creates log groups with `Never Expire` retention, which causes log files to accumulate indefinitely and survive stack deletion. In `template.yaml`, `BackendLogGroup` explicitly sets `RetentionInDays: 7` and `DeletionPolicy: Delete`, ensuring logs auto-expire and are removed on stack deletion.

5. **SAM Deployment S3 Bucket**:
   - `sam deploy` uploads zipped Lambda deployment artifacts to an S3 bucket (e.g. `aws-sam-cli-managed-default-samclisourcebucket-...`).
   - Standard S3 storage costs $0.023/GB-month (first 5 GB free under 12-Month Free Tier). Deployment packages are typically 10–30 MB.

### Realistic Cost Estimates for MVP Testing

| Usage Level | DynamoDB | API Gateway | Lambda (ARM64) | CloudWatch Logs | Estimated Total |
|---|---|---|---|---|---|
| **Idle / Zero Requests** | $0.00 | $0.00 | $0.00 | $0.00 | **$0.00 / month** |
| **Light Dev/Testing** (< 5,000 calls, new account) | ~$0.01 | $0.00 (Free Tier) | $0.00 (Free Tier) | $0.00 (Free Tier) | **< $0.05 / month** |
| **Light Dev/Testing** (< 5,000 calls, account > 12 mo) | ~$0.01 | ~$0.01 | $0.00 (Free Tier) | $0.00 (Free Tier) | **< $0.10 / month** |
| **Moderate Testing** (~100,000 calls, account > 12 mo) | ~$0.15 | ~$0.10 | $0.00 (Free Tier) | ~$0.05 | **~$0.30 / month** |

### Protective Cost Controls Implemented

- [x] **Explicit 7-Day CloudWatch Retention**: Set in `template.yaml` to prevent endless log buildup.
- [x] **ARM64 Architecture**: Utilizes AWS Graviton2 for ~20% lower compute charges compared to x86.
- [x] **No Polling Loops**: Avoids continuous polling from frontend or clients to minimize API calls.
- [x] **DeletionPolicy: Delete**: Guarantees DynamoDB tables and log groups are deleted when the SAM stack is torn down.

---

## 3. Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `STORAGE_PROVIDER` | No | `local` | Set to `dynamodb` for AWS Lambda deployment; defaults to `local` for local browser & tests. |
| `AWS_REGION` | No | `us-east-1` | AWS deployment region. |
| `DYNAMODB_TABLE_REQUESTS` | No | `MechOnWay-Requests-dev` | Name of the DynamoDB table for assistance requests. |
| `DYNAMODB_TABLE_MECHANICS` | No | `MechOnWay-Mechanics-dev` | Name of the DynamoDB table for technicians. |
| `DYNAMODB_ENDPOINT` | No | *(empty)* | Optional local DynamoDB endpoint (e.g. `http://localhost:8000`) for offline container testing. |
| `NEXT_PUBLIC_API_BASE_URL` | No | *(empty)* | Base URL for deployed API Gateway. When empty, Next.js calls local `/api/*` endpoints. |

---

## 4. Pre-Deployment Verification (Local)

Before deploying to AWS, verify that the application compiles and passes all automated tests locally without requiring AWS credentials:

```bash
# 1. Run all unit test suites
npm test

# 2. Run static analysis and linting
npm run lint

# 3. Build Next.js production bundle
npm run build
```

---

## 5. Step-by-Step AWS Deployment

### Prerequisites
1. **AWS CLI** installed and configured:
   ```bash
   aws configure
   # Enter AWS Access Key ID, Secret Access Key, and Default Region (e.g. us-east-1)
   ```
2. **AWS SAM CLI** installed:
   ```bash
   sam --version
   ```

### Step 1: Build the SAM Application
```bash
sam build
```
This compiles the Lambda function, resolves dependencies, and bundles CloudFormation assets.

### Step 2: Deploy Using Guided Mode
For the first deployment, run:
```bash
sam deploy --guided
```

You will be prompted for:
- **Stack Name**: `mechonway-backend-dev`
- **AWS Region**: `us-east-1` (or your preferred region)
- **Parameter Environment**: `dev`
- **Confirm changes before deploy**: `y`
- **Allow SAM CLI IAM role creation**: `y`
- **Disable rollback for debugging**: `n`
- **Save arguments to configuration file**: `y`
- **SAM configuration file**: `samconfig.toml`

### Step 3: Record the API Gateway Endpoint
Upon completion, the SAM CLI outputs the live API URL:
```
Outputs
--------------------------------------------------------------------------------------
Key                 ApiEndpoint
Description         HTTP API Gateway base endpoint URL for MechOnWay backend
Value               https://abc123xyz.execute-api.us-east-1.amazonaws.com
--------------------------------------------------------------------------------------
```

---

## 6. Frontend Deployment Options

Once the serverless backend is deployed, connect the Next.js frontend:

1. In your frontend environment (e.g. AWS Amplify Hosting or Vercel), set:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com
   ```
2. **Option A: AWS Amplify Hosting**
   - Connect your GitHub repository to AWS Amplify Console.
   - Amplify auto-detects Next.js App Router and deploys SSR hosting.
3. **Option B: Vercel**
   - Import repository on Vercel and add `NEXT_PUBLIC_API_BASE_URL`.

---

## 7. Complete Teardown & Resource Cleanup

To prevent any accidental ongoing billing, execute the following teardown workflow:

### Step 1: Delete SAM CloudFormation Stack
```bash
sam delete --stack-name mechonway-backend-dev --region us-east-1
```

When prompted:
```text
Are you sure you want to delete the stack mechonway-backend-dev in the region us-east-1? [y/N]: y
Are you sure you want to delete the folder mechonway-backend-dev in S3? [y/N]: y
```

Because `template.yaml` explicitly includes `BackendLogGroup`, `RequestsTable` (with `DeletionPolicy: Delete`), and `MechanicsTable` (with `DeletionPolicy: Delete`), CloudFormation deletes:
- Both DynamoDB tables (`MechOnWay-Requests-dev` and `MechOnWay-Mechanics-dev`)
- The API Gateway HTTP API (`MechOnWayHttpApi`)
- The Lambda backend function (`mechonway-backend-dev`)
- The CloudWatch log group (`/aws/lambda/mechonway-backend-dev`)
- All associated IAM roles and permission policies

### Step 2: Clean Up SAM S3 Deployment Bucket (Optional)
SAM CLI creates a shared bucket (e.g., `aws-sam-cli-managed-default-samclisourcebucket-...`) in your region for deployment zip artifacts. While `sam delete` deletes the stack folder, the bucket itself remains.

To list and delete any lingering SAM deployment buckets:
```bash
# List buckets
aws s3 ls | grep sam-cli

# Delete bucket and all versioned artifacts (replace with your bucket name)
aws s3 rb s3://aws-sam-cli-managed-default-samclisourcebucket-xxxx --force
```

### Step 3: Post-Teardown Audit Checklist
Verify via AWS CLI that zero resources remain active:

```bash
# 1. Verify DynamoDB tables are deleted (should NOT list MechOnWay tables)
aws dynamodb list-tables --region us-east-1

# 2. Verify Lambda function is deleted (should return ResourceNotFoundException)
aws lambda get-function --function-name mechonway-backend-dev --region us-east-1

# 3. Verify CloudWatch log group is deleted (should return empty list)
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/mechonway-backend-dev" --region us-east-1

# 4. Verify API Gateway is deleted
aws apigatewayv2 get-apis --region us-east-1
```

---

## 8. Cost Governance: AWS Budgets & Alerts

To guarantee you never incur unexpected charges:

1. **Set Up a Zero-Spend / Low-Spend Budget ($1.00/mo)**:
   ```bash
   aws budgets create-budget \
     --account-id $(aws sts get-caller-identity --query Account --output text) \
     --budget '{
       "BudgetName": "MechOnWay-Cost-Ceiling",
       "BudgetLimit": { "Amount": "1.00", "Unit": "USD" },
       "TimeUnit": "MONTHLY",
       "BudgetType": "COST"
     }' \
     --notifications-with-subscribers '[{
       "Notification": {
         "NotificationType": "ACTUAL",
         "ComparisonOperator": "GREATER_THAN",
         "Threshold": 80,
         "ThresholdType": "PERCENTAGE"
       },
       "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "your-email@example.com" }]
     }]'
   ```
2. Enable **Free Tier Usage Alerts** in AWS Billing Preferences console.
