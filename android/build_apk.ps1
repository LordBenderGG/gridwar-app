# =============================================================
# COMPILACION APK RELEASE — GRIDWAR
# =============================================================
# REQUISITOS:
#   - Java 8 instalado en sistema (NO sirve para compilar)
#   - Java 17 (JBR) incluido en Android Studio:
#       C:\Program Files\Android\Android Studio\jbr
#   - Android SDK en:
#       C:\Users\USUARIO\AppData\Local\Android\Sdk
#     (configurado en android/local.properties)
#
# COMO EJECUTAR:
#   powershell -ExecutionPolicy Bypass -File "E:\opencode\gridwar\android\build_apk.ps1"
#
# APK GENERADO EN:
#   E:\opencode\gridwar\android\app\build\outputs\apk\release\app-release.apk
#
# NOTAS:
#   - El sistema tiene Java 8 por defecto — NO usar, falla con error JVM 11+
#   - Siempre usar el JBR de Android Studio como JAVA_HOME
#   - Primera compilacion limpia tarda ~5-8 minutos
#   - Compilaciones siguientes son mas rapidas (cache Gradle UP-TO-DATE)
#   - Metro Bundler procesa 1295 modulos y genera el bundle JS/Android
#   - APK tamaño aprox: 71-78 MB (release firmado con keystore del proyecto)
# =============================================================

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = $env:JAVA_HOME + "\bin;" + $env:PATH

Set-Location "E:\opencode\gridwar\android"

$process = Start-Process `
    -FilePath ".\gradlew.bat" `
    -ArgumentList "assembleRelease" `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput ".\build_out.txt" `
    -RedirectStandardError ".\build_err.txt"

Get-Content ".\build_out.txt"
Get-Content ".\build_err.txt"

if ($process.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "BUILD EXITOSO"
    $apk = Get-Item ".\app\build\outputs\apk\release\app-release.apk"
    Write-Host "APK: $($apk.FullName)"
    Write-Host "Fecha: $($apk.LastWriteTime)"
    Write-Host "Tamanio: $([math]::Round($apk.Length / 1MB, 1)) MB"
} else {
    Write-Host "BUILD FALLIDO codigo: $($process.ExitCode)"
}
