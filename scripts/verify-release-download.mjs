import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runReleaseValidation } from "./validate-release.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const releaseFiles = [
  "install-ipfs-node.sh",
  "install-ipfs-node.sh.sha256",
  "release-manifest.json",
];

function parseArgs(argv) {
  const options = {
    releaseVersion: "latest",
    outputDir: path.join(rootDir, "dist", "release"),
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      options.json = true;
      continue;
    }
    if (token === "--tag") {
      options.releaseVersion = argv[index + 1] || options.releaseVersion;
      index += 1;
      continue;
    }
    if (token.startsWith("--tag=")) {
      options.releaseVersion = token.slice("--tag=".length) || options.releaseVersion;
      continue;
    }
    if (token === "--output-dir") {
      options.outputDir = path.resolve(argv[index + 1] || options.outputDir);
      index += 1;
      continue;
    }
    if (token.startsWith("--output-dir=")) {
      options.outputDir = path.resolve(token.slice("--output-dir=".length) || options.outputDir);
    }
  }

  return options;
}

function buildDownloadBaseUrl(releaseVersion) {
  if (!releaseVersion || releaseVersion === "latest") {
    return "https://github.com/bobofbuilding/ipsf-node/releases/latest/download";
  }
  return "https://github.com/bobofbuilding/ipsf-node/releases/download/" + encodeURIComponent(releaseVersion);
}

function parseKeyValueLine(line) {
  const text = String(line);
  const separatorIndex = text.indexOf("=");
  if (separatorIndex < 0) {
    return null;
  }
  return {
    key: text.slice(0, separatorIndex),
    value: text.slice(separatorIndex + 1),
  };
}

export async function runReleaseDownloadVerification({
  argv = process.argv.slice(2),
  fetchImpl = globalThis.fetch,
  mkdirImpl = fs.mkdir,
  writeFileImpl = fs.writeFile,
  validateReleaseImpl = runReleaseValidation,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const options = parseArgs(argv);

  if (typeof fetchImpl !== "function") {
    if (options.json) {
      stdout(JSON.stringify({
        ok: false,
        releaseVersion: options.releaseVersion,
        outputDir: options.outputDir,
        error: "Fetch API is not available in this Node runtime",
      }, null, 2));
    } else {
      stderr("release-download:invalid");
      stderr("Fetch API is not available in this Node runtime");
    }
    return 1;
  }

  const baseUrl = buildDownloadBaseUrl(options.releaseVersion);
  const downloadedFiles = [];
  const validationOut = [];
  const validationErr = [];

  try {
    await mkdirImpl(options.outputDir, { recursive: true });

    for (const fileName of releaseFiles) {
      const response = await fetchImpl(baseUrl + "/" + fileName);
      if (!response || !response.ok) {
        throw new Error("Failed to download " + fileName);
      }
      const arrayBuffer = await response.arrayBuffer();
      await writeFileImpl(path.join(options.outputDir, fileName), Buffer.from(arrayBuffer));
      downloadedFiles.push(fileName);
      if (!options.json) {
        stdout("downloaded=" + fileName);
      }
    }

    const exitCode = await validateReleaseImpl({
      installerPath: path.join(options.outputDir, "install-ipfs-node.sh"),
      checksumPath: path.join(options.outputDir, "install-ipfs-node.sh.sha256"),
      manifestPath: path.join(options.outputDir, "release-manifest.json"),
      stdout: (line) => {
        validationOut.push(String(line));
        if (!options.json) {
          stdout(line);
        }
      },
      stderr: (line) => {
        validationErr.push(String(line));
        if (!options.json) {
          stderr(line);
        }
      },
    });

    if (exitCode !== 0) {
      if (options.json) {
        stdout(JSON.stringify({
          ok: false,
          releaseVersion: options.releaseVersion,
          outputDir: options.outputDir,
          downloadedFiles,
          validation: {
            ok: false,
            stdout: validationOut,
            stderr: validationErr,
          },
        }, null, 2));
      }
      return exitCode;
    }

    if (options.json) {
      const validationFields = Object.fromEntries(
        validationOut
          .map(parseKeyValueLine)
          .filter(Boolean)
          .map((entry) => [entry.key, entry.value]),
      );
      stdout(JSON.stringify({
        ok: true,
        releaseVersion: options.releaseVersion,
        outputDir: options.outputDir,
        downloadedFiles,
        validation: {
          ok: true,
          stdout: validationOut,
          installer: validationFields.installer ?? null,
          checksum: validationFields.checksum ?? null,
          manifest: validationFields.manifest ?? null,
          sha256: validationFields.sha256 ?? null,
        },
      }, null, 2));
    } else {
      stdout("release-download:verified");
      stdout("releaseVersion=" + options.releaseVersion);
      stdout("outputDir=" + options.outputDir);
    }
    return 0;
  } catch (error) {
    if (options.json) {
      stdout(JSON.stringify({
        ok: false,
        releaseVersion: options.releaseVersion,
        outputDir: options.outputDir,
        downloadedFiles,
        error: error.message,
      }, null, 2));
    } else {
      stderr("release-download:invalid");
      stderr(error.message);
    }
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runReleaseDownloadVerification();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
