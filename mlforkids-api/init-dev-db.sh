#!/bin/bash
set -e

# Check if the user already exists
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1 FROM pg_roles WHERE rolname='ml4kdbuser'" | grep -q 1 || {

  # If the user does not exist, then create the user and database
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE USER ml4kdbuser WITH PASSWORD 'ml4kdbpwd' LOGIN;"
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE mlforkidsdb OWNER ml4kdbuser;"
}

# Run the SQL file
psql -U ml4kdbuser -f /docker-entrypoint-initdb.d/mlforkids-api/sql/postgresql.sql -d mlforkidsdb
