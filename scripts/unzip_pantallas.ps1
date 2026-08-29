# Script para descomprimir todos los archivos .zip dentro de 'Pantallas PWA'
# en sus carpetas contenedoras respectivas.

$targetDir = Join-Path -Path $PSScriptRoot -ChildPath "..\Pantallas PWA"
$targetDir = (Resolve-Path $targetDir).Path

Write-Host "Buscando archivos .zip en: $targetDir"

$zipFiles = Get-ChildItem -LiteralPath $targetDir -Recurse -Filter *.zip

if ($zipFiles.Count -eq 0) {
    Write-Host "No se encontraron archivos .zip para descomprimir."
    exit 0
}

Write-Host "Se encontraron $($zipFiles.Count) archivos comprimidos. Procediendo a descomprimir..."

foreach ($zip in $zipFiles) {
    $destination = $zip.DirectoryName
    Write-Host "Descomprimiendo: $($zip.Name) -> $destination"
    try {
        Expand-Archive -LiteralPath $zip.FullName -DestinationPath $destination -Force
        Write-Host " [OK] Descomprimido exitosamente: $($zip.Name)" -ForegroundColor Green
    }
    catch {
        Write-Host " [ERROR] Error al descomprimir $($zip.Name): $_" -ForegroundColor Red
    }
}

Write-Host "`nProceso de descompresion completado." -ForegroundColor Cyan
