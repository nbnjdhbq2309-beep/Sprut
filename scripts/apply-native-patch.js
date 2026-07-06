// scripts/apply-native-patch.js
// Запускается после `npx cap add android` в CI.
// Копирует кастомные Kotlin-файлы плагина/сервиса, дописывает
// разрешения + <service> в AndroidManifest.xml.
//
// ВАЖНО: скрипт САМ определяет реальный package/appId проекта (читая
// сгенерированный MainActivity и build.gradle), а не полагается на
// жёстко прописанный "com.uniqdev.meetingrecorder" — если appId вдруг
// не совпадёт с этим значением, файлы всё равно попадут в правильное
// место с правильным `package` внутри, и Android будет грузить именно
// наш MainActivity.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PKG_DIR = path.join(ROOT, "package-android-src");
const JAVA_ROOT = path.join(ROOT, "android/app/src/main/java");
const BUILD_GRADLE_PATH = path.join(ROOT, "android/app/build.gradle");
const MANIFEST_PATH = path.join(
  ROOT,
  "android/app/src/main/AndroidManifest.xml"
);
const DEFAULT_PACKAGE = "com.uniqdev.meetingrecorder";

function log(msg) {
  console.log(`[apply-native-patch] ${msg}`);
}

function findAllMainActivityFiles() {
  const found = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/^MainActivity\.(java|kt)$/.test(entry.name)) {
        found.push(full);
      }
    }
  }
  if (fs.existsSync(JAVA_ROOT)) {
    walk(JAVA_ROOT);
  }
  return found;
}

function detectRealPackage(existingMainActivityFiles) {
  if (existingMainActivityFiles.length > 0) {
    const content = fs.readFileSync(existingMainActivityFiles[0], "utf8");
    const match = content.match(/^\s*package\s+([\w.]+)\s*;?/m);
    if (match) {
      log(`Реальный package определён из сгенерированного MainActivity: ${match[1]}`);
      return match[1];
    }
  }
  if (fs.existsSync(BUILD_GRADLE_PATH)) {
    const gradleContent = fs.readFileSync(BUILD_GRADLE_PATH, "utf8");
    const match = gradleContent.match(/applicationId\s+["']([\w.]+)["']/);
    if (match) {
      log(`Реальный package определён из build.gradle applicationId: ${match[1]}`);
      return match[1];
    }
  }
  log(`Не удалось определить реальный package, использую значение по умолчанию: ${DEFAULT_PACKAGE}`);
  return DEFAULT_PACKAGE;
}

function copyKotlinFiles() {
  const existing = findAllMainActivityFiles();
  const realPackage = detectRealPackage(existing);
  const targetDir = path.join(JAVA_ROOT, ...realPackage.split("."));

  for (const file of existing) {
    fs.unlinkSync(file);
    log(`Удалён сгенерированный файл активности: ${file}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const files = ["AudioRecordingService.kt", "MeetingRecorderPlugin.kt", "MainActivity.kt"];
  for (const file of files) {
    let content = fs.readFileSync(path.join(PKG_DIR, file), "utf8");
    if (realPackage !== DEFAULT_PACKAGE) {
      content = content.replace(
        new RegExp(`^package\\s+${DEFAULT_PACKAGE.replace(/\./g, "\\.")}\\s*$`, "m"),
        `package ${realPackage}`
      );
      log(`Package в ${file} переписан на ${realPackage}`);
    }
    fs.writeFileSync(path.join(targetDir, file), content, "utf8");
    log(`Скопирован ${file} -> ${path.join(targetDir, file)}`);
  }

  return { targetDir, realPackage };
}

function verifyPatchApplied(targetDir) {
  const requiredFiles = ["AudioRecordingService.kt", "MeetingRecorderPlugin.kt", "MainActivity.kt"];
  for (const file of requiredFiles) {
    const fullPath = path.join(targetDir, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`ПРОВЕРКА НЕ ПРОЙДЕНА: файл отсутствует после копирования: ${fullPath}`);
      process.exit(1);
    }
  }

  const remainingConflicts = findAllMainActivityFiles().filter(
    (f) => f !== path.join(targetDir, "MainActivity.kt")
  );
  if (remainingConflicts.length > 0) {
    console.error(
      `ПРОВЕРКА НЕ ПРОЙДЕНА: остались конфликтующие файлы активности: ${remainingConflicts.join(", ")}`
    );
    process.exit(1);
  }

  const mainActivityContent = fs.readFileSync(path.join(targetDir, "MainActivity.kt"), "utf8");
  if (!mainActivityContent.includes("registerPlugin(MeetingRecorderPlugin")) {
    console.error("ПРОВЕРКА НЕ ПРОЙДЕНА: MainActivity.kt не содержит вызов registerPlugin(MeetingRecorderPlugin)");
    process.exit(1);
  }

  log("Проверка пройдена: нужные файлы на месте, конфликтов нет, registerPlugin присутствует.");
}

function patchManifest() {
  let xml = fs.readFileSync(MANIFEST_PATH, "utf8");

  const permissionsToAdd = [
    '    <uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />',
    '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '    <uses-permission android:name="android.permission.WAKE_LOCK" />'
  ];

  for (const line of permissionsToAdd) {
    const permName = line.match(/android:name="([^"]+)"/)[1];
    if (!xml.includes(permName)) {
      xml = xml.replace(/(<manifest[^>]*>)/, `$1\n${line}`);
      log(`Добавлено разрешение ${permName}`);
    } else {
      log(`Разрешение ${permName} уже присутствует — пропуск`);
    }
  }

  const serviceBlock = `
        <service
            android:name=".AudioRecordingService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="microphone" />
`;

  if (!xml.includes("AudioRecordingService")) {
    xml = xml.replace(/(<\/application>)/, `${serviceBlock}    $1`);
    log("Добавлен <service> блок AudioRecordingService");
  } else {
    log("Service уже объявлен — пропуск");
  }

  fs.writeFileSync(MANIFEST_PATH, xml, "utf8");
}

function main() {
  if (!fs.existsSync(path.join(ROOT, "android"))) {
    console.error("Папка android/ не найдена. Сначала выполните: npx cap add android");
    process.exit(1);
  }
  const { targetDir, realPackage } = copyKotlinFiles();
  patchManifest();
  verifyPatchApplied(targetDir);
  log(`Готово. Нативный код внедрён в пакет ${realPackage}.`);
}

main();
