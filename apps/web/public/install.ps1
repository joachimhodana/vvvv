#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Repo = "joachimhodana/vvvv"
$Binary = "vvvv"

function Get-Arch {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    switch ($arch) {
        "X64"   { return "amd64" }
        "Arm64" { return "arm64" }
        default { throw "Unsupported architecture: $arch" }
    }
}

function Main {
    $os = "windows"
    $arch = Get-Arch

    Write-Host "-> Detected ${os}/${arch}"

    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/${Repo}/releases/latest"
    $tag = $release.tag_name

    if (-not $tag) {
        throw "Could not determine latest release"
    }

    Write-Host "-> Latest release: ${tag}"

    $url = "https://github.com/${Repo}/releases/download/${tag}/${Binary}_${os}_${arch}.exe"
    $installDir = "$env:LOCALAPPDATA\vvvv"
    $dest = Join-Path $installDir "${Binary}.exe"

    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    Write-Host "-> Downloading ${url}"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing

    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$installDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installDir", "User")
        Write-Host "-> Added ${installDir} to user PATH (restart your terminal)"
    }

    Write-Host "Done! Installed ${Binary} to ${dest}"
    Write-Host "  Run:  ${Binary}"
    Write-Host ""
    Write-Host "Notes:"
    Write-Host "  - Packet capture requires Administrator on most systems."
    Write-Host "  - Packet capture on Windows requires Npcap to be installed."
}

Main
