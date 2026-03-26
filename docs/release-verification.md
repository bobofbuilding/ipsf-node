# Release Verification

Use this runbook when you download a tagged installer release from GitHub and want to verify integrity, bundle consistency, and provenance before running it.

## Download

Fast path from the repo checkout:

```bash
cd /workspace/projects/ipfs-evm-system
npm run release:verify-download -- --tag v0.1.0
npm run release:verify-download -- --json
```

Manual download path:

```bash
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh -o install-ipfs-node.sh
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh.sha256 -o install-ipfs-node.sh.sha256
curl -fsSL https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-manifest.json -o release-manifest.json
```

## Integrity Check

Confirm the installer matches the published SHA-256 file:

```bash
shasum -a 256 -c install-ipfs-node.sh.sha256
```

Expected result:

- `install-ipfs-node.sh: OK`

## Bundle Validation

Validate the installer, checksum file, and manifest together through the repo validator:

```bash
mkdir -p dist/release
mv install-ipfs-node.sh install-ipfs-node.sh.sha256 release-manifest.json dist/release/
npm run release:validate
```

Expected result:

- `release-installer:validated`
- printed installer, checksum, manifest, and SHA-256 paths

This confirms:

- the checksum file references the expected installer filename
- the checksum file matches the installer contents
- the release manifest references the same installer and checksum files
- the manifest SHA matches the installer contents

## Provenance Check

Tagged releases also generate GitHub Artifact Attestations through `.github/workflows/release.yml`. Review the release or Actions UI for the attestation tied to the same tag and artifact set:

- `install-ipfs-node.sh`
- `install-ipfs-node.sh.sha256`
- `release-manifest.json`

Use that attestation to confirm the release bundle was produced by this repository's tagged release workflow, not just that the files are internally consistent.

## Run After Verification

Once the release bundle passes all checks:

```bash
bash dist/release/install-ipfs-node.sh
```
