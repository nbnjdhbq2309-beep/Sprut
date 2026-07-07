# Sprut iOS

Черновой iPhone-аналог Android-приложения `Sprut_INSTALL_ON_PHONE.apk`.

Что уже есть:
- экран входа;
- локальное хранение логина и пароля;
- авторизация через `https://ononeon.com/meeting.php`;
- запись встречи через `AVAudioRecorder`;
- пауза, продолжение, стоп и сброс записи;
- автоматическая отправка записи на `api.php?action=analyze`;
- получение `checklist_id` через `api.php?action=checklists`;
- базовая настройка `AVAudioSession` и `background audio`;
- интерфейс на `SwiftUI`.

## Структура

- `project.yml` - описание проекта для `XcodeGen`;
- `Sources/` - Swift-код и `Info.plist`;
- `.github/workflows/ios-ci.yml` - пример CI-сборки на `GitHub Actions`;
- `.gitignore` - исключения для Xcode и локальных артефактов.

## Как загрузить на GitHub

1. Создать пустой репозиторий на GitHub.
2. Залить содержимое папки `SprutIOS` в корень репозитория.
3. При необходимости поменять `PRODUCT_BUNDLE_IDENTIFIER` в `project.yml`.
4. Запушить изменения.

## Как собрать в CI

Этот репозиторий уже подготовлен под `macOS CI`.

Что делает workflow:
- поднимает `macos-latest`;
- устанавливает `XcodeGen`;
- генерирует `SprutIOS.xcodeproj`;
- выполняет сборку для `iPhone Simulator` без подписи.

Это полезно для проверки, что проект вообще собирается. Для установки на реальный iPhone и выпуска `ipa` позже понадобится настройка signing.

## Локальная сборка на Mac

1. Установить `Xcode`.
2. Установить `XcodeGen`.
3. В каталоге проекта выполнить `xcodegen generate`.
4. Открыть `SprutIOS.xcodeproj`.
5. Выбрать `Team`, `Bundle Identifier` и signing.
6. Собрать на симуляторе или на iPhone.

## Ограничения

- На Windows нативную iOS-сборку запустить нельзя.
- Без платного `Apple Developer` можно тестировать только ограниченные personal builds.
- Background recording на iPhone нужно отдельно проверять на реальном устройстве.
