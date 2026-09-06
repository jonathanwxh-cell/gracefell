import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const receipt = { version: 'v229-1', models: {}, arena: {} };
for (const name of ['kiteveil', 'malakar']) {
  const bytes = await readFile(new URL(`../../public/art/reliquary/${name}.glb`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
  const nodes = new Set(gltf.nodes.map(node => node.name));
  for (const node of ['Pelvis','Torso','Head','Cape','Arm_L','Arm_R','Forearm_L','Forearm_R','Leg_L','Leg_R','Knee_L','Knee_R','Foot_L','Foot_R','Sword_R']) {
    assert(nodes.has(node), `${name}: lost anatomical pivot ${node}`);
  }
  assert(nodes.has(name === 'malakar' ? 'Malakar_Root' : 'KiteVeil_Root'));
  if (name === 'malakar') assert(nodes.has('Sword_L'));
  let triangles = 0;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    assert.equal(primitive.mode ?? 4, 4, 'Only triangle geometry is admitted');
    triangles += gltf.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
  }
  for (const node of gltf.nodes) {
    for (const field of ['translation', 'rotation', 'scale', 'matrix']) {
      assert((node[field] ?? []).every(Number.isFinite), `${name}: non-finite ${field}`);
    }
  }
  assert(triangles >= 10000 && triangles <= 65000, `${name}: unexpected geometry budget ${triangles}`);
  assert(bytes.length < 550 * 1024, `${name}: exceeds 550 KiB budget`);
  assert(gltf.materials.length <= 8, `${name}: material budget`);
  assert(gltf.extensionsRequired.includes('EXT_meshopt_compression'), 'Meshopt packaging is required');
  assert(!gltf.animations?.length, 'Runtime snapshots own the pose; no independent animation clock');
  receipt.models[name] = { bytes: bytes.length, triangles, materials: gltf.materials.length, nodes: [...nodes], sha256: createHash('sha256').update(bytes).digest('hex') };
}
const arena = await readFile(new URL('../../public/art/reliquary/arena.webp', import.meta.url));
assert.equal(arena.toString('ascii', 0, 4), 'RIFF');
assert.equal(arena.toString('ascii', 8, 12), 'WEBP');
assert(arena.length < 1024 * 1024, 'Arena exceeds 1 MiB delivery budget');
receipt.arena = { bytes: arena.length, sha256: createHash('sha256').update(arena).digest('hex'), source: 'Original Blender geometry; Poly Haven Rock Boulder Dry CC0 surface', bake: 'Cycles 32 samples, denoised, 2048x2048' };
await writeFile(new URL('../../art/blender/reliquary/validation.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
