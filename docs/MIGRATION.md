# Migration Guide

## Database Migrations

### Running Migrations

```bash
# Run all pending migrations
cd backend
npm run migrate:latest

# Rollback last migration
npm run migrate:rollback

# Check migration status
npm run migrate:status
```

### Creating New Migrations

```bash
cd backend
npm run migrate:make migration_name
```

## Data Migration

### From Legacy System

If migrating from an old system:

1. **Export Legacy Data**
   ```bash
   # Export CSV from old system
   ```

2. **Import to New System**
   ```bash
   # Use import scripts in scripts/ directory
   node scripts/importLegacyData.js
   ```

3. **Verify Data Integrity**
   ```bash
   node scripts/verifyMigration.js
   ```

### Schema Updates

All schema changes should be done through migrations:

```javascript
// migrations/003_add_new_field.js
exports.up = async function(knex) {
  await knex.schema.table('orders', function(table) {
    table.string('new_field');
  });
};

exports.down = async function(knex) {
  await knex.schema.table('orders', function(table) {
    table.dropColumn('new_field');
  });
};
```

## Rollback Procedures

### Database Rollback

```bash
# Rollback to specific version
npm run migrate:rollback -- --to=X

# Rollback all
npm run migrate:rollback -- --all
```

### Application Rollback

1. **Git rollback**
   ```bash
   git checkout <previous-commit>
   npm install
   npm run migrate:rollback
   npm run migrate:latest
   ```

2. **Docker rollback**
   ```bash
   docker-compose down
   git checkout <previous-commit>
   docker-compose up -d
   ```

## Troubleshooting

### Migration Fails

1. Check logs
2. Verify database connection
3. Check for conflicting migrations
4. Review SQL syntax

### Data Loss Prevention

- Always backup before migration
- Test migrations on staging
- Use transactions in migrations
- Keep backups for 30 days

