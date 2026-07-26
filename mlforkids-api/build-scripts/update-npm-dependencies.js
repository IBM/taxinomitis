#!/usr/bin/env node

/**
 * Safer alternative to `ncu -u`.
 *
 * Only applies an upgrade if all of these hold:
 *  - it is a minor/patch bump (never a major bump - those may have breaking
 *    changes and should be reviewed and applied by hand)
 *  - the new version has been published for at least MIN_COOLDOWN_DAYS days
 *    (gives npm time to catch/unpublish compromised releases)
 *  - the new version is backed by a matching tag/release in the package's
 *    own git repository (catches packages published to npm without a
 *    corresponding, reviewable source commit)
 *
 * Anything that doesn't pass all three checks is left alone and reported,
 * so it can be reviewed manually.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ncu = require('npm-check-updates');

const ROOT_DIR = path.join(__dirname, '..');
const PACKAGE_FILE = path.join(ROOT_DIR, 'package.json');
const LOCK_FILE = path.join(ROOT_DIR, 'package-lock.json');
const MIN_COOLDOWN_DAYS = 7;
const REGISTRY = 'https://registry.npmjs.org';
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

let githubRateLimited = false;
const githubRefCache = new Map();


function resolveExactVersion(versionSpec) {
    const cleaned = versionSpec.replace(/^[\^~]/, '').trim();
    const match = cleaned.match(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?/);
    return match ? match[0] : null;
}

function readCurrentVersions() {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
    return { ...pkg.dependencies, ...pkg.devDependencies };
}

/**
 * Packages like tensorflow-models-handpose@0.0.7-4.22.0 use the prerelease/build
 * suffix to pin a version that's peer-dependency-compatible with a specific
 * @tensorflow/tfjs release. A plain semver "minor" upgrade would happily drop
 * that suffix (a bare X.Y.Z outranks X.Y.Z-suffix), silently breaking the
 * compatibility pinning even though a matching git tag genuinely exists.
 * These need a human to pick the right paired version, so leave them alone.
 */
function hasVersionSuffix(versionSpec) {
    const cleaned = versionSpec.replace(/^[\^~]/, '').trim();
    return /^\d+\.\d+\.\d+-/.test(cleaned);
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does any tag/release name plausibly refer to this exact version? */
function releaseExistsForVersion(refs, version) {
    if (!refs || refs.length === 0) {
        return false;
    }
    const escaped = escapeRegExp(version);
    const boundary = new RegExp(`(^|[^0-9A-Za-z.])v?${escaped}($|[^0-9A-Za-z.])`);
    return refs.some((ref) => boundary.test(ref));
}

async function fetchPackageMetadata(pkgName) {
    const encoded = pkgName.startsWith('@') ? pkgName.replace('/', '%2f') : pkgName;
    const res = await fetch(`${REGISTRY}/${encoded}`);
    if (!res.ok) {
        throw new Error(`npm registry returned ${res.status}`);
    }
    return res.json();
}

function parseGithubRepo(pkgMeta, version) {
    const versionMeta = pkgMeta.versions && pkgMeta.versions[version];
    const repoField = (versionMeta && versionMeta.repository) || pkgMeta.repository;
    if (!repoField) {
        return null;
    }
    const url = typeof repoField === 'string' ? repoField : repoField.url;
    if (!url) {
        return null;
    }

    if (url.startsWith('github:')) {
        const [owner, repo] = url.slice('github:'.length).split('/');
        return owner && repo ? { owner, repo: repo.replace(/\.git$/, '') } : null;
    }

    const match = url.match(/github\.com[/:]([^/]+)\/([^/#]+?)(\.git)?\/?(#.*)?$/);
    return match ? { owner: match[1], repo: match[2] } : null;
}

/** Fetch (and cache) the release/tag names for a repo. Returns null if it can't be determined. */
async function fetchGithubRefs(owner, repo) {
    const key = `${owner}/${repo}`;
    if (githubRefCache.has(key)) {
        return githubRefCache.get(key);
    }
    if (githubRateLimited) {
        return null;
    }

    const headers = { 'User-Agent': 'mlforkids-dependency-updater', Accept: 'application/vnd.github+json' };
    if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    try {
        const refs = [];
        for (const endpoint of ['releases', 'tags']) {
            const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/${endpoint}?per_page=100`, { headers });
            if (res.status === 403 || res.status === 429) {
                if (res.headers.get('x-ratelimit-remaining') === '0') {
                    githubRateLimited = true;
                    console.warn('  GitHub API rate limit reached - remaining packages cannot be verified.');
                    console.warn('  Set a GITHUB_TOKEN environment variable to raise the limit and re-run.');
                }
                githubRefCache.set(key, null);
                return null;
            }
            if (!res.ok) {
                continue;
            }
            const body = await res.json();
            for (const entry of body) {
                if (entry.tag_name) {
                    refs.push(entry.tag_name);
                }
                if (entry.name) {
                    refs.push(entry.name);
                }
            }
        }
        githubRefCache.set(key, refs);
        return refs;
    }
    catch (err) {
        console.warn(`  Could not reach GitHub for ${key}: ${err.message}`);
        githubRefCache.set(key, null);
        return null;
    }
}

/** Ask npm-check-updates what it thinks should change, without letting it touch package.json. */
async function getUpgradeCandidates() {
    const baseOptions = { packageFile: PACKAGE_FILE, jsonUpgraded: true, upgrade: false, loglevel: 'silent' };

    console.log('Checking for minor/patch updates that have cleared the cooldown period...');
    const minorAged = await ncu.run({ ...baseOptions, target: 'minor', cooldown: MIN_COOLDOWN_DAYS }) || {};

    console.log('Checking for minor/patch updates held back by the cooldown period...');
    const minorAll = await ncu.run({ ...baseOptions, target: 'minor' }) || {};

    console.log('Checking for major updates (for information only - never applied automatically)...');
    const latestAll = await ncu.run({ ...baseOptions, target: 'latest' }) || {};

    const heldForCooldown = Object.keys(minorAll).filter((pkg) => !(pkg in minorAged));
    const majorAvailable = Object.keys(latestAll).filter((pkg) => latestAll[pkg] !== minorAll[pkg]);

    return { minorAged, heldForCooldown, majorAvailable };
}

/** Verify each cooldown-cleared candidate against its git repo. */
async function verifyAgainstSourceRepo(minorAged, currentVersions) {
    const approved = {};
    const noRepo = [];
    const noRelease = [];
    const rateLimitedPkgs = [];
    const nonStandardCurrent = [];

    const pkgNames = Object.keys(minorAged);
    if (pkgNames.length > 0) {
        console.log(`Verifying ${pkgNames.length} candidate update(s) against their source repos...`);
    }

    for (const pkgName of pkgNames) {
        if (currentVersions[pkgName] && hasVersionSuffix(currentVersions[pkgName])) {
            nonStandardCurrent.push(pkgName);
            continue;
        }

        const newVersion = resolveExactVersion(minorAged[pkgName]);
        if (!newVersion) {
            console.warn(`  ${pkgName}: target version "${minorAged[pkgName]}" is not a concrete version - skipping`);
            noRelease.push(pkgName);
            continue;
        }

        let meta;
        try {
            meta = await fetchPackageMetadata(pkgName);
        }
        catch (err) {
            console.warn(`  ${pkgName}: could not fetch npm registry metadata (${err.message}) - skipping`);
            noRelease.push(pkgName);
            continue;
        }

        const repoInfo = parseGithubRepo(meta, newVersion);
        if (!repoInfo) {
            noRepo.push(pkgName);
            continue;
        }

        const refs = await fetchGithubRefs(repoInfo.owner, repoInfo.repo);
        if (refs === null) {
            (githubRateLimited ? rateLimitedPkgs : noRepo).push(pkgName);
            continue;
        }

        if (releaseExistsForVersion(refs, newVersion)) {
            approved[pkgName] = newVersion;
        }
        else {
            noRelease.push(pkgName);
        }
    }

    return { approved, noRepo, noRelease, rateLimitedPkgs, nonStandardCurrent };
}

/**
 * Applies the approved updates and runs `npm install` to refresh the lockfile.
 *
 * package.json's key order is intentional (ML model packages are grouped at
 * the top of devDependencies) and `npm install` rewrites the whole file,
 * alphabetically re-sorting dependencies/devDependencies as a side effect.
 * To keep that ordering, the version bump is written directly to package.json
 * (never via `npm install <pkg>`), and after `npm install` has done whatever
 * it needs to package-lock.json/node_modules, package.json is written again
 * with our version - same values, original key order - overwriting npm's
 * re-sort. The lockfile isn't affected by this, since it doesn't encode
 * package.json's key order.
 *
 * If npm can't resolve the result (e.g. a peer-dependency conflict that our
 * checks couldn't foresee), everything is rolled back to how it was before
 * this ran, rather than leaving package.json/package-lock.json inconsistent.
 *
 * @returns true if the updates were applied, false if nothing was applied
 *          (either there was nothing to do, or npm install failed and was rolled back)
 */
function applyUpdates(approved) {
    const pkgNames = Object.keys(approved);
    if (pkgNames.length === 0) {
        return false;
    }

    const originalPackageJson = fs.readFileSync(PACKAGE_FILE, 'utf8');
    const originalLockFile = fs.existsSync(LOCK_FILE) ? fs.readFileSync(LOCK_FILE, 'utf8') : null;

    const pkg = JSON.parse(originalPackageJson);
    for (const name of pkgNames) {
        if (pkg.dependencies && name in pkg.dependencies) {
            pkg.dependencies[name] = approved[name];
        }
        else if (pkg.devDependencies && name in pkg.devDependencies) {
            pkg.devDependencies[name] = approved[name];
        }
    }
    const updatedPackageJson = JSON.stringify(pkg, null, 2) + '\n';
    fs.writeFileSync(PACKAGE_FILE, updatedPackageJson, 'utf8');

    console.log('\nRunning npm install to update package-lock.json...');
    const result = spawnSync('npm', ['install'], { cwd: ROOT_DIR, stdio: 'inherit' });

    // restore our key ordering, which npm install just alphabetically re-sorted
    fs.writeFileSync(PACKAGE_FILE, updatedPackageJson, 'utf8');

    if (result.status !== 0) {
        console.error('\nnpm install failed - rolling back package.json and package-lock.json.');
        fs.writeFileSync(PACKAGE_FILE, originalPackageJson, 'utf8');
        if (originalLockFile !== null) {
            fs.writeFileSync(LOCK_FILE, originalLockFile, 'utf8');
        }
        spawnSync('npm', ['install'], { cwd: ROOT_DIR, stdio: 'ignore' });
        fs.writeFileSync(PACKAGE_FILE, originalPackageJson, 'utf8');
        console.error('Rolled back - none of the verified updates were applied. Investigate the npm error above and re-run.');
        process.exitCode = 1;
        return false;
    }
    return true;
}

function printReport({ approved, applied, heldForCooldown, majorAvailable, noRepo, noRelease, rateLimitedPkgs, nonStandardCurrent }) {
    console.log('\n=== Dependency update report ===\n');

    const approvedNames = Object.keys(approved);
    if (approvedNames.length > 0) {
        console.log(`${applied ? 'Applied' : 'Verified but NOT applied (npm install failed, see above)'} (${approvedNames.length}):`);
        for (const name of approvedNames) {
            console.log(`  ${name} -> ${approved[name]}`);
        }
    }
    else {
        console.log('Applied: none');
    }

    if (nonStandardCurrent.length > 0) {
        console.log(`\nSkipped - current version has a non-standard suffix, review manually (${nonStandardCurrent.length}):`);
        for (const name of nonStandardCurrent) {
            console.log(`  ${name}`);
        }
    }

    if (heldForCooldown.length > 0) {
        console.log(`\nSkipped - too recently published (< ${MIN_COOLDOWN_DAYS} days old) (${heldForCooldown.length}):`);
        for (const name of heldForCooldown) {
            console.log(`  ${name}`);
        }
    }

    if (noRelease.length > 0) {
        console.log(`\nSkipped - no matching release/tag found in source repo (${noRelease.length}):`);
        for (const name of noRelease) {
            console.log(`  ${name}`);
        }
    }

    if (noRepo.length > 0) {
        console.log(`\nSkipped - could not verify a GitHub repo for this package (${noRepo.length}):`);
        for (const name of noRepo) {
            console.log(`  ${name}`);
        }
    }

    if (rateLimitedPkgs.length > 0) {
        console.log(`\nSkipped - GitHub API rate limit reached before these could be checked (${rateLimitedPkgs.length}):`);
        for (const name of rateLimitedPkgs) {
            console.log(`  ${name}`);
        }
        console.log('  Set a GITHUB_TOKEN environment variable and re-run to check these.');
    }

    if (majorAvailable.length > 0) {
        console.log(`\nMajor updates available - review and apply manually (${majorAvailable.length}):`);
        for (const name of majorAvailable) {
            console.log(`  ${name}`);
        }
    }

    console.log('');
}

async function main() {
    const currentVersions = readCurrentVersions();
    const { minorAged, heldForCooldown, majorAvailable } = await getUpgradeCandidates();
    const { approved, noRepo, noRelease, rateLimitedPkgs, nonStandardCurrent } =
        await verifyAgainstSourceRepo(minorAged, currentVersions);

    const applied = applyUpdates(approved);
    printReport({ approved, applied, heldForCooldown, majorAvailable, noRepo, noRelease, rateLimitedPkgs, nonStandardCurrent });
}

main().catch((err) => {
    console.error('Dependency update failed:', err);
    process.exit(1);
});
