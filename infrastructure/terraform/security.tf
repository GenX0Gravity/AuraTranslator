# security.tf
# Configures enterprise-grade security structures: Cloud Armor WAF Policies (DDoS & OWASP protection) and Secret Manager Secret registrations.

# ── Cloud Armor Web Application Firewall (WAF) & DDoS Policy ──
resource "google_compute_security_policy" "cloud_armor_policy" {
  name        = "auratranslator-security-policy"
  description = "AuraTranslator Cloud Armor security policy for OWASP protection and rate limiting"

  # Rule 1: SQL Injection Protection (OWASP CRS)
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block Preconfigured SQL Injection attacks"
  }

  # Rule 2: Cross-Site Scripting (XSS) Protection (OWASP CRS)
  rule {
    action   = "deny(403)"
    priority = "1100"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block Preconfigured XSS attacks"
  }

  # Rule 3: Local & Remote File Inclusion Protection (LFI/RFI)
  rule {
    action   = "deny(403)"
    priority = "1200"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-v33-stable') || evaluatePreconfiguredExpr('rfi-v33-stable')"
      }
    }
    description = "Block LFI and RFI preconfigured expressions"
  }

  # Rule 4: IP Rate Limiting (Prevent API abuse / Denial of Service)
  rule {
    action   = "throttle"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      unit = "MINUTE"
      rate_limit_threshold {
        count        = 300
        interval_sec = 60
      }
      exceed_action = "deny(429)"
      enforce_on_key = "IP"
    }
    description = "Rate limit clients to 300 requests per minute"
  }

  # Rule 5: Default Rule (Allow all other traffic)
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }
}

# ── Secret Manager Registrations ──────────────────────────────
resource "google_secret_manager_secret" "db_user" {
  secret_id = "auratranslator-db-user"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "auratranslator-db-password"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "nextauth_secret" {
  secret_id = "auratranslator-nextauth-secret"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "auratranslator-gemini-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "cron_secret" {
  secret_id = "auratranslator-cron-secret"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}
