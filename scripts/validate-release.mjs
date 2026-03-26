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

export async function runReleaseValidation({
  installerPath = path.join(defaultReleaseDir, "install-ipfs-node.sh"),
  checksumPath = path.join(defaultReleaseDir, "install-ipfs-node.sh.sha256"),
  manifestPath = path.join(defaultReleaseDir, "release-manifest.json"),
  readFileImpl = fs.readFile,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const installerBuffer = await readFileImpl(installerPath);
    const checksumText = await readFileImpl(checksumPath, "utf8");
    const manifestText = await readFileImpl(manifestPath, "utf8");

    const calculatedSha = createHash("sha256").update(installerBuffer).digest("hex");
    const checksum = parseChecksumFile(checksumText);
    const manifest = JSON.parse(manifestText);
    const installerFileName = path.basename(installerPath);

    if (checksum.fileName !== installerFileName) {
      throw new Error("Checksum file does not reference the installer file");
    }
    if (checksum.sha256 !== calculatedSha) {
      throw new Error("Checksum file does not match installer contents");
    }
    if (manifest.installerFile !== installerFileName) {
      throw new Error("Manifest installerFile does not match installer file name");
    }
    if (manifest.checksumFile !== path.basename(checksumPath)) {
      throw new Error("Manifest checksumFile does not match checksum file name");
    }
    if (manifest.installerSha256 !== calculatedSha) {
      throw new Error("Manifest installerSha256 does not match installer contents");
    }

    stdout("release-installer:validated");
    stdout("installer=" + installerPath);
    stdout("checksum=" + checksumPath);
    stdout("manifest=" + manifestPath);
    stdout("sha256=" + calculatedSha);
    return 0;
  } catch (error) {
    stderr("release-installer:invalid");
    stderr(error.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runReleaseValidation();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
