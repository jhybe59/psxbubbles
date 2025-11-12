# Environment Matrix

| Component | Dev | Stage | Prod |
| --- | --- | --- | --- |
| TimescaleDB | Managed Timescale (small single-node, 1 vCPU / 2 GB RAM) with daily snapshots; sample dataset only | Managed Timescale (HA enabled, 2 vCPU / 4 GB RAM); anonymized near-prod data; PITR 7 days | Managed Timescale (HA, 4 vCPU / 8 GB RAM starting); PITR 14 days; cross-region read replica |
| Ingestion Worker | Containerized job on developer cluster / Docker Compose; 1-minute cron; sandbox API creds | Kubernetes CronJob (2 replicas, staggered start); uses stage API creds; feature flags for new endpoints | Kubernetes CronJob (2 active + 1 standby); autoscaling based on lag; production API creds |
| Backend API Service | Node/Express service in Docker; exposed via localhost; connects to dev DB | Deployed to staging cluster behind internal ALB; authenticated access; integrates with stage observability | Deployed to production cluster behind public ALB + WAF; autoscaling; blue/green deploys |
| Secrets Management | `.env.local` with developer-managed tokens (short-lived) | Cloud secrets manager (e.g., AWS Secrets Manager/Key Vault); rotation tests | Cloud secrets manager with auto-rotation hooks and audit logging |
| Monitoring & Alerts | Local Prometheus/Grafana docker stack; basic dashboards | Managed Prometheus/Grafana or CloudWatch; alert routing to staging channel | Managed observability suite; pager on-call integration; synthetic probes |
| Networking | Local machine network; mock firewall rules | VPC with restricted egress to API provider IPs; VPN required | Production VPC; private subnets; API provider allowlisted IPs; centralized logging VPC endpoint |
| Backups & DR | Manual dumps on demand | Automated nightly logical backup + quarterly restore test | Automated snapshots + WAL streaming; cross-region DR drills semi-annually |
| Data Retention | 30-day sample cap | 90-day raw retention with compression; 12-month aggregates | 90-day raw retention with compression; 24-month aggregates; S3 archival |












