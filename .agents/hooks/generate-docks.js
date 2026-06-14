// Этот hook-скрипт генерирует карту модулей проекта в папке `docks/`.
//
// Когда он срабатывает:
// 1. После редактирования файлов через Cursor hook `afterFileEdit`.
//    В этом режиме скрипт проверяет payload и работает только если изменение
//    относится к `src/`.
// 2. В конце работы агента через hook `stop`.
//    Это нужно, чтобы пересобирать карту после удалений и любых финальных правок.
// 3. Вручную из терминала, если нужно принудительно пересобрать `docks/`.
//
// Что он делает:
// - сканирует дерево `src/`;
// - собирает список файлов и папок;
// - определяет внутренние зависимости по import/export;
// - полностью пересобирает `docks/src/`;
// - создает README.md для корня и для каждой найденной папки-модуля.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.join(projectRoot, 'src');
const docksRoot = path.join(projectRoot, 'docks');
const docksSrcRoot = path.join(docksRoot, 'src');
const moduleExtensions = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.scss',
  '.sass',
  '.json',
  '.html',
]);

async function main() {
  const mode = getCliFlag('--mode') ?? 'manual';
  const rawInput = await readStdin();
  const payload = parseJson(rawInput);

  // После обычного file edit не трогаем `docks/`, если `src/` не участвовал.
  if (mode === 'afterFileEdit' && !payloadTouchesSrc(payload)) {
    return;
  }

  // Генерация всегда идет "с нуля", чтобы честно отражать и изменения, и удаления.
  await fs.mkdir(docksRoot, { recursive: true });
  await fs.rm(docksSrcRoot, { recursive: true, force: true });

  const sourceTree = await scanSourceTree();

  if (!sourceTree) {
    // Если `src/` пока нет, оставляем только корневую заглушку в `docks/`.
    await writeFile(path.join(docksRoot, 'README.md'), buildEmptyRootReadme());
    return;
  }

  const { files, directories } = sourceTree;
  const graph = buildDependencyGraph(files, directories);
  const fileGraph = buildFileDependencyGraph(files);

  // Сначала создаем обзорный README для всего `docks/`.
  await writeFile(path.join(docksRoot, 'README.md'), buildDocksRootReadme(directories));

  // Затем создаем README для каждой папки внутри `src/`.
  for (const directory of directories) {
    const readmePath = path.join(docksSrcRoot, directory.relativeDir, 'README.md');
    const content = buildDirectoryReadme({
      directory,
      directories,
      files,
      graph,
    });

    await writeFile(readmePath, content);
  }

  // Для каждого исходного файла создаем короткую карточку с назначением
  // и простым принципом работы.
  for (const file of files) {
    const fileDocPath = getFileDocPath(file.relativePath);
    const content = buildFileReadme(file, fileGraph);

    await writeFile(fileDocPath, content);
  }
}

function getCliFlag(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readStdin() {
  // Hook-и Cursor передают JSON через stdin.
  // Таймаут нужен, чтобы ручной запуск не зависал в ожидании входных данных.
  return await new Promise((resolve) => {
    let result = '';
    let settled = false;
    const onData = (chunk) => {
      result += chunk;
    };
    const onEnd = () => {
      clearTimeout(timeout);
      finish();
    };
    const onError = () => {
      clearTimeout(timeout);
      finish();
    };
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.off('error', onError);
      process.stdin.pause();
      resolve(result.trim());
    };

    const timeout = setTimeout(finish, 50);
    timeout.unref?.();

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
    process.stdin.resume();
  });
}

function parseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function payloadTouchesSrc(payload) {
  if (!payload) {
    return false;
  }

  // Ищем любые строки-пути в hook payload и проверяем, есть ли там `src/`.
  const queue = [payload];

  while (queue.length > 0) {
    const current = queue.shift();

    if (typeof current === 'string') {
      const normalized = current.replaceAll('\\', '/').toLowerCase();

      if (normalized.includes('/src/') || normalized.startsWith('src/')) {
        return true;
      }

      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (current && typeof current === 'object') {
      queue.push(...Object.values(current));
    }
  }

  return false;
}

async function scanSourceTree() {
  try {
    await fs.access(srcRoot);
  } catch {
    return null;
  }

  // Собираем все поддерживаемые исходники, затем строим карту директорий.
  const files = [];
  await collectFiles(srcRoot, files);

  const directoryMap = new Map();

  for (const file of files) {
    const dirPath = path.dirname(file.relativePath);
    addDirectoryChain(directoryMap, dirPath === '.' ? '' : dirPath);
  }

  if (!directoryMap.has('')) {
    directoryMap.set('', createDirectoryInfo(''));
  }

  for (const directory of directoryMap.values()) {
    directory.childDirs = [...directoryMap.values()]
      .filter((entry) => getParentDir(entry.relativeDir) === directory.relativeDir && entry.relativeDir !== directory.relativeDir)
      .sort((a, b) => a.relativeDir.localeCompare(b.relativeDir));

    directory.directFiles = files
      .filter((file) => normalizeDir(path.dirname(file.relativePath)) === directory.relativeDir)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    directory.allFiles = files
      .filter((file) => isInsideDir(file.relativePath, directory.relativeDir))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  const directories = [...directoryMap.values()].sort((a, b) => a.relativeDir.localeCompare(b.relativeDir));

  return { files, directories };
}

async function collectFiles(currentDir, files) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
      continue;
    }

    const extension = path.extname(entry.name);

    if (!moduleExtensions.has(extension)) {
      continue;
    }

    const content = await fs.readFile(fullPath, 'utf8');
    const relativePath = toPosix(path.relative(srcRoot, fullPath));

    // Для каждого файла заранее сохраняем локальные импорты, чтобы потом
    // построить зависимости между модулями.
    files.push({
      fullPath,
      relativePath,
      content,
      imports: extractImports(content)
        .map((specifier) => resolveModule(relativePath, specifier))
        .filter(Boolean),
    });
  }
}

function createDirectoryInfo(relativeDir) {
  return {
    relativeDir,
    childDirs: [],
    directFiles: [],
    allFiles: [],
  };
}

function addDirectoryChain(directoryMap, relativeDir) {
  const chain = [];
  let current = normalizeDir(relativeDir);

  while (true) {
    chain.push(current);

    if (!current) {
      break;
    }

    current = getParentDir(current);
  }

  for (const dir of chain) {
    if (!directoryMap.has(dir)) {
      directoryMap.set(dir, createDirectoryInfo(dir));
    }
  }
}

function buildDependencyGraph(files, directories) {
  const directoryIndex = new Map(directories.map((directory) => [directory.relativeDir, directory]));
  const graph = new Map();

  // Граф хранит два направления:
  // - dependsOn: от кого зависит модуль
  // - usedBy: кем модуль используется
  for (const directory of directories) {
    graph.set(directory.relativeDir, {
      dependsOn: new Set(),
      usedBy: new Set(),
    });
  }

  for (const file of files) {
    const fromDir = normalizeDir(path.dirname(file.relativePath));

    for (const importedFile of file.imports) {
      const toDir = normalizeDir(path.dirname(importedFile));

      if (!directoryIndex.has(toDir) || fromDir === toDir) {
        continue;
      }

      graph.get(fromDir).dependsOn.add(toDir);
      graph.get(toDir).usedBy.add(fromDir);
    }
  }

  return graph;
}

function buildFileDependencyGraph(files) {
  const graph = new Map();

  for (const file of files) {
    graph.set(file.relativePath, {
      dependsOn: new Set(file.imports),
      usedBy: new Set(),
    });
  }

  for (const file of files) {
    for (const importedFile of file.imports) {
      if (!graph.has(importedFile)) {
        continue;
      }

      graph.get(importedFile).usedBy.add(file.relativePath);
    }
  }

  return graph;
}

function extractImports(content) {
  // Здесь нас интересуют только локальные import/export from.
  const matches = content.matchAll(/(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g);
  const specifiers = [];

  for (const match of matches) {
    const specifier = match[1] ?? match[2];

    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function resolveModule(fromFile, specifier) {
  // Разрешаем только относительные импорты внутри `src/`.
  if (!specifier.startsWith('.')) {
    return null;
  }

  const baseDir = path.dirname(path.join(srcRoot, fromFile));
  const rawTarget = path.resolve(baseDir, specifier);
  const candidates = [
    rawTarget,
    `${rawTarget}.js`,
    `${rawTarget}.jsx`,
    `${rawTarget}.ts`,
    `${rawTarget}.tsx`,
    `${rawTarget}.css`,
    path.join(rawTarget, 'index.js'),
    path.join(rawTarget, 'index.ts'),
    path.join(rawTarget, 'index.jsx'),
    path.join(rawTarget, 'index.tsx'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const relative = toPosix(path.relative(srcRoot, candidate));

    if (!relative.startsWith('..')) {
      return relative;
    }
  }

  return null;
}

function buildDocksRootReadme(directories) {
  // Корневой README нужен как входная точка в сгенерированную документацию.
  const topLevelDirs = directories
    .filter((directory) => directory.relativeDir && getParentDir(directory.relativeDir) === '')
    .sort((a, b) => a.relativeDir.localeCompare(b.relativeDir));

  const submoduleLines = topLevelDirs.length > 0
    ? topLevelDirs
        .map((directory) => `- 👤 [\`src/${directory.relativeDir}\`](./src/${directory.relativeDir}/README.md) - ${describeDirectory(directory.relativeDir)}`)
        .join('\n')
    : '- 👤 Сгенерированных подмодулей пока нет.';

  return `# Docks

> Автогенерируемая карта модулей для исходного дерева проекта.

## 🌟 Обзор

- Корень исходников: [\`src/\`](./src/README.md)
- Сгенерированная карта папок: \`docks/src/\`
- У каждой папки-модуля есть \`README.md\` со ссылками и Mermaid-зависимостями.
- У каждого исходного файла есть отдельная карточка формата \`имя_файла.ext.md\`.

## 👥 Верхнеуровневые модули

${submoduleLines}
`;
}

function buildEmptyRootReadme() {
  return `# Docks

> Автогенерируемая карта модулей для исходного дерева проекта.

## 🌟 Обзор

- Папка \`src/\` пока не найдена.
- Сгенерированная документация появится здесь после добавления модулей в \`src/\`.
`;
}

function buildDirectoryReadme({ directory, files, graph }) {
  const relativeDir = directory.relativeDir;
  const moduleName = relativeDir ? `src/${relativeDir}` : 'src';
  const currentGraph = graph.get(relativeDir);
  const summary = describeDirectory(relativeDir);
  const docDir = path.join(docksSrcRoot, relativeDir);

  // README папки показывает:
  // - краткое описание
  // - дочерние модули
  // - прямые файлы
  // - зависимости в обе стороны
  const childModuleLines = directory.childDirs.length > 0
    ? directory.childDirs
        .map((child) => {
          const link = toPosix(path.relative(docDir, path.join(docksSrcRoot, child.relativeDir, 'README.md')));
          return `- 👤 [\`src/${child.relativeDir}\`](${link}) - ${describeDirectory(child.relativeDir)}`;
        })
        .join('\n')
    : '- 👤 Дочерних подмодулей нет.';

  const fileLines = directory.directFiles.length > 0
    ? directory.directFiles
        .map((file) => {
          const sourcePath = path.join(srcRoot, file.relativePath);
          const sourceLink = toPosix(path.relative(docDir, sourcePath));
          const docLink = toPosix(path.relative(docDir, getFileDocPath(file.relativePath)));
          return `- 📄 [\`${path.basename(file.relativePath)}.md\`](${docLink}) - ${describeFile(file)} Исходник: [\`${path.basename(file.relativePath)}\`](${sourceLink})`;
        })
        .join('\n')
    : '- 📄 В этой папке нет прямых исходных файлов.';

  const dependencyLines = [...currentGraph.dependsOn]
    .sort((a, b) => a.localeCompare(b))
    .map((dependency) => `- \`src/${dependency}\``)
    .join('\n') || '- нет';
  const dependencyMermaid = currentGraph.dependsOn.size > 0
    ? `

\`\`\`mermaid
flowchart LR
${buildModuleDirectionMermaid(relativeDir, [...currentGraph.dependsOn], 'dependsOn')}
\`\`\``
    : '';

  const usedByLines = [...currentGraph.usedBy]
    .sort((a, b) => a.localeCompare(b))
    .map((dependency) => `- \`src/${dependency}\``)
    .join('\n') || '- нет';
  const usedByMermaid = currentGraph.usedBy.size > 0
    ? `

\`\`\`mermaid
flowchart LR
${buildModuleDirectionMermaid(relativeDir, [...currentGraph.usedBy], 'usedBy')}
\`\`\``
    : '';

  return `# ${moduleName}

> Автогенерируемый README модуля.

## 🌟 Кратко

${summary}

## 👥 Подмодули

${childModuleLines}

## 📄 Файлы

${fileLines}

## 🍎 Зависимости

### 🍎 Зависит от

${dependencyLines}${dependencyMermaid}

### 🍑 Используется в

${usedByLines}${usedByMermaid}
`;
}

function buildFileReadme(file, fileGraph) {
  const graphEntry = fileGraph.get(file.relativePath);
  const fileName = path.basename(file.relativePath);
  const moduleDir = normalizeDir(path.dirname(file.relativePath));
  const moduleReadmePath = path.join(docksSrcRoot, moduleDir, 'README.md');
  const fileDocPath = getFileDocPath(file.relativePath);
  const fileDocDir = path.dirname(fileDocPath);
  const analysis = analyzeSourceFile(file);
  const sourceLink = toPosix(path.relative(fileDocDir, path.join(srcRoot, file.relativePath)));
  const moduleLink = toPosix(path.relative(fileDocDir, moduleReadmePath));
  const dependsOnLines = [...graphEntry.dependsOn]
    .sort((a, b) => a.localeCompare(b))
    .map((dependency) => `- 🍎 \`${dependency}\``)
    .join('\n') || '- 🍎 Нет прямых локальных зависимостей.';
  const dependsOnMermaid = graphEntry.dependsOn.size > 0
    ? `

\`\`\`mermaid
flowchart LR
${buildFileDirectionMermaid(file.relativePath, [...graphEntry.dependsOn], 'dependsOn')}
\`\`\``
    : '';
  const usedByLines = [...graphEntry.usedBy]
    .sort((a, b) => a.localeCompare(b))
    .map((dependency) => `- 🍑 \`${dependency}\``)
    .join('\n') || '- 🍑 Пока не используется другими файлами из `src/`.';
  const usedByMermaid = graphEntry.usedBy.size > 0
    ? `

\`\`\`mermaid
flowchart LR
${buildFileDirectionMermaid(file.relativePath, [...graphEntry.usedBy], 'usedBy')}
\`\`\``
    : '';
  const principle = describeFilePrinciple(file);
  const methodsSection = buildMethodsSection(file, analysis);
  const methodMapSection = buildMethodMapSection(file, analysis);
  const constantsSection = buildConstantsSection(analysis.constants);

  return `# ${fileName}.md

> Автогенерируемая карточка исходного файла.

## 🌟 Для чего нужен

${describeFilePurpose(file)}

## 🍎 Принцип

${principle}
${methodsSection}${methodMapSection}${constantsSection}

## 👥 Связи

- 👤 Родительский модуль: [\`src/${moduleDir || ''}\`](${moduleLink})
- 📄 Исходный файл: [\`${fileName}\`](${sourceLink})

### 🍎 Зависит от

${dependsOnLines}${dependsOnMermaid}

### 🍑 Используется в

${usedByLines}${usedByMermaid}
`;
}

function buildMethodsSection(file, analysis) {
  if (analysis.methods.length === 0) {
    return `

## 🧩 Методы

- В этом файле нет явных именованных методов верхнего уровня.`;
  }

  const items = analysis.methods
    .map((method) => {
      const usedConstants = method.usedConstants.length > 0
        ? method.usedConstants.map((name) => `\`${name}\``).join(', ')
        : 'нет явных ключевых констант';
      const calledMethods = method.calledMethods.length > 0
        ? method.calledMethods.map((name) => `\`${name}()\``).join(', ')
        : 'нет вызовов других именованных методов';

      return `### \`${method.name}(${method.params.join(', ')})\`

- Для чего нужен: ${describeMethodPurpose(file, method)}
- Что использует: ${usedConstants}
- Какие методы вызывает: ${calledMethods}`;
    })
    .join('\n\n');

  return `

## 🧩 Методы

${items}`;
}

function buildMethodMapSection(file, analysis) {
  if (analysis.methods.length === 0) {
    return '';
  }

  return `

## 🗺️ Карта зависимостей методов

\`\`\`mermaid
flowchart LR
${buildMethodDependencyMermaid(file, analysis)}
\`\`\``;
}

function buildConstantsSection(constants) {
  if (constants.length === 0) {
    return '';
  }

  const items = constants
    .map((constant) => {
      const value = summarizeConstantValue(constant.value);

      return `### \`${constant.name}\`

- Значение: \`${value}\`
- Для чего нужен: ${describeConstantPurpose(constant)}`;
    })
    .join('\n\n');

  return `

## 🔑 Ключевые константы

${items}`;
}

function buildModuleDirectionMermaid(relativeDir, relatedModules, direction) {
  const currentId = sanitizeNodeId(relativeDir || 'srcRoot');
  const currentLabel = relativeDir ? `src/${relativeDir}` : 'src';
  const lines = [`    ${currentId}["${currentLabel}"]`];

  for (const relatedModule of relatedModules.sort((a, b) => a.localeCompare(b))) {
    const relatedId = sanitizeNodeId(`${direction}_${relatedModule}`);

    if (direction === 'dependsOn') {
      lines.push(`    ${currentId} --> ${relatedId}["src/${relatedModule}"]`);
    } else {
      lines.push(`    ${relatedId}["src/${relatedModule}"] --> ${currentId}`);
    }
  }

  return lines.join('\n');
}

function describeDirectory(relativeDir) {
  if (!relativeDir) {
    return 'Главная папка исходников приложения.';
  }

  const name = path.basename(relativeDir).toLowerCase();

  if (name === 'assets') {
    return 'Общие загрузчики ассетов, координаты атласа и текстурные helper-модули.';
  }

  if (name === 'components') {
    return 'Переиспользуемые UI-компоненты и строительные блоки сцены.';
  }

  if (name === 'styles') {
    return 'Общие стили и правила визуального оформления.';
  }

  if (name === 'hooks') {
    return 'Runtime-hook-и и helper-модули жизненного цикла.';
  }

  if (name === 'utils' || name === 'lib') {
    return 'Переиспользуемые helper-функции для других модулей.';
  }

  return `Группа модулей для \`${relativeDir}\`.`;
}

function describeFile(file) {
  const baseName = path.basename(file.relativePath).toLowerCase();
  const dirName = normalizeDir(path.dirname(file.relativePath));

  if (baseName === 'main.js' || baseName === 'main.ts') {
    return 'Точка входа приложения, которая поднимает runtime.';
  }

  if (baseName.endsWith('.css')) {
    return 'Общий stylesheet для страницы и canvas-представления.';
  }

  if (dirName === 'assets') {
    return 'Модуль ассетов, который отдает фреймы медиа или helper-логику загрузки.';
  }

  if (dirName === 'components') {
    return 'Переиспользуемый модуль компонента, который рендерится приложением.';
  }

  const importCount = file.imports.length;
  return `Исходный модуль с ${importCount} внутренн${importCount === 1 ? 'ей зависимостью' : 'ими зависимостями'}.`;
}

function describeFilePurpose(file) {
  const baseName = path.basename(file.relativePath).toLowerCase();
  const dirName = normalizeDir(path.dirname(file.relativePath));

  if (baseName === 'main.js' || baseName === 'main.ts') {
    return 'Нужен для запуска приложения и сборки стартовой сцены.';
  }

  if (baseName.endsWith('.css')) {
    return 'Нужен для базового внешнего вида страницы и корректного размещения canvas.';
  }

  if (dirName === 'assets') {
    return 'Нужен для хранения координат, текстур или helper-логики, связанной с ассетами.';
  }

  if (dirName === 'components') {
    return 'Нужен как переиспользуемый строительный блок интерфейса или сцены.';
  }

  return 'Нужен как отдельный модуль, который решает свою локальную задачу внутри проекта.';
}

function describeFilePrinciple(file) {
  const baseName = path.basename(file.relativePath).toLowerCase();
  const dirName = normalizeDir(path.dirname(file.relativePath));

  if (baseName === 'main.js' || baseName === 'main.ts') {
    return 'Собирает точку входа: подключает базовые зависимости, поднимает приложение и добавляет ключевые элементы на сцену.';
  }

  if (baseName.endsWith('.css')) {
    return 'Задает общие правила отображения страницы, чтобы приложение выглядело и располагалось правильно в браузере.';
  }

  if (dirName === 'assets') {
    return 'Работает как слой доступа к ассетам: хранит данные о ресурсах и отдает их в удобной для других модулей форме.';
  }

  if (dirName === 'components') {
    return 'Собирает один самостоятельный визуальный блок и отдает его как готовую часть интерфейса или сцены.';
  }

  return 'Работает как локальный модуль проекта: получает входные данные, подготавливает результат и отдает его другим частям приложения.';
}

function analyzeSourceFile(file) {
  const extension = path.extname(file.relativePath).toLowerCase();

  if (!['.js', '.jsx', '.ts', '.tsx'].includes(extension)) {
    return { methods: [], constants: [] };
  }

  const methods = extractTopLevelMethods(file.content);
  const constants = extractTopLevelConstants(file.content);
  const methodNames = methods.map((method) => method.name);
  const constantNames = constants.map((constant) => constant.name);

  for (const method of methods) {
    method.calledMethods = methodNames.filter((name) => {
      if (name === method.name) {
        return false;
      }

      return new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`).test(method.body);
    });

    method.usedConstants = constantNames.filter((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(method.body));
  }

  return { methods, constants };
}

function extractTopLevelMethods(content) {
  const lines = content.split('\n');
  const methods = [];
  let depth = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (depth !== 0) {
      depth += countBraceDelta(rawLine);
      continue;
    }

    const functionMatch = line.match(/^(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/);
    const arrowMatch = line.match(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/);

    if (!functionMatch && !arrowMatch) {
      depth += countBraceDelta(rawLine);
      continue;
    }

    const match = functionMatch ?? arrowMatch;
    const name = match[1];
    const params = splitParams(match[2]);
    const collected = collectBlock(lines, index);

    methods.push({
      name,
      params,
      body: collected.body,
      calledMethods: [],
      usedConstants: [],
    });

    index = collected.endIndex;
    depth = 0;
  }

  return methods;
}

function extractTopLevelConstants(content) {
  const lines = content.split('\n');
  const constants = [];
  let depth = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (depth !== 0) {
      depth += countBraceDelta(rawLine);
      continue;
    }

    const match = line.match(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);

    if (!match) {
      depth += countBraceDelta(rawLine);
      continue;
    }

    const name = match[1];
    const firstValuePart = match[2];

    if (firstValuePart.includes('=>') || firstValuePart.includes('function')) {
      continue;
    }

    const collected = collectConstantValue(lines, index);

    constants.push({
      name,
      value: collected.value,
    });

    index = collected.endIndex;
    depth = 0;
  }

  return constants;
}

function collectBlock(lines, startIndex) {
  let depth = 0;
  let started = false;
  const buffer = [];
  let endIndex = startIndex;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    buffer.push(line);

    for (const char of line) {
      if (char === '{') {
        depth += 1;
        started = true;
      } else if (char === '}') {
        depth -= 1;
      }
    }

    if (started && depth === 0) {
      endIndex = index;
      break;
    }
  }

  return {
    body: buffer.join('\n'),
    endIndex,
  };
}

function collectConstantValue(lines, startIndex) {
  const buffer = [];
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let endIndex = startIndex;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    buffer.push(line);

    for (const char of line) {
      if (char === '{') {
        braceDepth += 1;
      } else if (char === '}') {
        braceDepth -= 1;
      } else if (char === '[') {
        bracketDepth += 1;
      } else if (char === ']') {
        bracketDepth -= 1;
      } else if (char === '(') {
        parenDepth += 1;
      } else if (char === ')') {
        parenDepth -= 1;
      }
    }

    if (braceDepth <= 0 && bracketDepth <= 0 && parenDepth <= 0 && line.trim().endsWith(';')) {
      endIndex = index;
      break;
    }
  }

  const raw = buffer.join(' ').replace(/\s+/g, ' ').trim();
  const value = raw.replace(/^const\s+[A-Za-z_$][\w$]*\s*=\s*/, '').replace(/;$/, '').trim();

  return { value, endIndex };
}

function splitParams(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function describeMethodPurpose(file, method) {
  const lowerName = method.name.toLowerCase();

  if (lowerName.includes('end') && lowerName.includes('pan')) {
    return 'Завершает режим перемещения по сцене и возвращает интерфейс в обычное состояние.';
  }

  if (lowerName.startsWith('create')) {
    return 'Создает и подготавливает новый объект или часть сцены для дальнейшего использования.';
  }

  if (lowerName.startsWith('load') || lowerName.startsWith('get')) {
    return 'Получает или подготавливает данные, которые нужны другим частям файла.';
  }

  if (lowerName.startsWith('build')) {
    return 'Собирает готовую структуру или представление на основе входных данных.';
  }

  if (lowerName.startsWith('describe')) {
    return 'Готовит человекочитаемое описание для документации.';
  }

  return `Нужен как именованный шаг файла \`${path.basename(file.relativePath)}\`, чтобы вынести отдельную понятную операцию в самостоятельный метод.`;
}

function summarizeConstantValue(value) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 90 ? `${compact.slice(0, 87)}...` : compact;
}

function describeConstantPurpose(constant) {
  const lowerName = constant.name.toLowerCase();
  const value = constant.value;

  if (lowerName === 'app' && value.includes('new Application')) {
    return 'Хранит корневой экземпляр PixiJS-приложения.';
  }

  if (lowerName === 'world' && value.includes('new Container')) {
    return 'Хранит контейнер сцены, который можно двигать как камеру при панорамировании.';
  }

  if (lowerName.includes('state') && value.startsWith('{')) {
    return 'Хранит текущее состояние взаимодействия, чтобы несколько обработчиков работали согласованно.';
  }

  if (lowerName.includes('page')) {
    return 'Хранит готовый визуальный объект, который потом добавляется на сцену.';
  }

  return 'Нужна как опорная константа файла: хранит значение, с которым работает остальная логика.';
}

function buildMethodDependencyMermaid(file, analysis) {
  const fileId = sanitizeNodeId(`method_file_${file.relativePath}`);
  const lines = [`    ${fileId}["${path.basename(file.relativePath)}"]`];

  for (const method of analysis.methods) {
    const methodId = sanitizeNodeId(`method_${file.relativePath}_${method.name}`);
    lines.push(`    ${fileId} --> ${methodId}["${method.name}()"]`);

    for (const calledMethod of method.calledMethods) {
      const calledMethodId = sanitizeNodeId(`method_${file.relativePath}_${calledMethod}`);
      lines.push(`    ${methodId} --> ${calledMethodId}["${calledMethod}()"]`);
    }

    for (const constantName of method.usedConstants) {
      const constantId = sanitizeNodeId(`constant_${file.relativePath}_${constantName}`);
      lines.push(`    ${methodId} --> ${constantId}["${constantName}"]`);
    }
  }

  return [...new Set(lines)].join('\n');
}

function buildFileDirectionMermaid(relativePath, relatedFiles, direction) {
  const currentId = sanitizeNodeId(`file_${relativePath}`);
  const currentLabel = relativePath;
  const lines = [`    ${currentId}["${currentLabel}"]`];

  for (const relatedFile of relatedFiles.sort((a, b) => a.localeCompare(b))) {
    const relatedId = sanitizeNodeId(`file_${direction}_${relatedFile}`);

    if (direction === 'dependsOn') {
      lines.push(`    ${currentId} --> ${relatedId}["${relatedFile}"]`);
    } else {
      lines.push(`    ${relatedId}["${relatedFile}"] --> ${currentId}`);
    }
  }

  return lines.join('\n');
}

function normalizeDir(value) {
  const normalized = toPosix(value);
  return normalized === '.' ? '' : normalized;
}

function getFileDocPath(relativePath) {
  return path.join(docksSrcRoot, `${relativePath}.md`);
}

function getParentDir(relativeDir) {
  if (!relativeDir) {
    return '';
  }

  const parent = path.posix.dirname(relativeDir);
  return parent === '.' ? '' : parent;
}

function isInsideDir(fileRelativePath, relativeDir) {
  if (!relativeDir) {
    return true;
  }

  return fileRelativePath === relativeDir || fileRelativePath.startsWith(`${relativeDir}/`);
}

async function writeFile(targetPath, content) {
  // Перед записью гарантируем, что нужная папка уже существует.
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${content.trim()}\n`, 'utf8');
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function sanitizeNodeId(value) {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countBraceDelta(value) {
  let delta = 0;

  for (const char of value) {
    if (char === '{') {
      delta += 1;
    } else if (char === '}') {
      delta -= 1;
    }
  }

  return delta;
}

main().catch((error) => {
  // Hook не должен ронять пользовательский workflow из-за проблем с docs-генерацией.
  console.error(error);
  process.exit(0);
});
