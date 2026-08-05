$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serviceRoot = Join-Path $projectRoot "local-pronunciation"
$environmentRoot = Join-Path $serviceRoot ".venv"
$pythonExecutable = Join-Path $environmentRoot "Scripts\python.exe"
$bundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$bootstrapPython = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } elseif (Test-Path -LiteralPath $bundledPython) { $bundledPython } else { $null }

if (-not (Test-Path -LiteralPath $pythonExecutable)) {
  if (-not $bootstrapPython) { throw "Python 3.10+ is required to start the local pronunciation service." }
  & $bootstrapPython -m venv $environmentRoot
  & $pythonExecutable -m pip install --upgrade pip
  & $pythonExecutable -m pip install -r (Join-Path $serviceRoot "requirements.txt")
  try {
    & $pythonExecutable -m pip install -r (Join-Path $serviceRoot "requirements-phonemes.txt")
  } catch {
    Write-Warning "Optional phoneme packages did not install. Whisper intelligibility and fluency scoring will still work."
  }
}

$env:WORLDLING_WHISPER_MODEL = if ($env:WORLDLING_WHISPER_MODEL) { $env:WORLDLING_WHISPER_MODEL } else { "small" }
$env:PYTHONUTF8 = "1"
Set-Location $serviceRoot
& $pythonExecutable -m uvicorn server:app --host 127.0.0.1 --port 8787
