<#
.SYNOPSIS
  Builds the signed Android App Bundle (.aab) for Google Play, entirely inside Docker.

.EXAMPLE
  .\android\build-aab.ps1 -Url https://poulies-courroies.onrender.com/

.NOTES
  The first run downloads about 1 GB (JDK, Android SDK, Gradle) into a Docker image.
  It also creates your upload key in android\keystore\ and android\keystore.properties.
  BACK THOSE TWO UP somewhere safe. They are needed for every future update and are never committed.
  Raise -VersionCode by 1 for each new upload to Google Play.
#>
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$VersionCode = 1,
    [string]$VersionName = "1.0.0"
)
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$image = "poulies-android-builder"

if ($Url -notmatch '^https://[^/]+') { throw "Url must be the public https:// address of the website." }
if (-not $Url.EndsWith("/")) { $Url += "/" }

Write-Host "`n1/4  Preparing the build image (first time: about 1 GB to download)..." -ForegroundColor Cyan
docker build -t $image -f "$here\builder.Dockerfile" "$here"
if ($LASTEXITCODE) { throw "Building the Docker build image failed." }

$props = Join-Path $here "keystore.properties"
if (-not (Test-Path $props)) {
    Write-Host "`n2/4  Creating your upload key (only once)..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force (Join-Path $here "keystore") | Out-Null
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $pw = [Convert]::ToBase64String($bytes) -replace '[+/=]', 'x'
    docker run --rm -v "${here}:/project" $image keytool -genkeypair -keystore /project/keystore/upload.jks `
        -alias upload -keyalg RSA -keysize 2048 -validity 10000 -storepass $pw -keypass $pw -dname "CN=Poulies-courroies upload key"
    if ($LASTEXITCODE) { throw "Creating the upload key failed." }
    @("storeFile=keystore/upload.jks", "storePassword=$pw", "keyAlias=upload", "keyPassword=$pw") | Set-Content -Encoding ascii $props
} else {
    Write-Host "`n2/4  Upload key already exists, reusing it." -ForegroundColor Cyan
}

Write-Host "`n3/4  Building the app bundle for $Url (version $VersionName, code $VersionCode)..." -ForegroundColor Cyan
# Gradle cannot lock files in a Windows folder shared with Docker, so the project is copied
# inside the container, built there, and only the finished bundle is written back to android\dist.
$dist = Join-Path $here "dist"
New-Item -ItemType Directory -Force $dist | Out-Null
$name = "poulies-courroies-$VersionName-$VersionCode.aab"
$build = "cp -r /src /build && rm -rf /build/.gradle /build/build /build/app/build /build/dist && cd /build && " +
         "gradle --no-daemon --console=plain bundleRelease '-PwebAppUrl=$Url' '-PversionCode=$VersionCode' '-PversionName=$VersionName' && " +
         "cp app/build/outputs/bundle/release/app-release.aab /out/$name"
docker run --rm -v "${here}:/src:ro" -v "${dist}:/out" -v poulies-gradle-cache:/cache/gradle $image sh -c $build
if ($LASTEXITCODE) { throw "The Gradle build failed. Read the error above." }

$pw = ((Get-Content $props) | Where-Object { $_ -like "storePassword=*" }) -replace '^storePassword=', ''
Write-Host "`n4/4  Checking the signature and reading the upload key fingerprint..." -ForegroundColor Cyan
docker run --rm -v "${dist}:/out" $image jarsigner -verify /out/$name
if ($LASTEXITCODE) { throw "The bundle is not correctly signed." }
Write-Host "Upload key SHA-256 (goes in ANDROID_SHA256_CERT_FINGERPRINT, after the Play key):"
docker run --rm -v "${here}:/project" $image keytool -list -v -keystore /project/keystore/upload.jks -alias upload -storepass $pw |
    Select-String "SHA256:"

$aab = Join-Path $dist $name
Write-Host "`nDone. Upload this file to Google Play Console:`n  $aab`n" -ForegroundColor Green
