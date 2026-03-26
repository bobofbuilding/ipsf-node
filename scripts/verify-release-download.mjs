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
  "release-validation-report.json",
];

function parseArgs(argv) {
  const options = {
    releaseVersion: "latest",
    outputDir: path.join(rootDir, "dist", "release"),
    json: false,
    reportFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      options.json = true;
      continue;
    }
    if (token === "--report-file") {
      options.reportFile = path.resolve(argv[index + 1] || options.outputDir);
      index += 1;
      continue;
    }
    if (token.startsWith("--report-file=")) {
      options.reportFile = path.resolve(token.slice("--report-file=".length) || options.outputDir);
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

function summarizeValidationReport(payload) {
  return {
    ok: payload?.ok === true,
    installerFile: payload?.installer ? path.basename(payload.installer) : null,
    checksumFile: payload?.checksum ? path.basename(payload.checksum) : null,
    manifestFile: payload?.manifest ? path.basename(payload.manifest) : null,
    sha256: payload?.sha256 ?? null,
  };
}

function compareValidationReports(localPayload, publishedPayload) {
  const localSummary = summarizeValidationReport(localPayload);
  const publishedSummary = summarizeValidationReport(publishedPayload);
  const matches = (
    localSummary.ok === publishedSummary.ok &&
    localSummary.installerFile === publishedSummary.installerFile &&
    localSummary.checksumFile === publishedSummary.checksumFile &&
    localSummary.manifestFile === publishedSummary.manifestFile &&
    localSummary.sha256 === publishedSummary.sha256
  );
  return {
    matches,
    local: localSummary,
    published: publishedSummary,
  };
}

async function emitJsonResult(payload, { options, stdout, writeFileImpl }) {
  const jsonText = JSON.stringify(payload, null, 2);
  if (options.reportFile) {
    await writeFileImpl(options.reportFile, jsonText + "\n");
  }
  stdout(jsonText);
}

export async function runReleaseDownloadVerification({
  argv = process.argv.slice(2),
  fetchImpl = globalThis.fetch,
  mkdirImpl = fs.mkdir,
  readFileImpl = fs.readFile,
  writeFileImpl = fs.writeFile,
  validateReleaseImpl = runReleaseValidation,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const options = parseArgs(argv);

  if (typeof fetchImpl !== "function") {
    if (options.json) {
      await emitJsonResult({
        ok: false,
        releaseVersion: options.releaseVersion,
        outputDir: options.outputDir,
        reportFile: options.reportFile,
        error: "Fetch API is not available in this Node runtime",
      }, { options, stdout, writeFileImpl });
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
      validationReportPath: path.join(options.outputDir, "release-validation-report.json"),
      json: true,
      stdout: (line) => {
        validationOut.push(String(line));
      },
      stderr: (line) => {
        validationErr.push(String(line));
      },
    });

    const localValidationPayload = validationOut[0] ? JSON.parse(validationOut[0]) : null;
    if (exitCode !== 0 || !localValidationPayload?.ok) {
      if (options.json) {
        await emitJsonResult({
          ok: false,
          releaseVersion: options.releaseVersion,
          outputDir: options.outputDir,
          reportFile: options.reportFile,
          downloadedFiles,
          validation: localValidationPayload ?? {
            ok: false,
            stderr: validationErr,
          },
        }, { options, stdout, writeFileImpl });
      } else {
        stderr("release-download:invalid");
        if (localValidationPayload?.error) {
          stderr(localValidationPayload.error);
        } else {
          stderr(validationErr[0] || "Release validation failed");
        }
      }
      return exitCode || 1;
    }

    const publishedValidationPath = path.join(options.outputDir, "release-validation-report.json");
    const publishedValidationPayload = JSON.parse(await readFileImpl(publishedValidationPath, "utf8"));
    const publishedValidationReport = compareValidationReports(localValidationPayload, publishedValidationPayload);
    if (!publishedValidationReport.matches) {
      throw new Error("Published validation report does not match downloaded bundle");
    }

    if (options.json) {
      await emitJsonResult({
        ok: true,
        releaseVersion: options.releaseVersion,
        outputDir: options.outputDir,
        reportFile: options.reportFile,
        downloadedFiles,
        validation: localValidationPayload,
        publishedValidationReport,
      }, { options, stdout, writeFileImpl });
    } else {
      stdout("release-installer:validated");
      stdout("installer=" + localValidationPayload.installer);
      stdout("checksum=" + localValidationPayload.checksum);
      stdout("manifest=" + localValidationPayload.manifest);
      stdout("sha256=" + localValidationPayload.sha256);
      stdout("release-validation-report:matched");
      stdout("releaseVersion=" + options.releaseVersion);
      stdout("outputDir=" + options.outputDir);
    }
    return 0;
  } catch (error) {
    if (options.json) {
      await emitJsonResult({
        ok: false,
        releaseVersion: options.releaseVersion,
        outputDir: options.outputDir,
        reportFile: options.reportFile,
        downloadedFiles,
        error: error.message,
      }, { options, stdout, writeFileImpl });
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
