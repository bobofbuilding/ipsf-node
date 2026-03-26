import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function resolveOutputPaths(outputDir) {
  const installerName = "install-ipfs-node.sh";
  const checksumName = installerName + ".sha256";
  const manifestName = "release-manifest.json";
  return {
    installerName,
    checksumName,
    manifestName,
    installerSourcePath: path.join(rootDir, installerName),
    packageJsonPath: path.join(rootDir, "package.json"),
    outputDir,
    installerOutputPath: path.join(outputDir, installerName),
    checksumOutputPath: path.join(outputDir, checksumName),
    manifestOutputPath: path.join(outputDir, manifestName),
  };
}

function extractKuboVersion(installerText) {
  const match = installerText.match(/KUBO_VERSION="\$\{KUBO_VERSION:-([^}]+)\}"/);
  return match ? match[1] : null;
}

export async function runReleasePackaging({
  outputDir = path.join(rootDir, "dist", "release"),
  releaseVersion = process.env.GITHUB_REF_NAME || null,
  commitSha = process.env.GITHUB_SHA || null,
  readFileImpl = fs.readFile,
  writeFileImpl = fs.writeFile,
  mkdirImpl = fs.mkdir,
  stdout = console.log,
} = {}) {
  const paths = resolveOutputPaths(outputDir);
  await mkdirImpl(paths.outputDir, { recursive: true });

  const installerBuffer = await readFileImpl(paths.installerSourcePath);
  const installerText = installerBuffer.toString("utf8");
  const checksum = createHash("sha256").update(installerBuffer).digest("hex");
  const checksumLine = checksum + "  " + paths.installerName + "\n";
  const packageJson = JSON.parse(await readFileImpl(paths.packageJsonPath, "utf8"));
  const manifest = {
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    releaseVersion,
    commitSha,
    installerFile: paths.installerName,
    checksumFile: paths.checksumName,
    installerSha256: checksum,
    kuboVersion: extractKuboVersion(installerText),
    generatedAt: new Date().toISOString(),
  };

  await writeFileImpl(paths.installerOutputPath, installerBuffer);
  await writeFileImpl(paths.checksumOutputPath, checksumLine);
  await writeFileImpl(paths.manifestOutputPath, JSON.stringify(manifest, null, 2) + "\n");

  stdout("release-installer:prepared");
  stdout("outputDir=" + paths.outputDir);
  stdout("installer=" + paths.installerOutputPath);
  stdout("checksum=" + paths.checksumOutputPath);
  stdout("manifest=" + paths.manifestOutputPath);
  stdout("sha256=" + checksum);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runReleasePackaging();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
