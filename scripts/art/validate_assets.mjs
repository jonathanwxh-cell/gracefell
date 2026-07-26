import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const arenaDir = path.join(repoRoot, "public", "art", "arena");
const modelPath = path.join(repoRoot, "public", "art", "models", "malakar.glb");
const receiptDir = path.join(repoRoot, "art", "blender", "receipts");

const limits = {
  baseBytes: 700 * 1024,
  overlayBytes: 400 * 1024,
  glbBytes: 500 * 1024,
  materials: 2,
  proofTriangles: 5000,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer) {
  assert(buffer.toString("ascii", 0, 4) === "RIFF", "WebP is missing RIFF header");
  assert(buffer.toString("ascii", 8, 12) === "WEBP", "WebP is missing WEBP signature");
  const type = buffer.toString("ascii", 12, 16);
  if (type === "VP8X") {
    return {
      width: readUint24LE(buffer, 24) + 1,
      height: readUint24LE(buffer, 27) + 1,
      alpha: Boolean(buffer[20] & 0x10),
      encoding: type,
    };
  }
  if (type === "VP8 ") {
    const payload = 20;
    assert(
      buffer[payload + 3] === 0x9d && buffer[payload + 4] === 0x01 && buffer[payload + 5] === 0x2a,
      "VP8 frame header is invalid",
    );
    return {
      width: buffer.readUInt16LE(payload + 6) & 0x3fff,
      height: buffer.readUInt16LE(payload + 8) & 0x3fff,
      alpha: false,
      encoding: type,
    };
  }
  if (type === "VP8L") {
    const payload = 20;
    assert(buffer[payload] === 0x2f, "VP8L signature is invalid");
    const b1 = buffer[payload + 1];
    const b2 = buffer[payload + 2];
    const b3 = buffer[payload + 3];
    const b4 = buffer[payload + 4];
    return {
      width: 1 + (b1 | ((b2 & 0x3f) << 8)),
      height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)),
      alpha: true,
      encoding: type,
    };
  }
  throw new Error(`Unsupported WebP chunk ${JSON.stringify(type)}`);
}

function parseGlb(buffer) {
  assert(buffer.readUInt32LE(0) === 0x46546c67, "GLB magic is invalid");
  assert(buffer.readUInt32LE(4) === 2, "GLB version must be 2");
  assert(buffer.readUInt32LE(8) === buffer.byteLength, "GLB declared length does not match file size");
  const jsonLength = buffer.readUInt32LE(12);
  assert(buffer.readUInt32LE(16) === 0x4e4f534a, "GLB first chunk is not JSON");
  const jsonText = buffer.toString("utf8", 20, 20 + jsonLength).replace(/[\u0000 ]+$/u, "");
  return JSON.parse(jsonText);
}

function glbTriangleCount(gltf) {
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4;
      if (mode !== 4) continue;
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      if (accessorIndex === undefined) continue;
      triangles += Math.floor((gltf.accessors?.[accessorIndex]?.count ?? 0) / 3);
    }
  }
  return triangles;
}

async function inspectWebp(filename, expectedWidth, expectedHeight) {
  const fullPath = path.join(arenaDir, filename);
  const buffer = await readFile(fullPath);
  const dimensions = webpDimensions(buffer);
  assert(
    dimensions.width === expectedWidth && dimensions.height === expectedHeight,
    `${filename} must be ${expectedWidth}x${expectedHeight}, got ${dimensions.width}x${dimensions.height}`,
  );
  return {
    file: path.relative(repoRoot, fullPath).replaceAll("\\", "/"),
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
    ...dimensions,
  };
}

async function main() {
  const base = await inspectWebp("arena-base.webp", 2048, 2048);
  const phase2 = await inspectWebp("phase-2-mask.webp", 1024, 1024);
  const phase3 = await inspectWebp("phase-3-mask.webp", 1024, 1024);
  assert(base.bytes <= limits.baseBytes, `arena-base.webp exceeds ${limits.baseBytes} bytes`);
  assert(
    phase2.bytes + phase3.bytes <= limits.overlayBytes,
    `phase overlays exceed ${limits.overlayBytes} bytes combined`,
  );
  assert(phase2.alpha && phase3.alpha, "phase masks must retain alpha");

  const glb = await readFile(modelPath);
  const gltf = parseGlb(glb);
  const nodeNames = (gltf.nodes ?? []).map((node) => node.name).filter(Boolean);
  for (const node of gltf.nodes ?? []) {
    for (const [field, values] of Object.entries({
      translation: node.translation,
      rotation: node.rotation,
      scale: node.scale,
      matrix: node.matrix,
    })) {
      if (!values) continue;
      assert(
        values.every(Number.isFinite),
        `GLB node ${node.name ?? "(unnamed)"} has non-finite ${field}`,
      );
    }
  }
  for (const required of ["Malakar_Root", "Malakar_Body", "Malakar_Core", "Halo_Fragment_Prototype"]) {
    assert(nodeNames.includes(required), `GLB is missing stable node ${required}`);
  }
  assert((gltf.materials?.length ?? 0) <= limits.materials, "Malakar proof exceeds two materials");
  const root = (gltf.nodes ?? []).find((node) => node.name === "Malakar_Root");
  assert(root, "Malakar_Root node is missing");
  assert(!root.translation || root.translation.every((value) => Math.abs(value) < 1e-7), "Malakar root pivot is not at origin");
  assert(root.extras?.pivot_role === "ground_contact", "Malakar root pivot-role metadata is missing");
  assert(!Object.hasOwn(root.extras ?? {}, "pivot"), "Malakar root uses Three.js-reserved extras.pivot");
  const triangles = glbTriangleCount(gltf);
  assert(triangles <= limits.proofTriangles, `Malakar proof exceeds ${limits.proofTriangles} triangles`);
  assert(glb.byteLength <= limits.glbBytes, `Malakar GLB exceeds ${limits.glbBytes} bytes`);
  assert(
    (gltf.extensionsUsed ?? []).includes("EXT_meshopt_compression"),
    "Optimized Malakar GLB must use EXT_meshopt_compression",
  );

  const generationPath = path.join(receiptDir, "generation.json");
  const generation = JSON.parse(await readFile(generationPath, "utf8"));
  assert(generation.arena.quietCentralPercent >= 65, "Arena quiet centre is below 65%");
  assert(
    generation.arena.decorativeGeometryMinRadiusMeters >= generation.arena.quietCentralRadiusMeters,
    "Outer ornament entered protected centre",
  );
  assert(generation.arena.dangerRedUsed === false, "Arena generation receipt reports danger red");
  assert(
    !Object.values(generation.arena.palette).some((value) => value.toLowerCase() === "#ff2d17"),
    "Arena palette contains reserved danger red",
  );

  const receipt = {
    generatedAt: new Date().toISOString(),
    validator: "scripts/art/validate_assets.mjs",
    limits,
    assets: {
      base,
      phase2,
      phase3,
      overlaysCombinedBytes: phase2.bytes + phase3.bytes,
      malakar: {
        file: path.relative(repoRoot, modelPath).replaceAll("\\", "/"),
        bytes: glb.byteLength,
        sha256: sha256(glb),
        materials: gltf.materials?.length ?? 0,
        meshes: gltf.meshes?.length ?? 0,
        nodes: nodeNames,
        triangles,
        extensionsUsed: gltf.extensionsUsed ?? [],
      },
    },
    constraints: {
      quietCentralPercent: generation.arena.quietCentralPercent,
      decorativeGeometryMinRadiusMeters: generation.arena.decorativeGeometryMinRadiusMeters,
      dangerRedUsed: generation.arena.dangerRedUsed,
      runtimeIntegration: {
        arena: "v2.25 default cached-floor replacement",
        canvasBoss: "v2.25 default presentation treatment",
        threeBoss: "query-gated experimental comparison",
      },
    },
  };
  await mkdir(receiptDir, { recursive: true });
  await writeFile(path.join(receiptDir, "validation.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
