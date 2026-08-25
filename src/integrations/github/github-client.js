/**
 * RAIOC Integrations - GitHub REST API Client
 * Inspects commit logs, deployment workflows, release tags, and repository health.
 */

import { logger } from '../../logging/audit-logger.js';

export class GitHubClient {
  constructor(options = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN || '';
    this.repo = options.repo || process.env.GITHUB_REPO || 'emanuelrendas/raioc-os';
    this.enabled = options.enabled !== undefined ? options.enabled : Boolean(this.token);
  }

  async getRepoStatus() {
    if (!this.enabled || !this.token) {
      return {
        status: 'simulated',
        repository: this.repo,
        branch: 'main',
        latestCommit: '286a017',
        ciStatus: 'SUCCESS',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${this.repo}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        throw new Error(`GitHub API returned status ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return { status: 'live', repository: this.repo, stars: data.stargazers_count, defaultBranch: data.default_branch };
    } catch (err) {
      logger.error('GITHUB_CLIENT', `Failed to fetch repo status: ${err.message}`);
      return { status: 'error', error: err.message };
    }
  }
}

export const gitHubClient = new GitHubClient();
