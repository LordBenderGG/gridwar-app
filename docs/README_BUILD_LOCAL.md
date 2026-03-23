# GRIDWAR - Guia de Build Local

## Estado del proyecto
El proyecto esta **100% funcional** hasta este punto.

- App name: `GRIDWAR`
- Build: **local** (sin EAS/cloud)
- APK release: se genera correctamente
- Stack:
  - React Native + Expo modules
  - Firebase (Auth, Firestore, RTDB)
  - Zustand
  - i18n (ES/EN)

## Compilar en local (Android Release)

### 1) Ir a carpeta Android
```bat
cd /d E:\opencode\gridwar\android
```

### 2) Compilar release
```bat
gradlew.bat assembleRelease
```

### 3) APK final
```text
E:\opencode\gridwar\android\app\build\outputs\apk\release\app-release.apk
```

## Compilacion limpia (opcional)
Si quieres compilar desde cero:

```bat
cd /d E:\opencode\gridwar\android
gradlew.bat clean assembleRelease
```

## Notas utiles

- Este flujo es **100% local**, directo con Gradle.
- No requiere `expo build` ni `eas build`.
- Si Android Studio/Java cambia, usar Java 17 (JBR de Android Studio).
- Si falla por cache, ejecutar `clean` y volver a compilar.

## Checklist rapido antes de entregar APK

- [ ] El comando `assembleRelease` termina en `BUILD SUCCESSFUL`
- [ ] Existe el archivo `app-release.apk` en la ruta final
- [ ] La app abre correctamente despues de login
- [ ] Icono y branding GRIDWAR visibles

temporal
https://github.com/LordBenderGG/gridwar-app
<YOUR_TOKEN_HERE>
7 dias