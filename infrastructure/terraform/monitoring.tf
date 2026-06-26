# monitoring.tf
# Configures Cloud Monitoring Alert Policies, Dashboards, and Notification Channels for unified operations monitoring.

# ── Alert Notification Channel (Email / Webhook) ────────────────
resource "google_monitoring_notification_channel" "email_alert" {
  display_name = "Operations Team Alerts"
  type         = "email"
  labels = {
    email_address = "ops-alerts@auratranslator.com"
  }
}

# ── Alert Policy: High HTTP 5xx Error Rate ──────────────────────
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High HTTP 5xx Error Rate (>1%)"
  combiner     = "OR"
  
  conditions {
    display_name = "Cloud Run 5xx Response Rate"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10.0 # Trigger if more than 10 requests per minute fail with 5xx
      
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alert.name]

  documentation {
    content   = "The 5xx response rate for AuraTranslator web app has exceeded 1%. Check Next.js container logs in Cloud Logging for details."
    mime_type = "text/markdown"
  }
}

# ── Alert Policy: Database Connection Saturated ─────────────────
resource "google_monitoring_alert_policy" "db_cpu_saturated" {
  display_name = "PostgreSQL DB CPU Saturated (>85%)"
  combiner     = "OR"

  conditions {
    display_name = "DB CPU Utilization"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alert.name]

  documentation {
    content   = "Primary Cloud SQL PostgreSQL CPU is above 85% for 5 consecutive minutes. Scale database size or inspect query locks/active queries."
    mime_type = "text/markdown"
  }
}

# ── Alert Policy: Sub-2-Second Latency SLA Breach ───────────────
resource "google_monitoring_alert_policy" "latency_sl_breach" {
  display_name = "p95 Latency SLA Breach (>2000ms)"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run p95 Latency"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_latencies\""
      duration        = "120s"
      comparison      = "COMPARISON_GT"
      threshold_value = 2000.0 # 2 seconds latency threshold

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email_alert.name]

  documentation {
    content   = "p95 Latency SLA breach on Cloud Run instances. Check downstream FastAPI inference latency and Redis cache hit ratios."
    mime_type = "text/markdown"
  }
}

# ── Cloud Monitoring Executive Dashboard ───────────────────────
resource "google_monitoring_dashboard" "ops_dashboard" {
  dashboard_json = <<EOF
{
  "displayName": "AuraTranslator Scale-Up Dashboard (1M+ Users)",
  "gridLayout": {
    "columns": "12",
    "widgets": [
      {
        "title": "Cloud Run Request Rates (Multi-Region)",
        "width": 6,
        "height": 4,
        "xPosition": 0,
        "yPosition": 0,
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_count\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE",
                    "crossSeriesReducer": "REDUCE_SUM",
                    "groupByFields": ["metric.label.response_code_class"]
                  }
                }
              },
              "targetAxis": "Y1"
            }
          ]
        }
      },
      {
        "title": "Cloud Run Latency Percentiles (SLA Target: <2s)",
        "width": 6,
        "height": 4,
        "xPosition": 6,
        "yPosition": 0,
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type = \"cloud_run_revision\" AND metric.type = \"run.googleapis.com/request_latencies\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_PERCENTILE_95",
                    "crossSeriesReducer": "REDUCE_MEAN"
                  }
                }
              },
              "targetAxis": "Y1"
            }
          ]
        }
      },
      {
        "title": "Database CPU Utilization (Primary vs Replica)",
        "width": 6,
        "height": 4,
        "xPosition": 0,
        "yPosition": 4,
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type = \"cloudsql_database\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_MEAN",
                    "groupByFields": ["resource.label.database_id"]
                  }
                }
              },
              "targetAxis": "Y1"
            }
          ]
        }
      },
      {
        "title": "Memorystore Redis Cache CPU & Hit Rate",
        "width": 6,
        "height": 4,
        "xPosition": 6,
        "yPosition": 4,
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type = \"redis_instance\" AND metric.type = \"redis.googleapis.com/stats/cpu/utilization\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_MEAN"
                  }
                }
              },
              "targetAxis": "Y1"
            }
          ]
        }
      }
    ]
  }
}
EOF
}
