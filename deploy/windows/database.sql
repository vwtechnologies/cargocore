-- Run with a DBA account after replacing the password placeholders.
-- Never run the application as root. Keep MariaDB bind-address=127.0.0.1.
CREATE DATABASE IF NOT EXISTS cargocore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cargocore_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_APP_PASSWORD';
CREATE USER IF NOT EXISTS 'cargocore_migrate'@'127.0.0.1' IDENTIFIED BY 'REPLACE_MIGRATION_PASSWORD';
CREATE USER IF NOT EXISTS 'cargocore_backup'@'127.0.0.1' IDENTIFIED BY 'REPLACE_BACKUP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON cargocore.* TO 'cargocore_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON cargocore.* TO 'cargocore_migrate'@'127.0.0.1';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT ON cargocore.* TO 'cargocore_backup'@'127.0.0.1';
-- Audit history is append-only for the runtime account. Table-level protection
-- requires per-table grants rather than database-wide UPDATE/DELETE grants.
-- Run erp:database-grants after migrations and apply its generated SQL.
