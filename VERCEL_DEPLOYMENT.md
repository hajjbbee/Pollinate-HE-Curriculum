# Vercel Deployment Guide for Pollinate

## Prerequisites
- GitHub account with repository access
- Vercel account (free tier works)
- All environment variables ready

## Step 1: Push Code to GitHub

First, ensure all your latest changes are committed and pushed:

```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

## Step 2: Connect Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the repository for Pollinate

## Step 3: Configure Build Settings

Vercel should auto-detect the settings from `vercel.json`, but verify:

- **Framework Preset**: Other
- **Build Command**: `npm run build`
- **Output Directory**: `dist/public`
- **Install Command**: `npm install`

## Step 4: Set Environment Variables

In the Vercel project settings, add all required environment variables:

### Required Secrets (Production)
```
ANTHROPIC_API_KEY=your_anthropic_key
DATABASE_URL=your_neon_postgres_url
GOOGLE_MAPS_API_KEY=your_google_maps_key
OPENROUTER_API_KEY=your_openrouter_key
SESSION_SECRET=your_session_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
XAI_API_KEY=your_xai_key
```

### Stripe Public Key (Environment Variable - starts with VITE_)
```
VITE_STRIPE_PUBLIC_KEY=your_stripe_public_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### Object Storage (If using Google Cloud Storage)
```
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your_bucket_id
PUBLIC_OBJECT_SEARCH_PATHS=your_search_paths
PRIVATE_OBJECT_DIR=your_private_dir
```

### Database Connection Variables
```
PGHOST=your_pg_host
PGPORT=5432
PGDATABASE=your_database_name
PGUSER=your_pg_user
PGPASSWORD=your_pg_password
```

**Important**: Make sure all `VITE_` prefixed variables are set as they're needed for the frontend build process.

## Step 5: Deploy

1. Click "Deploy"
2. Vercel will build and deploy your application
3. Monitor the build logs for any errors

## Step 6: Configure Custom Domain

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add `pollinatecurriculum.com`
4. Follow Vercel's DNS configuration instructions
5. Update your domain's DNS records as instructed

## Step 7: Configure Stripe Webhooks

After deployment, update your Stripe webhook endpoint:

1. Go to Stripe Dashboard > Developers > Webhooks
2. Update the endpoint URL to: `https://pollinatecurriculum.com/api/stripe/webhook`
3. Copy the new webhook secret
4. Update `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
5. Redeploy if needed

## Step 8: Database Migration (If Needed)

If you need to sync your database schema:

```bash
npm run db:push
```

This should be run locally pointing to your production database, or you can run it via Vercel's CLI.

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set correctly

### Runtime Errors
- Check Vercel function logs
- Verify database connection string is correct
- Ensure all secrets are properly configured

### Environment Variables Not Working
- `VITE_` prefixed variables must be set before build
- Redeploy after adding new environment variables
- Check variable names match exactly (case-sensitive)

## Production Checklist

- [ ] All environment variables configured
- [ ] Custom domain configured and DNS updated
- [ ] Stripe webhooks updated to production URL
- [ ] Database schema migrated
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Test authentication flow
- [ ] Test payment flow (use Stripe test mode first)
- [ ] Test curriculum generation
- [ ] Verify all API integrations work

## Replit as Development Environment

Your Replit environment remains your development workspace:
- Make changes in Replit
- Test locally
- Push to GitHub
- Vercel auto-deploys from `main` branch

## Monitoring

After deployment:
- Monitor Vercel Analytics for performance
- Check Vercel function logs for errors
- Set up Sentry or similar for error tracking (optional)
- Monitor Stripe dashboard for payment issues

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- GitHub Issues: For code-related problems
