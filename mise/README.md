# CLI-инструменты в Linux

mise управляет пользовательскими CLI, apt — ОС и сервисами. Эта конфигурация
предназначена для Linux; на macOS используется Homebrew.

## Кто чем управляет

| Менеджер | Приложения |
| --- | --- |
| mise / aqua | bat, btop, Caddy CLI, Codex, delta, eza, fd, fnm, fzf, GitHub CLI, herdr, jq, lazygit, Neovim, Pi, ripgrep, starship, tree-sitter, Worktrunk, Yazi, zoxide |
| apt + Git Core PPA | Git |
| apt + репозитории разработчиков | Docker, Tailscale |
| Ubuntu apt | Системные пакеты, zsh, GNU Stow, build-essential |
| fnm | Node.js LTS; npm обновляется внутри выбранной установки Node |

`latest` выбирает стабильные релизы, но не включает автообновление. Aqua скачивает
готовые бинарники и проверяет их способом, указанным в рецепте. Сам mise также требует обновления.

В zsh приоритет у mise; абсолютные пути и `sudo` могут выбирать системные версии.
Caddy из mise — только CLI, не системный сервис.
Для сборки парсеров Neovim нужны tree-sitter CLI из mise и C-компилятор:
в Ubuntu он устанавливается командой `sudo apt install build-essential`.

Для предпросмотра в Yazi нужны ffmpeg, ImageMagick, poppler-utils и 7zip.
Эти зависимости необходимо сохранять при очистке apt-пакетов.

## Установка на другой Linux-машине

1. Установить mise по [официальной инструкции](https://mise.jdx.dev/installing-mise.html).
2. Из корня репозитория выполнить `stow mise zsh`. До запуска разрешить конфликты
   конфигурации без перезаписи локальных настроек.
3. Установить инструменты: `mise install`.
4. Перезапустить shell: `exec zsh -l`.

Конфигурация zsh активирует mise до fzf и starship, а для неинтерактивных shell
добавляет shims в PATH. Для других оболочек, сервисов и планировщиков требуется
отдельная настройка PATH либо запуск через `mise exec -- <команда>`.

Stow не подключает apt-репозитории. На этой машине настроены `ppa:git-core/ppa`,
`https://download.docker.com/linux/ubuntu` и `https://pkgs.tailscale.com/stable/ubuntu`.
Для apt-пакета Yazi также подключён `https://yazi-rs.github.io/builds/`;
активной версией Yazi управляет mise.

## Обновление

Проверка доступных версий:

```sh
mise upgrade --global --dry-run
sudo apt update
apt list --upgradable
```

Apt сравнивает версии только с подключёнными репозиториями, не с upstream.
Например, zsh может отставать от последнего релиза. Системная login-shell остаётся
под управлением Ubuntu.

```sh
mise self-update
mise upgrade --global
sudo apt upgrade          # Перед подтверждением — проверка списка, особенно сервисов.
npm install -g npm@latest # Для текущей установки Node.
```

Pi установлен из официального standalone-релиза через `aqua:earendil-works/pi`.
Pi и Codex обновляются через mise, а не через `pi update`, `codex update` или глобальный npm.
Пакетами расширений и каталогами моделей управляет Pi:

```sh
pi update --extensions
pi update --models
```

Ссылки `~/.local/bin/pi` и `~/.config/pi/bin/pi` ведут на shim mise.

Для перехода на последнюю Node.js LTS и обновления npm:

```sh
fnm install --lts
fnm use --lts
fnm default "$(node --version)"
npm install -g npm@latest
```

Версия Node из проекта имеет приоритет. После обновлений требуется перезапуск
нужных терминалов и приложений: работающий процесс сам не переключится на новый бинарник.

## Проверка и откат

```sh
mise ls
mise doctor
command -v nvim delta gh
mise which nvim
```

`upgrade.auto_prune = false` сохраняет старые версии для отката и работающих процессов.
Чтобы закрепить конкретную версию, а затем вернуть отслеживание стабильных релизов:

```sh
mise use -g aqua:neovim/neovim@0.12.6
mise use -g aqua:neovim/neovim@latest
```
