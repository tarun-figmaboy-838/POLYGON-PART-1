# Tiny static file server for the whole adventure: the home page and both parts.
# No Node or Python needed — START GAME.bat runs this for you.
#
#   Right-click this file -> "Run with PowerShell"
#   ...or from a terminal in this folder:
#
#       powershell -ExecutionPolicy Bypass -File serve.ps1
#
# Then open  http://127.0.0.1:8080
# Press Ctrl+C in the window to stop it.

param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.json' = 'application/json'
  '.mp3'  = 'audio/mpeg'
  '.ogg'  = 'audio/ogg'
  '.wav'  = 'audio/wav'
  '.woff2'= 'font/woff2'
}

$rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host "Could not listen on port $Port. Something else may be using it." -ForegroundColor Red
  Write-Host "Try a different one:  powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8090" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "  Polygon Adventure" -ForegroundColor Cyan
Write-Host "  serving $rootFull"
Write-Host ""
Write-Host "  ->  http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host ""
Write-Host "  Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
      $relPath = $rel.TrimStart('/') -replace '/', '\'
      if ($relPath) { $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relPath)) }
      else { $full = $rootFull }

      # keep requests inside the folder, and out of the repository's history
      $inside = $full.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase) -or
                $full.StartsWith($rootFull + '\', [StringComparison]::OrdinalIgnoreCase)
      if (-not $inside -or $rel -match '(^|/)(\.git|node_modules)(/|$)') {
        $res.StatusCode = 403
      }
      elseif (Test-Path -LiteralPath $full -PathType Container) {
        if (-not $rel.EndsWith('/')) {
          # a folder without its slash would resolve its page's relative URLs one level too high
          $res.StatusCode = 301
          $res.RedirectLocation = $rel + '/'
        } else {
          $full = Join-Path $full 'index.html'
        }
      }

      if ($res.StatusCode -eq 200) {
        if (Test-Path -LiteralPath $full -PathType Leaf) {
          $bytes = [System.IO.File]::ReadAllBytes($full)
          $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
          $ct = $mime[$ext]
          if (-not $ct) { $ct = 'application/octet-stream' }
          $res.ContentType = $ct
          $res.Headers.Add('Cache-Control', 'no-store')
          $res.ContentLength64 = $bytes.Length
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
          Write-Host ("  200  " + $rel) -ForegroundColor DarkGray
        }
        else {
          $res.StatusCode = 404
          Write-Host ("  404  " + $rel) -ForegroundColor DarkYellow
        }
      }
    } catch {
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
