#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

require_file() {
  local path="$1"
  if [ ! -f "${path}" ]; then
    echo "Missing required file: ${path}" >&2
    exit 1
  fi
}

require_match() {
  local pattern="$1"
  local path="$2"
  if ! grep -F -q -- "${pattern}" "${path}"; then
    echo "Missing expected content in ${path}: ${pattern}" >&2
    exit 1
  fi
}

require_absent() {
  local path="$1"
  if [ -e "${path}" ]; then
    echo "Path should have been removed after cleanup: ${path}" >&2
    exit 1
  fi
}

require_file "k8s/postgres-service-aliases.yaml"
require_file "k8s/storage-class-db-local.yaml"
require_file "k8s/cnpg-backups.yaml"
require_file "k8s/cnpg/postgres-cnpg.yaml"
require_file "k8s/clickhouse-backups.yaml"
require_file "scripts/k8s/validate-storage-cutover.sh"

require_absent "k8s/manual"
require_absent "k8s/backup.yaml"

require_match 'name: postgres-local' "k8s/cnpg/postgres-cnpg.yaml"
require_match 'storageClass: rejourney-db-local-retain' "k8s/cnpg/postgres-cnpg.yaml"
require_match 'size: 100Gi' "k8s/cnpg/postgres-cnpg.yaml"
require_match 'enabled: false' "k8s/cnpg/postgres-cnpg.yaml"
require_match 'cnpg.io/cluster: postgres-local' "k8s/postgres-service-aliases.yaml"
require_match 'cnpg.io/podRole: instance' "k8s/postgres-service-aliases.yaml"
require_match 'name: postgres-daily-backup' "k8s/cnpg-backups.yaml"
require_match 'name: postgres-local' "k8s/cnpg-backups.yaml"
require_match 'destinationPath: s3://rejourney-db-backups-1/postgres/cnpg' "k8s/cnpg/postgres-cnpg.yaml"
require_match 'endpointURL: https://s3.us-west-or.io.cloud.ovh.us' "k8s/cnpg/postgres-cnpg.yaml"
require_match 'name: db-backup-secret' "k8s/cnpg/postgres-cnpg.yaml"
require_match 'name: clickhouse-daily-backup' "k8s/clickhouse-backups.yaml"
require_match 'name: clickhouse-system-log-cleanup' "k8s/clickhouse-backups.yaml"
require_match 'BACKUP DATABASE' "backend/scripts/backupClickHouse.ts"
require_match 'BACKUP_S3_ENDPOINT' "scripts/k8s/k8s-sync-secrets.sh"
require_match 'CNPG_CLUSTER_NAME="${CNPG_CLUSTER_NAME:-postgres-local}"' "scripts/k8s/deploy-release.sh"
require_match 'PGBOUNCER_URL=' "scripts/k8s/k8s-sync-secrets.sh"
require_match '@postgres-app-rw:5432/' "scripts/k8s/k8s-sync-secrets.sh"

ruby <<'RUBY'
require 'yaml'

files = [
  'k8s/postgres-service-aliases.yaml',
  'k8s/storage-class-db-local.yaml',
  'k8s/cnpg-backups.yaml',
  'k8s/cnpg/postgres-cnpg.yaml',
  'k8s/clickhouse-backups.yaml',
]

files.each do |path|
  docs = YAML.load_stream(File.read(path))
  if docs.compact.empty?
    warn "No YAML documents found in #{path}"
    exit 1
  end
end
RUBY

echo "Storage cutover manifests and cleanup guardrails look valid."
