$p = 'C:\Users\hasna\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin'
$cur = [Environment]::GetEnvironmentVariable('Path','Process')
[Environment]::SetEnvironmentVariable('Path', $cur + ';' + $p, 'Process')
Write-Host "Added to PATH: $p"
& "$p\ffmpeg.exe" -version
