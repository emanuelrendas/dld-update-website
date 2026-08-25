/**
 * RAIOC IKL - Version Management Engine
 * Manages semantic versioning, schema compatibility, and knowledge base changelogs.
 */

export const IKL_CURRENT_VERSION = '1.0.0';

export class VersionManager {
  constructor() {
    this.currentVersion = IKL_CURRENT_VERSION;
    this.versionHistory = [
      {
        version: '1.0.0',
        releaseDate: '2026-08-24T00:00:00.000Z',
        name: 'IKL Foundation v1.0',
        status: 'ACTIVE',
        description: 'Initial institutional knowledge base: communities, developers, regulations, tax, personas, strategies, provenance, and confidence scoring.',
        schemaVersion: '1.0',
      },
    ];
  }

  getCurrentVersion() {
    return this.currentVersion;
  }

  getVersionMetadata(version = this.currentVersion) {
    const found = this.versionHistory.find((v) => v.version === version);
    if (!found) {
      throw new Error(`IKL Version not found in history: ${version}`);
    }
    return { ...found };
  }

  isCompatible(requiredVersion) {
    if (!requiredVersion) return true;
    const [reqMajor] = requiredVersion.split('.').map(Number);
    const [currMajor] = this.currentVersion.split('.').map(Number);
    return reqMajor === currMajor;
  }

  getChangelog() {
    return [...this.versionHistory];
  }
}

export const versionManager = new VersionManager();
