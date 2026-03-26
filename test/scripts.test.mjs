import test from "node:test";
import assert from "node:assert/strict";

import { runCheckNode } from "../scripts/check-node.mjs";
import { runRecoveryExport, timestampUtc } from "../scripts/export-recovery-artifacts.mjs";
import { runPreflight } from "../scripts/preflight-node.mjs";
import { runPublishPath } from "../scripts/publish-path.mjs";
import { runReleasePackaging } from "../scripts/release-installer.mjs";
import { runReleaseValidation } from "../scripts/validate-release.mjs";
import { runReleaseDownloadVerification } from "../scripts/verify-release-download.mjs";
import { parseSetupArgs, runNodeSetup } from "../scripts/setup-node.mjs";

test("runCheckNode reports healthy node details", async () => {
  const out = [];
  const err = [];
  const exitCode = await runCheckNode({
    client: {
      checkNodeHealth: async () => ({ available: true, version: "1.0.0", id: "node-123" }),
    },
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  assert.deepEqual(out, ["ipfs-node:available", "version=1.0.0", "id=node-123"]);
});

test("runCheckNode reports unavailable node errors", async () => {
  const out = [];
  const err = [];
  const exitCode = await runCheckNode({
    client: {
      checkNodeHealth: async () => ({ available: false, error: "connect ECONNREFUSED" }),
    },
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(out, []);
  assert.deepEqual(err, ["ipfs-node:unavailable", "connect ECONNREFUSED"]);
});

test("runPreflight reports configured binary version", () => {
  const out = [];
  const err = [];
  const exitCode = runPreflight({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      defaultSourceProject: "ipfs-evm-system",
      cliPath: "/mock/ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: () => true,
    spawnSync: () => ({ status: 0, stdout: "ipfs version 0.0.1\n", stderr: "" }),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(err.length, 0);
  assert.equal(out.at(-1), "ipfs version 0.0.1");
});

test("runPreflight accepts command-name cli paths", () => {
  const out = [];
  const err = [];
  const exitCode = runPreflight({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      defaultSourceProject: null,
      cliPath: "ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: () => false,
    spawnSync: () => ({ status: 0, stdout: "ipfs version 0.0.2\n", stderr: "" }),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  assert.equal(out.at(-1), "ipfs version 0.0.2");
});

test("parseSetupArgs reads ports and repo overrides", () => {
  const options = parseSetupArgs([
    "--repo-path",
    "/tmp/ipfs",
    "--api-port",
    "7001",
    "--gateway-port=9090",
    "--profile=badgerds",
    "--no-default-cors",
    "--cors-origin",
    "http://localhost:8081",
  ], {
    apiBaseUrl: "http://127.0.0.1:5001",
    gatewayBaseUrl: "http://127.0.0.1:8080",
    cliPath: "ipfs",
    repoPath: "/mock/repo",
  });

  assert.equal(options.repoPath, "/tmp/ipfs");
  assert.equal(options.apiPort, 7001);
  assert.equal(options.gatewayPort, 9090);
  assert.equal(options.profile, "badgerds");
  assert.deepEqual(options.corsOrigins, ["http://localhost:8081"]);
});

test("runNodeSetup initializes and configures a repo", () => {
  const out = [];
  const err = [];
  const calls = [];
  const exitCode = runNodeSetup({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      cliPath: "/mock/ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: (filePath) => filePath === "/mock/repo/config" ? false : true,
    mkdirSync: () => {},
    spawnSync: (_cliPath, args) => {
      calls.push(args);
      return { status: 0, stdout: "", stderr: "" };
    },
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  assert.deepEqual(calls, [
    ["init", "--profile=server"],
    ["config", "Addresses.API", "/ip4/127.0.0.1/tcp/5001"],
    ["config", "Addresses.Gateway", "/ip4/127.0.0.1/tcp/8080"],
    ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Origin", JSON.stringify([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ])],
    ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Methods", JSON.stringify(["GET", "POST", "PUT"])],
    ["config", "--json", "API.HTTPHeaders.Access-Control-Allow-Credentials", JSON.stringify(["true"])],
  ]);
  assert.equal(out[0], "ipfs-repo:initialized");
  assert.equal(out.at(-1), "startCommand=IPFS_PATH=/mock/repo /mock/ipfs daemon");
});

test("runNodeSetup skips init when the repo already exists", () => {
  const calls = [];
  const out = [];
  const exitCode = runNodeSetup({
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      cliPath: "ipfs",
      repoPath: "/mock/repo",
    },
    existsSync: () => true,
    mkdirSync: () => {},
    spawnSync: (_cliPath, args) => {
      calls.push(args);
      return { status: 0, stdout: "", stderr: "" };
    },
    stdout: (line) => out.push(line),
    stderr: () => {},
  });

  assert.equal(exitCode, 0);
  assert.equal(out[0], "ipfs-repo:existing");
  assert.equal(calls[0][0], "config");
});

test("runReleasePackaging writes installer, checksum, and manifest artifacts", async () => {
  const writes = new Map();
  const out = [];
  const exitCode = await runReleasePackaging({
    outputDir: "/tmp/ipfs-release",
    releaseVersion: "v0.1.0",
    commitSha: "abc123",
    readFileImpl: async (filePath, encoding) => {
      if (String(filePath).endsWith("package.json")) {
        return JSON.stringify({ name: "@workspace/ipfs-storage", version: "0.1.0" });
      }
      const installer = [
        'KUBO_VERSION="${KUBO_VERSION:-0.33.2}"',
        '#!/usr/bin/env bash',
        'echo ok',
        '',
      ].join('\n');
      return encoding ? installer : Buffer.from(installer);
    },
    mkdirImpl: async () => {},
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    stdout: (line) => out.push(line),
  });

  assert.equal(exitCode, 0);
  assert.match(writes.get("/tmp/ipfs-release/install-ipfs-node.sh").toString(), /echo ok/);
  const checksumText = writes.get("/tmp/ipfs-release/install-ipfs-node.sh.sha256").toString();
  assert.match(checksumText, /^[a-f0-9]{64}  install-ipfs-node\.sh\n$/);
  const manifest = JSON.parse(writes.get("/tmp/ipfs-release/release-manifest.json").toString());
  assert.equal(manifest.packageName, "@workspace/ipfs-storage");
  assert.equal(manifest.packageVersion, "0.1.0");
  assert.equal(manifest.releaseVersion, "v0.1.0");
  assert.equal(manifest.commitSha, "abc123");
  assert.equal(manifest.kuboVersion, "0.33.2");
  assert.equal(manifest.checksumFile, "install-ipfs-node.sh.sha256");
  assert.equal(out[0], "release-installer:prepared");
});


test("runReleaseValidation emits machine-readable success output", async () => {
  const out = [];
  const exitCode = await runReleaseValidation({
    argv: ["--json"],
    installerPath: "/tmp/ipfs-release/install-ipfs-node.sh",
    checksumPath: "/tmp/ipfs-release/install-ipfs-node.sh.sha256",
    manifestPath: "/tmp/ipfs-release/release-manifest.json",
    readFileImpl: async (filePath, encoding) => {
      if (String(filePath).endsWith("install-ipfs-node.sh")) {
        const installer = '#!/usr/bin/env bash\necho ok\n';
        return encoding ? installer : Buffer.from(installer);
      }
      if (String(filePath).endsWith("install-ipfs-node.sh.sha256")) {
        return '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be  install-ipfs-node.sh\n';
      }
      return JSON.stringify({
        installerFile: 'install-ipfs-node.sh',
        checksumFile: 'install-ipfs-node.sh.sha256',
        installerSha256: '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be',
      });
    },
    stdout: (line) => out.push(line),
    stderr: () => {},
  });

  assert.equal(exitCode, 0);
  const payload = JSON.parse(out[0]);
  assert.equal(payload.ok, true);
  assert.equal(payload.sha256, '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be');
  assert.equal(payload.installer, '/tmp/ipfs-release/install-ipfs-node.sh');
});

test("runReleaseValidation writes a JSON report file when requested", async () => {
  const writes = new Map();
  const out = [];
  const exitCode = await runReleaseValidation({
    argv: ["--json", "--report-file", "/tmp/ipfs-release/release-validation-report.json"],
    installerPath: "/tmp/ipfs-release/install-ipfs-node.sh",
    checksumPath: "/tmp/ipfs-release/install-ipfs-node.sh.sha256",
    manifestPath: "/tmp/ipfs-release/release-manifest.json",
    readFileImpl: async (filePath, encoding) => {
      if (String(filePath).endsWith("install-ipfs-node.sh")) {
        const installer = '#!/usr/bin/env bash\necho ok\n';
        return encoding ? installer : Buffer.from(installer);
      }
      if (String(filePath).endsWith("install-ipfs-node.sh.sha256")) {
        return '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be  install-ipfs-node.sh\n';
      }
      return JSON.stringify({
        installerFile: 'install-ipfs-node.sh',
        checksumFile: 'install-ipfs-node.sh.sha256',
        installerSha256: '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be',
      });
    },
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    stdout: (line) => out.push(line),
    stderr: () => {},
  });

  assert.equal(exitCode, 0);
  const stdoutPayload = JSON.parse(out[0]);
  const filePayload = JSON.parse(writes.get('/tmp/ipfs-release/release-validation-report.json').toString('utf8'));
  assert.deepEqual(filePayload, stdoutPayload);
  assert.equal(filePayload.reportFile, '/tmp/ipfs-release/release-validation-report.json');
});

test("runReleaseDownloadVerification downloads and validates a tagged release bundle", async () => {
  const writes = new Map();
  const out = [];
  const err = [];
  const installer = Buffer.from('#!/usr/bin/env bash\necho ok\n');
  const sha = '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be';
  const responses = new Map([
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/install-ipfs-node.sh', installer],
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/install-ipfs-node.sh.sha256', Buffer.from(sha + '  install-ipfs-node.sh\n')],
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/release-manifest.json', Buffer.from(JSON.stringify({
      installerFile: 'install-ipfs-node.sh',
      checksumFile: 'install-ipfs-node.sh.sha256',
      installerSha256: sha,
    }))],
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/release-validation-report.json', Buffer.from(JSON.stringify({
      ok: true,
      installer: '/release/install-ipfs-node.sh',
      checksum: '/release/install-ipfs-node.sh.sha256',
      manifest: '/release/release-manifest.json',
      sha256: sha,
    }))],
  ]);

  const exitCode = await runReleaseDownloadVerification({
    argv: ['--tag', 'v0.1.0', '--output-dir', '/tmp/verify-download'],
    fetchImpl: async (url) => ({
      ok: responses.has(url),
      arrayBuffer: async () => responses.get(url),
    }),
    mkdirImpl: async () => {},
    readFileImpl: async (filePath, encoding) => {
      const value = writes.get(filePath);
      if (value === undefined) {
        throw new Error('Missing mocked file: ' + filePath);
      }
      if (encoding) {
        return value.toString(encoding);
      }
      return value;
    },
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    validateReleaseImpl: (options) => runReleaseValidation({
      ...options,
      readFileImpl: async (filePath, encoding) => {
        const value = writes.get(filePath);
        if (value === undefined) {
          throw new Error('Missing mocked file: ' + filePath);
        }
        if (encoding) {
          return value.toString(encoding);
        }
        return value;
      },
    }),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(err, []);
  assert.equal(writes.get('/tmp/verify-download/install-ipfs-node.sh').toString(), installer.toString());
  assert.equal(out[0], 'downloaded=install-ipfs-node.sh');
  assert.ok(out.includes('release-installer:validated'));
  assert.ok(out.includes('release-validation-report:matched'));
  assert.equal(out.at(-2), 'releaseVersion=v0.1.0');
  assert.equal(out.at(-1), 'outputDir=/tmp/verify-download');
});

test("runReleaseDownloadVerification reports download failures", async () => {
  const err = [];
  const exitCode = await runReleaseDownloadVerification({
    argv: ['--tag', 'v0.1.0'],
    fetchImpl: async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
    mkdirImpl: async () => {},
    writeFileImpl: async () => {},
    stdout: () => {},
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(err[0], 'release-download:invalid');
  assert.match(err[1], /Failed to download install-ipfs-node\.sh/);
});


test("runReleaseDownloadVerification emits machine-readable success output", async () => {
  const writes = new Map();
  const out = [];
  const installer = Buffer.from('#!/usr/bin/env bash\necho ok\n');
  const sha = '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be';
  const responses = new Map([
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh', installer],
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh.sha256', Buffer.from(sha + '  install-ipfs-node.sh\n')],
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-manifest.json', Buffer.from(JSON.stringify({
      installerFile: 'install-ipfs-node.sh',
      checksumFile: 'install-ipfs-node.sh.sha256',
      installerSha256: sha,
    }))],
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-validation-report.json', Buffer.from(JSON.stringify({
      ok: true,
      installer: '/release/install-ipfs-node.sh',
      checksum: '/release/install-ipfs-node.sh.sha256',
      manifest: '/release/release-manifest.json',
      sha256: sha,
    }))],
  ]);

  const exitCode = await runReleaseDownloadVerification({
    argv: ['--json', '--output-dir', '/tmp/verify-download-json'],
    fetchImpl: async (url) => ({
      ok: responses.has(url),
      arrayBuffer: async () => responses.get(url),
    }),
    mkdirImpl: async () => {},
    readFileImpl: async (filePath, encoding) => {
      const value = writes.get(filePath);
      if (value === undefined) {
        throw new Error('Missing mocked file: ' + filePath);
      }
      if (encoding) {
        return value.toString(encoding);
      }
      return value;
    },
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    validateReleaseImpl: (options) => runReleaseValidation({
      ...options,
      readFileImpl: async (filePath, encoding) => {
        const value = writes.get(filePath);
        if (value === undefined) {
          throw new Error('Missing mocked file: ' + filePath);
        }
        if (encoding) {
          return value.toString(encoding);
        }
        return value;
      },
    }),
    stdout: (line) => out.push(line),
    stderr: () => {},
  });

  assert.equal(exitCode, 0);
  assert.equal(out.length, 1);
  const payload = JSON.parse(out[0]);
  assert.equal(payload.ok, true);
  assert.equal(payload.releaseVersion, 'latest');
  assert.deepEqual(payload.downloadedFiles, [
    'install-ipfs-node.sh',
    'install-ipfs-node.sh.sha256',
    'release-manifest.json',
    'release-validation-report.json',
  ]);
  assert.equal(payload.validation.ok, true);
  assert.equal(payload.validation.sha256, sha);
  assert.equal(payload.validation.installer, '/tmp/verify-download-json/install-ipfs-node.sh');
  assert.equal(payload.publishedValidationReport.matches, true);
});

test("runReleaseDownloadVerification reports published validation report mismatches", async () => {
  const writes = new Map();
  const err = [];
  const installer = Buffer.from('#!/usr/bin/env bash\necho ok\n');
  const sha = '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be';
  const responses = new Map([
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/install-ipfs-node.sh', installer],
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/install-ipfs-node.sh.sha256', Buffer.from(sha + '  install-ipfs-node.sh\n')],
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/release-manifest.json', Buffer.from(JSON.stringify({
      installerFile: 'install-ipfs-node.sh',
      checksumFile: 'install-ipfs-node.sh.sha256',
      installerSha256: sha,
    }))],
    ['https://github.com/bobofbuilding/ipsf-node/releases/download/v0.1.0/release-validation-report.json', Buffer.from(JSON.stringify({
      ok: true,
      installer: '/release/install-ipfs-node.sh',
      checksum: '/release/install-ipfs-node.sh.sha256',
      manifest: '/release/release-manifest.json',
      sha256: 'badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb',
    }))],
  ]);

  const exitCode = await runReleaseDownloadVerification({
    argv: ['--tag', 'v0.1.0'],
    fetchImpl: async (url) => ({
      ok: responses.has(url),
      arrayBuffer: async () => responses.get(url),
    }),
    mkdirImpl: async () => {},
    readFileImpl: async (filePath, encoding) => {
      const value = writes.get(filePath);
      if (value === undefined) {
        throw new Error('Missing mocked file: ' + filePath);
      }
      if (encoding) {
        return value.toString(encoding);
      }
      return value;
    },
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    validateReleaseImpl: (options) => runReleaseValidation({
      ...options,
      readFileImpl: async (filePath, encoding) => {
        const value = writes.get(filePath);
        if (value === undefined) {
          throw new Error('Missing mocked file: ' + filePath);
        }
        if (encoding) {
          return value.toString(encoding);
        }
        return value;
      },
    }),
    stdout: () => {},
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(err[0], 'release-download:invalid');
  assert.match(err[1], /Published validation report does not match downloaded bundle/);
});

test("runReleaseDownloadVerification writes a JSON report file when requested", async () => {
  const writes = new Map();
  const out = [];
  const installer = Buffer.from('#!/usr/bin/env bash\necho ok\n');
  const sha = '0d7a2a90fd5f06a2eaf2b41ab8ee127b13dafa466f48f7f92ad624edce3942be';
  const responses = new Map([
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh', installer],
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/install-ipfs-node.sh.sha256', Buffer.from(sha + '  install-ipfs-node.sh\n')],
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-manifest.json', Buffer.from(JSON.stringify({
      installerFile: 'install-ipfs-node.sh',
      checksumFile: 'install-ipfs-node.sh.sha256',
      installerSha256: sha,
    }))],
    ['https://github.com/bobofbuilding/ipsf-node/releases/latest/download/release-validation-report.json', Buffer.from(JSON.stringify({
      ok: true,
      installer: '/release/install-ipfs-node.sh',
      checksum: '/release/install-ipfs-node.sh.sha256',
      manifest: '/release/release-manifest.json',
      sha256: sha,
    }))],
  ]);

  const exitCode = await runReleaseDownloadVerification({
    argv: ['--json', '--output-dir', '/tmp/verify-download-report', '--report-file', '/tmp/verify-download-report/report.json'],
    fetchImpl: async (url) => ({
      ok: responses.has(url),
      arrayBuffer: async () => responses.get(url),
    }),
    mkdirImpl: async () => {},
    readFileImpl: async (filePath, encoding) => {
      const value = writes.get(filePath);
      if (value === undefined) {
        throw new Error('Missing mocked file: ' + filePath);
      }
      if (encoding) {
        return value.toString(encoding);
      }
      return value;
    },
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    validateReleaseImpl: (options) => runReleaseValidation({
      ...options,
      readFileImpl: async (filePath, encoding) => {
        const value = writes.get(filePath);
        if (value === undefined) {
          throw new Error('Missing mocked file: ' + filePath);
        }
        if (encoding) {
          return value.toString(encoding);
        }
        return value;
      },
    }),
    stdout: (line) => out.push(line),
    stderr: () => {},
  });

  assert.equal(exitCode, 0);
  const stdoutPayload = JSON.parse(out[0]);
  const filePayload = JSON.parse(writes.get('/tmp/verify-download-report/report.json').toString('utf8'));
  assert.deepEqual(filePayload, stdoutPayload);
  assert.equal(filePayload.reportFile, '/tmp/verify-download-report/report.json');
});

test("runPublishPath rejects missing argv path", async () => {
  const err = [];
  const exitCode = await runPublishPath({
    argv: [],
    stderr: (line) => err.push(line),
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(err, ["usage: npm run publish:path -- <path> [source-project]"]);
});

test("runPublishPath publishes a file with expected metadata", async () => {
  const calls = [];
  const out = [];
  const exitCode = await runPublishPath({
    argv: ["./artifact.json", "skillmesh"],
    client: {
      publishFile: async (input) => {
        calls.push(input);
        return { cid: "bafytest", name: "artifact.json" };
      },
    },
    detectTarget: async () => ({ isFile: true, isDirectory: false }),
    stdout: (line) => out.push(line),
  });

  assert.equal(exitCode, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceProject, "skillmesh");
  assert.equal(calls[0].metadata.kind, "file");
  assert.match(calls[0].metadata.path, /artifact\.json$/);
  assert.match(out[0], /bafytest/);
});

test("timestampUtc formats deterministic UTC stamps", () => {
  assert.equal(timestampUtc(new Date("2026-03-26T06:00:01.234Z")), "20260326T060001Z");
});

test("runRecoveryExport writes sorted recovery artifacts", async () => {
  const writes = new Map();
  const out = [];
  const calls = [];
  const exitCode = await runRecoveryExport({
    argv: ["tmp/test-recovery"],
    now: new Date("2026-03-26T06:00:01.234Z"),
    config: {
      apiBaseUrl: "http://127.0.0.1:5001",
      gatewayBaseUrl: "http://127.0.0.1:8080",
      cliPath: "/mock/ipfs",
      repoPath: "/mock/repo",
    },
    mkdirImpl: async () => {},
    writeFileImpl: async (filePath, contents) => {
      writes.set(filePath, contents);
    },
    runIpfsImpl: async (_cliPath, _repoPath, args) => {
      calls.push(args.join(" "));
      if (args[0] === "pin") {
        return "cid-b\ncid-a\n";
      }
      if (args[0] === "repo") {
        return '{"RepoSize": 10}\n';
      }
      return '{"ID": "node-123"}\n';
    },
    stdout: (line) => out.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    "pin ls --type=recursive --quiet",
    "repo stat --enc=json",
    "id",
  ]);
  const manifestPath = [...writes.keys()].find((key) => key.endsWith("pin-manifest.json"));
  assert.ok(manifestPath);
  const manifest = JSON.parse(writes.get(manifestPath));
  assert.deepEqual(manifest.recursivePins, ["cid-a", "cid-b"]);
  assert.equal(manifest.pinCount, 2);
  assert.equal(out.at(-1), "pin-count=2");
});
