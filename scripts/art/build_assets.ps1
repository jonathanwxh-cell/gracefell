param(
  [string]$BlenderExe = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..\..')
$generator = Join-Path $scriptDir 'generate_assets.py'
$rawGlb = Join-Path $repoRoot 'art\blender\exports\malakar-raw.glb'
$modelDir = Join-Path $repoRoot 'public\art\models'
$finalGlb = Join-Path $modelDir 'malakar.glb'

if (-not (Test-Path -LiteralPath $BlenderExe -PathType Leaf)) {
  throw "Blender executable not found: $BlenderExe"
}

New-Item -ItemType Directory -Force -Path $modelDir | Out-Null

& $BlenderExe --background --factory-startup --python-exit-code 1 --python $generator
if ($LASTEXITCODE -ne 0) {
  throw "Blender asset generation failed with exit code $LASTEXITCODE"
}

& npx --yes '@gltf-transform/cli@4.4.1' optimize $rawGlb $finalGlb `
  --compress meshopt `
  --meshopt-level high `
  --flatten false `
  --join false `
  --instance false `
  --palette false `
  --simplify false `
  --texture-compress false
if ($LASTEXITCODE -ne 0) {
  throw "glTF Transform optimization failed with exit code $LASTEXITCODE"
}

& node (Join-Path $scriptDir 'validate_assets.mjs')
if ($LASTEXITCODE -ne 0) {
  throw "Asset validation failed with exit code $LASTEXITCODE"
}
