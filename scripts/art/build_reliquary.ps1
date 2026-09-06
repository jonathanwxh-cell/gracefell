param(
  [string]$BlenderExe = '',
  [switch]$SkipBlender
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $repoRoot
try {
  if (-not $SkipBlender) {
    if (-not $BlenderExe) {
      $portable = Join-Path $repoRoot '.artifacts\tools\blender-4.5.9-windows-x64\blender.exe'
      if (Test-Path -LiteralPath $portable) { $BlenderExe = $portable }
      else { $BlenderExe = (Get-Command blender -ErrorAction Stop).Source }
    }
    $textureDir = Join-Path $repoRoot '.artifacts\reliquary\textures'
    New-Item -ItemType Directory -Force -Path $textureDir | Out-Null
    $maps = @(
      @{name='Diffuse'; suffix='diff'; md5='fbc9cf377db427f54381f463c0639e1f'},
      @{name='Displacement'; suffix='disp'; md5='bea116eb30df0faed0748c69d57b460d'},
      @{name='Rough'; suffix='rough'; md5='f69a2caafb58d427cb17cab31c202e0e'}
    )
    foreach ($map in $maps) {
      $target = Join-Path $textureDir ($map.name + '.jpg')
      if (-not (Test-Path -LiteralPath $target)) {
        $url = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rock_boulder_dry/rock_boulder_dry_' + $map.suffix + '_2k.jpg'
        Invoke-WebRequest $url -OutFile $target
      }
      if ((Get-FileHash -LiteralPath $target -Algorithm MD5).Hash.ToLower() -ne $map.md5) {
        throw "CC0 source checksum mismatch: $target"
      }
    }
    & $BlenderExe --background --factory-startup --python-exit-code 1 --python scripts/art/build_reliquary.py
    if ($LASTEXITCODE -ne 0) { throw 'Blender generation failed' }
  }
  foreach ($actor in @('kiteveil','malakar')) {
    & npx --yes '@gltf-transform/cli@4.4.1' optimize "art/blender/reliquary/$actor-raw.glb" "public/art/reliquary/$actor.glb" `
      --compress meshopt --meshopt-level high --flatten false --join false `
      --instance false --palette false --simplify false --texture-compress false
    if ($LASTEXITCODE -ne 0) { throw "GLB optimization failed: $actor" }
  }
  & node scripts/art/validate_reliquary.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Asset validation failed' }
} finally { Pop-Location }
