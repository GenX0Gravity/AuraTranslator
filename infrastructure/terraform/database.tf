# database.tf
# Provisions the storage and cache components: High-Availability Cloud SQL PostgreSQL, Cross-Region Read Replica, Memorystore Redis, and Firestore.

# ── VPC Network for Private Database & Cache Peering ───────────
resource "google_compute_network" "vpc_network" {
  name                    = "auratranslator-vpc"
  auto_create_subnetworks = true
  depends_on              = [google_project_service.apis]
}

# Reserve private IP block for database and cache peering
resource "google_compute_global_address" "private_ip_alloc" {
  name          = "auratranslator-private-ip-alloc"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
}

# Create private connection to Google services
resource "google_service_networking_connection" "private_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc.name]
}

# ── Cloud SQL PostgreSQL Instance (High Availability) ──────────
resource "google_sql_database_instance" "postgres_primary" {
  name             = "auratranslator-postgres-primary"
  region           = var.primary_region
  database_version = "POSTGRES_15"
  
  settings {
    tier              = var.db_instance_tier
    disk_size         = var.db_disk_size_gb
    availability_type = "REGIONAL" # HIGH AVAILABILITY (HA) across multiple zones

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }

    ip_configuration {
      ipv4_enabled    = true # Cloud SQL Proxy / Authorized networks
      private_network = google_compute_network.vpc_network.id
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address   = true
    }
  }

  depends_on = [google_service_networking_connection.private_connection]
}

# ── Cross-Region Read Replica for Global Latency Optimization ──
resource "google_sql_database_instance" "postgres_replica" {
  name                 = "auratranslator-postgres-replica"
  region               = var.secondary_region
  database_version     = "POSTGRES_15"
  master_instance_name = google_sql_database_instance.postgres_primary.name

  settings {
    tier      = var.db_instance_tier
    disk_size = var.db_disk_size_gb

    ip_configuration {
      ipv4_enabled    = true
      private_network = google_compute_network.vpc_network.id
    }
  }

  depends_on = [
    google_sql_database_instance.postgres_primary,
    google_service_networking_connection.private_connection
  ]
}

# SQL Database Scheme Creation
resource "google_sql_database" "postgres_db" {
  name     = "auratranslator_db"
  instance = google_sql_database_instance.postgres_primary.name
}

# ── Firestore Multi-Region Database ───────────────────────────
resource "google_firestore_database" "firestore_db" {
  name        = "(default)"
  location_id = "nam5" # Multi-region (North America). Can be "eur3" for Europe.
  type        = "FIRESTORE_ONLY"

  depends_on = [google_project_service.apis]
}

# ── Memorystore Redis Cache (High Availability Cluster) ────────
resource "google_redis_instance" "redis_cache" {
  name               = "auratranslator-redis-cache"
  tier               = var.redis_tier # STANDARD_HA with replicas
  memory_size_gb     = var.redis_memory_size_gb
  region             = var.primary_region
  authorized_network = google_compute_network.vpc_network.id
  redis_version      = "REDIS_7_0"

  display_name = "AuraTranslator Translation Memory Cache"

  depends_on = [
    google_service_networking_connection.private_connection
  ]
}
