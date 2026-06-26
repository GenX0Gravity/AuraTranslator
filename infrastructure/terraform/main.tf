# main.tf
# Main infrastructure configuration provisioning Multi-Region Cloud Run, Serverless NEGs, Global Load Balancer, and Cloud CDN.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  # Note: A GCS backend can be configured here for production remote state management
  # backend "gcs" {
  #   bucket = "auratranslator-tfstate"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
}

provider "google-beta" {
  project = var.project_id
}

# ── Enable Essential APIs ──────────────────────────────────────
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "firestore.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "aiplatform.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# ── Cloud Run Web Application Deployed in Multiple Regions ────
resource "google_cloud_run_v2_service" "web_app" {
  for_each = toset(var.regions)
  name     = "auratranslator-web-${each.key}"
  location = each.key
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER" # Only allow GLB to route traffic

  template {
    scaling {
      min_instance_count = var.app_min_instances
      max_instance_count = var.app_max_instances
    }

    max_instance_request_concurrency = var.app_concurrency

    containers {
      image = "${var.primary_region}-docker.pkg.dev/${var.project_id}/auratranslator-repo/auratranslator-web:latest"

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "PGHOST"
        value = google_sql_database_instance.postgres_primary.ip_address.0.ip_address
      }
      env {
        name  = "PGPORT"
        value = "5432"
      }
      env {
        name  = "PGDATABASE"
        value = google_sql_database.postgres_db.name
      }
      env {
        name = "PGUSER"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_user.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "PGPASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.redis_cache.host
      }
      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.redis_cache.port)
      }
      env {
        name = "NEXTAUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.nextauth_secret.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# Allow unauthenticated global web requests via the Load Balancer
resource "google_cloud_run_v2_service_iam_binding" "web_public" {
  for_each = toset(var.regions)
  location = google_cloud_run_v2_service.web_app[each.key].location
  name     = google_cloud_run_v2_service.web_app[each.key].name
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}

# ── Global Load Balancing with Serverless NEGs ──────────────────

# Serverless NEG (Network Endpoint Group) for each deployment region
resource "google_compute_region_network_endpoint_group" "serverless_neg" {
  for_each              = toset(var.regions)
  name                  = "auratranslator-neg-${each.key}"
  network_endpoint_type = "SERVERLESS"
  region                = each.key
  cloud_run {
    service = google_cloud_run_v2_service.web_app[each.key].name
  }
}

# Compute Backend Service with Cloud CDN and Cloud Armor integration
resource "google_compute_backend_service" "global_backend" {
  name                  = "auratranslator-backend-service"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  
  # Enabling CDN for caching translations & assets at edge nodes
  enable_cdn = true
  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    max_ttl           = 86400
    client_ttl        = 3600
    serve_while_stale = 86400
  }

  # Regional Serverless NEG targets
  dynamic "backend" {
    for_each = var.regions
    content {
      group = google_compute_region_network_endpoint_group.serverless_neg[backend.value].id
    }
  }

  # Reference to Cloud Armor security policy for WAF & DDoS
  security_policy = google_compute_security_policy.cloud_armor_policy.id
}

# URL Map for Global Routing
resource "google_compute_url_map" "url_map" {
  name            = "auratranslator-url-map"
  default_service = google_compute_backend_service.global_backend.id
}

# Managed SSL Certificate for HTTPS
resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  name = "auratranslator-ssl-cert"
  managed {
    domains = [var.domain_name]
  }
}

# Target HTTPS Proxy
resource "google_compute_target_https_proxy" "https_proxy" {
  name             = "auratranslator-https-proxy"
  url_map          = google_compute_url_map.url_map.id
  ssl_certificates = [google_compute_managed_ssl_certificate.ssl_cert.id]
}

# Global IP Address for HTTP(S) LB
resource "google_compute_global_address" "global_ip" {
  name = "auratranslator-global-ip"
}

# Global Forwarding Rule
resource "google_compute_global_forwarding_rule" "https_forwarding_rule" {
  name                  = "auratranslator-https-forwarding"
  target                = google_compute_target_https_proxy.https_proxy.id
  port_range            = "443"
  ip_address            = google_compute_global_address.global_ip.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# HTTP to HTTPS redirect support
resource "google_compute_url_map" "http_redirect" {
  name = "auratranslator-http-redirect"
  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_proxy" {
  name    = "auratranslator-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_forwarding_rule" {
  name                  = "auratranslator-http-forwarding"
  target                = google_compute_target_http_proxy.http_proxy.id
  port_range            = "80"
  ip_address            = google_compute_global_address.global_ip.address
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
