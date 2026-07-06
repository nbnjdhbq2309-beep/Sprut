// scripts/apply-native-patch.js
// Запускается после `npx cap add android` в CI (или локально).
// Копирует кастомные Kotlin-файлы плагина/сервиса и дописывает
// разрешения + <service> в сгенерированный AndroidManifest.xml.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PKG_DIR = path.join(ROOT, "package-android-src");
const JAVA_DIR = path.join(
  ROOT,
  "android/app/src/main/java/com/uniqdev/meetingrecorder"
);
const MANIFEST_PATH = path.join(
  ROOT,
  "android/app/src/main/AndroidManifest.xml"
);

function log(msg) {
  console.log(`[apply-native-patch] ${msg}`);
}

function copyKotlinFiles() {
  fs.mkdirSync(JAVA_DIR, { recursive: true });
  const files = ["AudioRecordingService.kt", "MeetingRecorderPlugin.kt", "MainActivity.kt"];
  for (const file of files) {
    const src = path.join(PKG_DIR, file);
    const dest = path.join(JAVA_DIR, file);
    fs.copyFileSync(src, dest);
    log(`Скопирован ${file}`);
  }
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
      xml = xml.replace(
        /(<manifest[^>]*>)/,
        `$1\n${line}`
      );
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
    console.error(
      "Папка android/ не найдена. Сначала выполните: npx cap add android"
    );
    process.exit(1);
  }
  copyKotlinFiles();
  patchManifest();
  log("Готово. Нативный код и разрешения внедрены в android/ проект.");
}

main();
