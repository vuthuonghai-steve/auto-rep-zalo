# .agents/scripts/guards/dispatcher.ps1
# Wrapper mỏng tự động phát hiện runtime Python trên Windows

$pyCmd = if (Get-Command python -ErrorAction SilentlyContinue) { "python" }
         elseif (Get-Command py -ErrorAction SilentlyContinue) { "py" }
         else { $null }

$dispatcherPy = Join-Path $PSScriptRoot "dispatcher.py"

if ($pyCmd -and (Test-Path $dispatcherPy)) {
    if ($input) {
        $input | & $pyCmd $dispatcherPy @args
    } else {
        & $pyCmd $dispatcherPy @args
    }
} else {
    Write-Output '{"decision": "allow"}'
    exit 0
}
