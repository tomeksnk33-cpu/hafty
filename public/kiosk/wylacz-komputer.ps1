# GTM Bukowski - wylaczanie komputera przyciskiem w aplikacji (Windows).
#
# Nasluchuje tylko na 127.0.0.1:47800 (z sieci nikt sie nie polaczy).
# POST /wylacz od strony aplikacji (naglowek Origin z listy ponizej)
# wylacza komputer po 5 sekundach. GET /ping odpowiada "ok".
# Instaluje go zainstaluj-wylaczanie.cmd (uruchamianie przy logowaniu do Windows).

param(
  [int]$Port = 47800,
  [string[]]$Origins = @("https://gtm-bukowski.vercel.app")
)

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { exit 0 }  # juz dziala (port zajety)

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 3000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { continue }

    $headers = @{}
    while ($true) {
      $line = $reader.ReadLine()
      if ($null -eq $line -or $line -eq "") { break }
      $i = $line.IndexOf(":")
      if ($i -gt 0) { $headers[$line.Substring(0, $i).Trim().ToLower()] = $line.Substring($i + 1).Trim() }
    }

    $parts = $requestLine.Split(" ")
    $method = $parts[0]
    $path = if ($parts.Length -gt 1) { $parts[1] } else { "/" }
    $origin = $headers["origin"]
    $allowed = [bool]$origin -and (($Origins -contains $origin) -or ($origin -match '^http://localhost(:\d+)?$'))

    $extra = ""
    if ($allowed) {
      $extra = "Access-Control-Allow-Origin: $origin`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Private-Network: true`r`nVary: Origin`r`n"
    }

    $status = "404 Not Found"; $body = "nie ma"; $off = $false
    if ($method -eq "OPTIONS") { $status = "204 No Content"; $body = "" }
    elseif ($path -eq "/ping") { $status = "200 OK"; $body = "ok" }
    elseif ($path -eq "/wylacz" -and $method -eq "POST") {
      if ($allowed) { $status = "200 OK"; $body = "ok"; $off = $true }
      else { $status = "403 Forbidden"; $body = "brak dostepu" }
    }

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $head = "HTTP/1.1 $status`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n$extra`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()

    if ($off) { Start-Process -FilePath "shutdown.exe" -ArgumentList "/s", "/t", "5" -WindowStyle Hidden }
  } catch {
  } finally {
    $client.Close()
  }
}
