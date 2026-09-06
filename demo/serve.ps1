param(
    [int]$Port = 8790,
    [string]$OpenPath = "/demo/index.html",
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$rootPrefix = $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$listener = $null
$boundPort = $null

foreach ($candidatePort in @($Port, 8795, 8798) | Select-Object -Unique) {
    try {
        $candidate = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidatePort)
        $candidate.Start()
        $listener = $candidate
        $boundPort = $candidatePort
        break
    }
    catch {
        if ($candidate) {
            $candidate.Stop()
        }
    }
}

if (-not $listener) {
    throw "8790, 8795 ve 8798 portlarindan hicbiri kullanilamiyor."
}

function Get-ContentType([string]$Path) {
    switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { "text/html; charset=utf-8" }
        ".htm"  { "text/html; charset=utf-8" }
        ".css"  { "text/css; charset=utf-8" }
        ".js"   { "text/javascript; charset=utf-8" }
        ".mjs"  { "text/javascript; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".svg"  { "image/svg+xml" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".webp" { "image/webp" }
        ".gif"  { "image/gif" }
        ".ico"  { "image/x-icon" }
        ".woff" { "font/woff" }
        ".woff2" { "font/woff2" }
        ".ttf"  { "font/ttf" }
        ".otf"  { "font/otf" }
        ".mp3"  { "audio/mpeg" }
        ".wav"  { "audio/wav" }
        ".mp4"  { "video/mp4" }
        ".webm" { "video/webm" }
        ".wasm" { "application/wasm" }
        default  { "application/octet-stream" }
    }
}

function Send-Response(
    [Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType,
    [bool]$SendBody
) {
    $headers = @(
        "HTTP/1.1 $StatusCode $StatusText"
        "Content-Type: $ContentType"
        "Content-Length: $($Body.Length)"
        "Cache-Control: no-store, must-revalidate"
        "Expires: 0"
        "X-Content-Type-Options: nosniff"
        "Connection: close"
        ""
        ""
    ) -join "`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($SendBody -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

$openUrl = "http://127.0.0.1:$boundPort$OpenPath"
Write-Host "Sunucu hazir (onbelleksiz): $openUrl"
Write-Host "Kapatmak icin bu pencerede Ctrl+C."

if (-not $NoBrowser) {
    Start-Process -FilePath $openUrl
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $null
        $reader = $null
        try {
            $client.ReceiveTimeout = 10000
            $client.SendTimeout = 30000
            $stream = $client.GetStream()
            $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            while (($headerLine = $reader.ReadLine()) -ne $null -and $headerLine.Length -gt 0) { }

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            $parts = $requestLine.Split(" ")
            $method = $parts[0].ToUpperInvariant()
            if ($parts.Length -lt 2 -or ($method -ne "GET" -and $method -ne "HEAD")) {
                $body = [Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
                Send-Response $stream 405 "Method Not Allowed" $body "text/plain; charset=utf-8" ($method -ne "HEAD")
                continue
            }

            $rawPath = $parts[1].Split("?")[0]
            $decodedPath = [Uri]::UnescapeDataString($rawPath).Replace("/", [IO.Path]::DirectorySeparatorChar)
            $relativePath = $decodedPath.TrimStart([IO.Path]::DirectorySeparatorChar)
            $filePath = [IO.Path]::GetFullPath((Join-Path $repoRoot $relativePath))

            if (-not $filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                $body = [Text.Encoding]::UTF8.GetBytes("Forbidden")
                Send-Response $stream 403 "Forbidden" $body "text/plain; charset=utf-8" ($method -ne "HEAD")
                continue
            }

            if (Test-Path -LiteralPath $filePath -PathType Container) {
                $filePath = Join-Path $filePath "index.html"
            }

            if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $body = [Text.Encoding]::UTF8.GetBytes("Not Found: $rawPath")
                Send-Response $stream 404 "Not Found" $body "text/plain; charset=utf-8" ($method -ne "HEAD")
                continue
            }

            $body = [IO.File]::ReadAllBytes($filePath)
            Send-Response $stream 200 "OK" $body (Get-ContentType $filePath) ($method -ne "HEAD")
        }
        catch {
            Write-Warning $_.Exception.Message
        }
        finally {
            if ($reader) { $reader.Dispose() }
            if ($stream) { $stream.Dispose() }
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
