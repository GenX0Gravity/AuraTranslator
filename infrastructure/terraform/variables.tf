# variables.tf
# Configuration variables for the AuraTranslator high-scale multi-region infrastructure.

variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID"
  default     = "codelabs-1-491815"
}

variable "primary_region" {
  type        = string
  description = "The primary region for resources and the main database"
  default     = "us-central1"
}

variable "secondary_region" {
  type        = string
  description = "The secondary backup region for active-passive replication and global load balancing"
  default     = "europe-west1"
}

variable "regions" {
  type        = list(string)
  description = "List of all regions where Next.js web application and APIs are deployed"
  default     = ["us-central1", "europe-west1"]
}

variable "domain_name" {
  type        = string
  description = "Domain name for the global application"
  default     = "translator.auratranslator.com"
}

variable "db_instance_tier" {
  type        = string
  description = "Machine type for the Cloud SQL PostgreSQL instances (HA enabled)"
  default     = "db-custom-2-7680" # 2 vCPU, 7.5 GB RAM
}

variable "db_disk_size_gb" {
  type        = number
  description = "Disk size for PostgreSQL database in GB"
  default     = 50
}

variable "redis_tier" {
  type        = string
  description = "The service tier of the Memorystore Redis instance"
  default     = "STANDARD_HA" # High availability with replication
}

variable "redis_memory_size_gb" {
  type        = number
  description = "Memory size in GiB for Memorystore Redis cache"
  default     = 5
}

variable "app_min_instances" {
  type        = number
  description = "Minimum instances for Cloud Run to avoid cold starts"
  default     = 3
}

variable "app_max_instances" {
  type        = number
  description = "Maximum instances for Cloud Run to handle traffic spikes"
  default     = 100
}

variable "app_concurrency" {
  type        = number
  description = "Max concurrent requests per Cloud Run instance"
  default     = 80
}
