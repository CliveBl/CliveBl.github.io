# CliveBl.github.io

Personal website built with Jekyll and deployed to Cloudflare Workers.

## Local Development

1. Install Ruby 3.4.5
2. Install dependencies:
   ```bash
   gem install bundler
   bundle install
   ```
3. Run the development server:
   ```bash
   bundle exec jekyll serve
   ```

## Deployment

This site is automatically deployed to Cloudflare Workers via GitHub Actions when changes are pushed to the `jekyll` branch.

### Prerequisites

1. **Cloudflare API Token**: Create a Cloudflare API token with the following permissions:
   - Account: Cloudflare Workers:Edit
   - Zone: Cloudflare Workers:Edit
   - User: Cloudflare Workers:Edit

2. **GitHub Secrets**: Add the following secret to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token

### Deployment Process

1. Push changes to the `jekyll` branch
2. GitHub Actions will automatically:
   - Build the Jekyll site
   - Deploy to Cloudflare Workers using Wrangler CLI
   - Serve the static site from the `_site` directory

### Configuration Files

- `.github/workflows/deploy.yml`: GitHub Actions workflow
- `wrangler.jsonc`: Cloudflare Workers configuration
- `_config.yml`: Jekyll configuration
- `Gemfile`: Ruby dependencies

## Project Structure

- `_site/`: Built Jekyll site (generated, not committed)
- `css/`: Stylesheets
- `js/`: JavaScript files
- `_posts/`: Blog posts
- `_includes/`: Jekyll includes
- `_layouts/`: Jekyll layouts
