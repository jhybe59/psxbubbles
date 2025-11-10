# Risk Register & Follow-up Items

## Key Assumptions
- External provider can deliver complete minute-level data for all PSX REG symbols with ≤ 90-second latency.
- Corporate action indicators are present in the feed or can be sourced from an auxiliary endpoint.
- TimescaleDB managed service is available in required region with acceptable cost profile.
- Licensing agreements allow storage and visualization of PSX data within the app.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation / Contingency |
| --- | --- | --- | --- |
| API delivers intermittent missing minutes | UI gaps, user distrust | Medium | Implement monitoring; raise alerts; coordinate with vendor SLA; prepare UI fallback messaging |
| Rate limits lower than expected (e.g., < 30 req/min) | Ingestion lag or incomplete data | Medium | Negotiate higher limits; batch symbols; consider multi-tier polling cadence |
| Corporate action data delayed or absent | Incorrect historical comparisons | Medium | Build manual override workflow; integrate alternate corporate action feed |
| Timescale managed costs exceed budget | Operational spend pressure | Low | Evaluate self-hosted Postgres + Timescale, or tune retention/compression settings |
| Regulatory/licensing changes for PSX data | Possible service interruption | Low | Maintain contact with PSX, review contracts quarterly, plan for alternate provider |
| Single data provider dependency | Total data outage | Medium | Scout secondary/backup provider or cached last-known values with user messaging |

## Follow-up Actions
1. Confirm detailed API documentation, sample payloads, and sandbox credentials with provider.
2. Validate PSX data redistribution rights with legal/compliance stakeholders.
3. Prototype TimescaleDB instance (dev) to benchmark write throughput and compression savings.
4. Align on monitoring stack selection and integrate ingestion lag metrics into dashboards.
5. Draft incident runbook covering provider outage and DB failover scenarios.










