param([int]$Port = 4173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Neihu Site Radar: http://127.0.0.1:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $relative) { $relative = 'index.html' }
    $target = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $target.StartsWith([IO.Path]::GetFullPath($root)) -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
    } else {
      $context.Response.StatusCode = 200
      $ext = [IO.Path]::GetExtension($target).ToLowerInvariant()
      $context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $context.Response.Headers.Add('Cache-Control', 'no-cache')
      $bytes = [IO.File]::ReadAllBytes($target)
    }
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
