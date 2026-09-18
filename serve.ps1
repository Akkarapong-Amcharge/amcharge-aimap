# serve.ps1 - tiny static web server for the Amcharge AI Roof Planner demo
# Usage: right-click > Run with PowerShell, or:
#   powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open a browser at http://localhost:8765/
# (ASCII-only on purpose so Windows PowerShell 5.1 parses it on any codepage.)

param([int]$Port = 8765)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.md'   = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host ("Cannot open port {0}: {1}" -f $Port, $_.Exception.Message) -ForegroundColor Red
  Write-Host "Try another port:  powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 9000"
  exit 1
}
Write-Host ("Amcharge AI Roof Planner - serving at {0}" -f $prefix) -ForegroundColor Green
Write-Host "Open your browser there. Press Ctrl+C to stop."

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }
  $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
  $path = Join-Path $root $rel
  if ((Test-Path $path) -and -not (Get-Item $path).PSIsContainer) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    $ct = $mime[$ext]
    if (-not $ct) { $ct = 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $ctx.Response.ContentType = $ct
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes(("404 Not Found: {0}" -f $rel))
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  }
  $ctx.Response.OutputStream.Close()
}
