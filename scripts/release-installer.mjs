import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function resolveOutputPaths(outputDir) {
  const installerName = "install-ipfs-node.sh";
  return {
    installerName,
    installerSourcePath: path.join(rootDir, installerName),
    outputDir,
    installerOutputPath: path.join(outputDir, installerName),
    checksumOutputPath: path.join(outputDir, installerName + ".sha256"),
  };
}

export async function runReleasePackaging({
  outputDir = path.join(rootDir, "dist", "release"),
  readFileImpl = fs.readFile,
  writeFileImpl = fs.writeFile,
  mkdirImpl = fs.mkdir,
  stdout = console.log,
} = {}) {
  const paths = resolveOutputPaths(outputDir);
  await mkdirImpl(paths.outputDir, { recursive: true });

  const installerBuffer = await readFileImpl(paths.installerSourcePath);
  const checksum = createHash("sha256").update(installerBuffer).digest("hex");
  const checksumLine = checksum + "  " + paths.installerName + "\n";

  await writeFileImpl(paths.installerOutputPath, installerBuffer);
  await writeFileImpl(paths.checksumOutputPath, checksumLine);

  stdout("release-installer:prepared");
  stdout("outputDir=" + paths.outputDir);
  stdout("installer=" + paths.installerOutputPath);
  stdout("checksum=" + paths.checksumOutputPath);
  stdout("sha256=" + checksum);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runReleasePackaging();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
