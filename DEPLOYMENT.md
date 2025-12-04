# Documentation Deployment Guide

This guide covers deploying the node-webcodecs Mintlify documentation.

## Option 1: Mintlify Cloud (Recommended)

Mintlify provides free hosting for open-source projects.

### Setup Steps

1. **Sign up for Mintlify**
   - Go to https://mintlify.com
   - Sign up with your GitHub account
   - Connect your repository: `caseymanos/node-webcodecs`

2. **Configure the project**
   - Mintlify will automatically detect the `docs/mint.json` file
   - Set the subdomain (e.g., `node-webcodecs.mintlify.app`)

3. **Get API Key** (for GitHub Actions)
   - Go to Mintlify dashboard → Settings → API Keys
   - Generate a new API key
   - Add it to GitHub Secrets:
     - Repository Settings → Secrets → Actions
     - Name: `MINTLIFY_API_KEY`
     - Value: Your API key

4. **Deploy**
   - Push to `main` branch
   - GitHub Actions will automatically deploy
   - Or manually: `cd docs && mintlify deploy`

### Automatic Deployment

The GitHub Action (`.github/workflows/mintlify-deploy.yml`) automatically deploys when:
- Changes are pushed to `main` branch
- Files in `docs/` are modified

### Manual Deployment

```bash
cd docs
mintlify deploy
```

---

## Option 2: Self-Hosted on Vercel

Deploy the documentation to your own Vercel account.

### Setup Steps

1. **Install Vercel CLI** (if not already installed)
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Or use Vercel GitHub Integration**
   - Go to https://vercel.com/new
   - Import the `caseymanos/node-webcodecs` repository
   - Vercel will auto-detect settings from `vercel.json`
   - Deploy!

### Configuration

The `vercel.json` file is pre-configured with:
- Framework: Next.js (Mintlify uses Next.js)
- Build command: `cd docs && mintlify build`
- Output directory: `docs/_next`

### Custom Domain (Optional)

1. Go to Vercel Project Settings → Domains
2. Add your custom domain (e.g., `docs.node-webcodecs.com`)
3. Configure DNS records as instructed

---

## Option 3: GitHub Pages

For a simple static deployment:

1. **Build the docs**
   ```bash
   cd docs
   mintlify build
   ```

2. **Deploy to GitHub Pages**
   ```bash
   # Install gh-pages
   npm install -g gh-pages

   # Deploy
   gh-pages -d docs/_next
   ```

3. **Enable GitHub Pages**
   - Repository Settings → Pages
   - Source: `gh-pages` branch
   - Save

---

## Updating Documentation

After editing `.mdx` files:

1. **Test locally**
   ```bash
   cd docs
   mintlify dev
   ```
   Preview at http://localhost:3000

2. **Commit and push**
   ```bash
   git add docs/
   git commit -m "Update documentation"
   git push origin main
   ```

3. **Automatic deployment**
   - Mintlify Cloud: Auto-deploys via GitHub Action
   - Vercel: Auto-deploys via Vercel integration
   - GitHub Pages: Manual `gh-pages -d docs/_next`

---

## Troubleshooting

### Build fails

1. Check `mint.json` syntax:
   ```bash
   cd docs
   mintlify dev
   ```

2. Ensure all referenced files exist:
   ```bash
   # The mint.json references these files
   ls -la docs/getting-started/
   ls -la docs/guides/
   ls -la docs/cookbook/
   ```

### Deployment not updating

1. **Mintlify Cloud**: Check GitHub Actions logs
2. **Vercel**: Check Vercel deployment logs
3. **Clear cache**: Force rebuild in platform settings

### Custom domain not working

1. Verify DNS records (usually CNAME or A record)
2. Wait for DNS propagation (up to 48 hours)
3. Check platform-specific SSL certificate status

---

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## Current Deployment

**Local Development**: http://localhost:3001

**Production** (after setup):
- Mintlify Cloud: `https://node-webcodecs.mintlify.app` (or custom domain)
- Vercel: `https://node-webcodecs.vercel.app` (or custom domain)
- GitHub Pages: `https://caseymanos.github.io/node-webcodecs/`

Choose the option that best fits your needs. Mintlify Cloud is recommended for the best integration and features.
