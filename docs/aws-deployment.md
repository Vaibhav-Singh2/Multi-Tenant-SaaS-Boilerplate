# AWS Deployment Guide

Deploy the Multi-Tenant SaaS Boilerplate to AWS using ECS Fargate, RDS, ElastiCache, and ALB.

---

## Architecture Overview

```
Internet
  │
  ▼
Route 53 (DNS)
  │
  ▼
ACM (SSL/TLS)
  │
  ▼
ALB (Application Load Balancer)
  │
  ├──▶ ECS Fargate: saas-api    (Port 3000)
  └──▶ ECS Fargate: saas-worker (Background)
          │
          ├──▶ RDS PostgreSQL (Multi-AZ)
          └──▶ ElastiCache Redis (Cluster Mode)
```

---

## Prerequisites

- AWS CLI configured (`aws configure`)
- Docker installed
- Terraform or AWS Console access

---

## Step 1: Create VPC & Networking

```bash
# Create VPC with 2 public + 2 private subnets across 2 AZs
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create subnets, internet gateway, NAT gateway, and route tables
# (Use AWS Console or Terraform for full setup)
```

## Step 2: Create ECR Repositories

```bash
aws ecr create-repository --repository-name saas-api --region us-east-1
aws ecr create-repository --repository-name saas-worker --region us-east-1
```

## Step 3: Create RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier saas-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version "16" \
  --master-username saas \
  --master-user-password "YOUR_STRONG_PASSWORD" \
  --db-name saas \
  --allocated-storage 20 \
  --storage-type gp3 \
  --multi-az \
  --no-publicly-accessible \
  --vpc-security-group-ids sg-XXXXXXXX \
  --db-subnet-group-name your-subnet-group
```

## Step 4: Create ElastiCache Redis

```bash
aws elasticache create-replication-group \
  --replication-group-id saas-redis \
  --replication-group-description "SaaS Redis" \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version "7.0" \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --security-group-ids sg-XXXXXXXX \
  --cache-subnet-group-name your-subnet-group
```

## Step 5: Store Secrets in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name saas/production \
  --secret-string '{
    "DATABASE_URL": "postgres://saas:password@your-rds-endpoint:5432/saas",
    "REDIS_URL": "redis://your-elasticache-endpoint:6379",
    "JWT_SECRET": "your-jwt-secret-min-32-chars",
    "ADMIN_SECRET": "your-admin-secret",
    "WEBHOOK_SIGNATURE_SECRET": "your-webhook-secret"
  }'
```

## Step 6: Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name saas-cluster \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

## Step 7: Create ECS Task Definitions

Create `api-task-def.json`:

```json
{
  "family": "saas-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/saas-api:latest",
      "portMappings": [{ "containerPort": 3000 }],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:...:saas/production:DATABASE_URL::"
        },
        {
          "name": "REDIS_URL",
          "valueFrom": "arn:aws:secretsmanager:...:saas/production:REDIS_URL::"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:...:saas/production:JWT_SECRET::"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/saas-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "node -e \"require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))\""
        ],
        "interval": 30,
        "timeout": 10,
        "retries": 3
      }
    }
  ]
}
```

```bash
aws ecs register-task-definition --cli-input-json file://api-task-def.json
```

## Step 8: Create ALB & Target Group

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name saas-alb \
  --type application \
  --scheme internet-facing \
  --ip-address-type ipv4 \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx

# Create Target Group
aws elbv2 create-target-group \
  --name saas-api-tg \
  --protocol HTTP \
  --port 3000 \
  --target-type ip \
  --vpc-id vpc-xxx \
  --health-check-path /health
```

## Step 9: Create ECS Services

```bash
aws ecs create-service \
  --cluster saas-cluster \
  --service-name saas-api \
  --task-definition saas-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=api,containerPort=3000"

aws ecs create-service \
  --cluster saas-cluster \
  --service-name saas-worker \
  --task-definition saas-worker \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```

## Step 10: Configure Route 53 & ACM SSL

```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS

# Create Route 53 A record pointing to ALB
# (Use AWS Console or Terraform)
```

## Step 11: Run Database Migrations

```bash
# Run via a one-off ECS task or from a bastion host
DATABASE_URL="postgres://..." bun run db:migrate
```

---

## Environment Variables Required in Production

| Variable                   | Description                          |
| -------------------------- | ------------------------------------ |
| `DATABASE_URL`             | RDS PostgreSQL connection string     |
| `REDIS_URL`                | ElastiCache Redis connection string  |
| `JWT_SECRET`               | Min 32-char secret for JWT signing   |
| `ADMIN_SECRET`             | Secret for admin API endpoints       |
| `WEBHOOK_SIGNATURE_SECRET` | HMAC secret for webhook verification |
| `NODE_ENV`                 | Set to `production`                  |
| `PORT`                     | API port (default: 3000)             |
| `LOG_LEVEL`                | `info` or `warn` in production       |

---

## Cost Estimate (us-east-1, minimal setup)

| Resource                     | Type                 | Est. Monthly |
| ---------------------------- | -------------------- | ------------ |
| ECS Fargate (API, 2 tasks)   | 0.5 vCPU / 1GB       | ~$15         |
| ECS Fargate (Worker, 1 task) | 0.25 vCPU / 0.5GB    | ~$4          |
| RDS PostgreSQL               | db.t3.micro Multi-AZ | ~$30         |
| ElastiCache Redis            | cache.t3.micro       | ~$15         |
| ALB                          | Per-hour + LCU       | ~$20         |
| **Total**                    |                      | **~$84/mo**  |
