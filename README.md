# GRIDWAR App

ES: App mobile de GRIDWAR construida con Expo/React Native + Firebase.

EN: GRIDWAR mobile app built with Expo/React Native + Firebase.

## Features / Funcionalidades

- 1v1 online board matches (challenges + tournaments)
- Training vs AI mode (separate flow)
- Wildcards in online matches
- Points, gems, ranking, seasons
- Profile, shop, ads, rewards
- ES/EN localization

## Tech Stack

- React Native `0.74.5`
- Expo `~51.0.28`
- Expo Router `~3.5.23`
- Firebase Auth + Firestore + Realtime Database
- Zustand
- i18next

## Project Structure / Estructura

- `app/` routes and screens
- `components/` reusable UI
- `services/` game logic + Firebase integration
- `store/` global state
- `i18n/` translations
- `android/` native Android project + release build script

## Requirements / Requisitos

- Node.js 18+
- npm
- Android Studio (SDK installed)
- Java 17 (Android Studio JBR)

## Install / Instalación

```bash
npm install
```

## Run Dev / Ejecutar desarrollo

```bash
npm run start
```

Optional / Opcional:

```bash
npm run android
npm run ios
npm run web
```

## Android Release APK

This repo uses a local PowerShell script:

- `android/build_apk.ps1`

Run from project root:

```powershell
powershell -ExecutionPolicy Bypass -File ".\android\build_apk.ps1"
```

Output APK:

- `android/app/build/outputs/apk/release/app-release.apk`

## Firebase

Main config files:

- `services/firebase.ts`
- `google-services.json`
- `firestore.rules`
- `database.rules.json`

Note / Nota:

- If `users/{uid}` is deleted in Firestore while Auth user still exists, app recreates profile at login.

## Core Flows / Flujos clave

- Online game: `app/game/[gameId].tsx`, `services/game.ts`
- Wildcards: `services/wildcards.ts`
- Challenges: `services/challenge.ts`
- Tournaments: `services/tournament.ts`
- Result screen: `app/game/resultado.tsx`
- Training: `app/(tabs)/entrenamiento.tsx`, `app/game/vs-ia.tsx`

## Useful Commands / Comandos útiles

```bash
npx tsc --noEmit
git status
```

## Rollback Point

Checkpoint tag:

- `rollback-plan-a-start-20260316`

Restore to checkpoint:

```bash
git reset --hard rollback-plan-a-start-20260316
```

## Repository

- `https://github.com/LordBenderGG/gridwar-app`
