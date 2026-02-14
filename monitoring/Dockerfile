FROM prom/prometheus:v2.48.0

COPY monitoring/prometheus.yml /etc/prometheus/prometheus.yml
COPY monitoring/alerts.yml /etc/prometheus/alerts.yml

EXPOSE 9090

