import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const defaultReleaseDir = path.join(rootDir, "dist", "release");

function parseChecksumFile(contents) {
  const line = String(contents).trim();
  const match = line.match(/^([a-f0-9]{64})\s\s(.+)$/i);
  if (!match) {
    throw new Error("Invalid checksum file format");
  }
  return {
    sha256: match[1].toLowerCase(),
    fileName: match[2],
  };
}

function parseArgs(argv) {
  const options = {
    installerPath: path.join(defaultReleaseDir, "install-ipfs-node.sh"),
    checksumPath: path.join(defaultReleaseDir, "install-ipfs-node.sh.sha256"),
    manifestPath: path.join(defaultReleaseDir, "release-manifest.json"),
    validationReportPath: path.join(defaultReleaseDir, "release-validation-report.json"),
    validationReportExplicit: false,
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
      options.reportFile = path.resolve(argv[index + 1] || options.reportFile || options.manifestPath + ".validation.json");
      index += 1;
      continue;
    }
    if (token.startsWith("--report-file=")) {
      options.reportFile = path.resolve(token.slice("--report-file=".length) || options.reportFile || options.manifestPath + ".validation.json");
      continue;
    }
    if (token === "--installer") {
      options.installerPath = path.resolve(argv[index + 1] || options.installerPath);
      index += 1;
      continue;
    }
    if (token.startsWith("--installer=")) {
      options.installerPath = path.resolve(token.slice("--installer=".length) || options.installerPath);
      continue;
    }
    if (token === "--checksum") {
      options.checksumPath = path.resolve(argv[index + 1] || options.checksumPath);
      index += 1;
      continue;
    }
    if (token.startsWith("--checksum=")) {
      options.checksumPath = path.resolve(token.slice("--checksum=".length) || options.checksumPath);
      continue;
    }
    if (token === "--manifest") {
      options.manifestPath = path.resolve(argv[index + 1] || options.manifestPath);
      index += 1;
      continue;
    }
    if (token.startsWith("--manifest=")) {
      options.manifestPath = path.resolve(token.slice("--manifest=".length) || options.manifestPath);
      continue;
    }
    if (token === "--validation-report") {
      options.validationReportPath = path.resolve(argv[index + 1] || options.validationReportPath);
      options.validationReportExplicit = true;
      index += 1;
      continue;
    }
    if (token.startsWith("--validation-report=")) {
      options.validationReportPath = path.resolve(token.slice("--validation-report=".length) || options.validationReportPath);
      options.validationReportExplicit = true;
    }
  }

  return options;
}

async function emitJsonResult(payload, { reportFile, stdout, writeFileImpl }) {
  const jsonText = JSON.stringify(payload, null, 2);
  if (reportFile) {
    await writeFileImpl(reportFile, jsonText + "\n");
  }
  stdout(jsonText);
}

export async function runReleaseValidation({
  argv = process.argv.slice(2),
  installerPath,
  checksumPath,
  manifestPath,
  validationReportPath,
  json: jsonMode,
  reportFile,
  readFileImpl = fs.readFile,
  writeFileImpl = fs.writeFile,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const parsed = parseArgs(argv);
  const options = {
    installerPath: installerPath ?? parsed.installerPath,
    checksumPath: checksumPath ?? parsed.checksumPath,
    manifestPath: manifestPath ?? parsed.manifestPath,
    validationReportPath: validationReportPath ?? parsed.validationReportPath,
    validationReportExplicit: validationReportPath !== undefined ? true : parsed.validationReportExplicit,
    json: jsonMode ?? parsed.json,
    reportFile: reportFile ?? parsed.reportFile,
  };

  try {
    const installerBuffer = await readFileImpl(options.installerPath);
    const checksumText = await readFileImpl(options.checksumPath, "utf8");
    const manifestText = await readFileImpl(options.manifestPath, "utf8");

    const calculatedSha = createHash("sha256").update(installerBuffer).digest("hex");
    const checksum = parseChecksumFile(checksumText);
    const manifest = JSON.parse(manifestText);
    const installerFileName = path.basename(options.installerPath);
    let validationReport = null;

    if (checksum.fileName !== installerFileName) {
      throw new Error("Checksum file does not reference the installer file");
    }
    if (checksum.sha256 !== calculatedSha) {
      throw new Error("Checksum file does not match installer contents");
    }
    if (manifest.installerFile !== installerFileName) {
      throw new Error("Manifest installerFile does not match installer file name");
    }
    if (manifest.checksumFile !== path.basename(options.checksumPath)) {
      throw new Error("Manifest checksumFile does not match checksum file name");
    }
    if (manifest.installerSha256 !== calculatedSha) {
      throw new Error("Manifest installerSha256 does not match installer contents");
    }

    if (options.validationReportPath) {
      try {
        const validationReportText = await readFileImpl(options.validationReportPath, "utf8");
        const parsedValidationReport = JSON.parse(validationReportText);

        if (parsedValidationReport.ok !== true) {
          throw new Error("Validation report marks the release bundle as invalid");
        }
        if (path.basename(parsedValidationReport.installer || "") !== installerFileName) {
          throw new Error("Validation report installer does not match installer file name");
        }
        if (path.basename(parsedValidationReport.checksum || "") !== path.basename(options.checksumPath)) {
          throw new Error("Validation report checksum does not match checksum file name");
        }
        if (path.basename(parsedValidationReport.manifest || "") !== path.basename(options.manifestPath)) {
          throw new Error("Validation report manifest does not match manifest file name");
        }
        if (parsedValidationReport.sha256 !== calculatedSha) {
          throw new Error("Validation report sha256 does not match installer contents");
        }

        validationReport = {
          path: options.validationReportPath,
          present: true,
          matches: true,
        };
      } catch (error) {
        if (error && error.code === "ENOENT" && !options.validationReportExplicit) {
          validationReport = {
            path: options.validationReportPath,
            present: false,
            matches: null,
          };
        } else {
          throw error;
        }
      }
    }

    if (options.json) {
      await emitJsonResult({
        ok: true,
        installer: options.installerPath,
        checksum: options.checksumPath,
        manifest: options.manifestPath,
        validationReport,
        reportFile: options.reportFile,
        sha256: calculatedSha,
      }, {
        reportFile: options.reportFile,
        stdout,
        writeFileImpl,
      });
    } else {
      stdout("release-installer:validated");
      stdout("installer=" + options.installerPath);
      stdout("checksum=" + options.checksumPath);
      stdout("manifest=" + options.manifestPath);
      if (validationReport?.present) {
        stdout("release-validation-report:matched");
        stdout("validationReport=" + options.validationReportPath);
      }
      stdout("sha256=" + calculatedSha);
    }
    return 0;
  } catch (error) {
    if (options.json) {
      await emitJsonResult({
        ok: false,
        installer: options.installerPath,
        checksum: options.checksumPath,
        manifest: options.manifestPath,
        validationReport: options.validationReportPath ? {
          path: options.validationReportPath,
          present: null,
          matches: false,
        } : null,
        reportFile: options.reportFile,
        error: error.message,
      }, {
        reportFile: options.reportFile,
        stdout,
        writeFileImpl,
      });
    } else {
      stderr("release-installer:invalid");
      stderr(error.message);
    }
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runReleaseValidation();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
