# Deployment Guide

This project uses GitHub Actions to automatically deploy to Cloudflare Workers with separate staging and production environments.

## How It Works

### Automatic Staging Deployment
- **Trigger**: Every push to the `staging` branch
- **Process**: 
  1. Builds the Jekyll site and TypeScript
  2. Creates a build artifact
  3. Automatically deploys to staging environment (`cgt-staging`)

### Manual Production Deployment
- **Trigger**: Manual workflow dispatch from GitHub Actions UI
- **Process**:
  1. Uses the same build artifact from staging
  2. Deploys to production environment (`cgt-production`)
  3. Ensures staging and production are identical

## Deployment Process

### 1. Staging Deployment
```bash
# Push to staging branch
git push origin staging
```
This automatically triggers the workflow and deploys to staging.

### 2. Production Deployment
1. Go to GitHub Actions → Deploy to Cloudflare Workers
2. Click "Run workflow"
3. Select "production" from the environment dropdown
4. Click "Run workflow"

## Environment Configuration

### Staging
- **Worker Name**: `cgt-staging`
- **Configuration**: `wrangler.jsonc`
- **Auto-deploy**: Yes (on push to staging branch)

### Production
- **Worker Name**: `cgt-production`
- **Configuration**: `wrangler.prod.jsonc`
- **Auto-deploy**: No (manual approval required)

## Build Artifact Strategy

Both environments use the exact same build artifact to ensure:
- Staging and production are identical
- No risk of different builds between environments
- Consistent behavior across environments

## Prerequisites

1. **Cloudflare API Token**: Set as `CLOUDFLARE_API_TOKEN` secret in GitHub repository
2. **Staging Branch**: Must exist and be the target for staging deployments
3. **Wrangler CLI**: Automatically installed during workflow execution

## Troubleshooting

### Common Issues
1. **Build fails**: Check Node.js and Ruby versions in workflow
2. **Deployment fails**: Verify Cloudflare API token has proper permissions
3. **Staging not deploying**: Ensure you're pushing to `staging` branch, not `main`

### Manual Deployment
If automatic deployment fails, you can manually trigger the workflow:
1. Go to Actions tab
2. Select "Deploy to Cloudflare Workers"
3. Click "Run workflow"
4. Choose environment and run
