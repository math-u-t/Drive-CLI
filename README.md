# Google Drive CLI - 完全技術ドキュメント

## 目次
1. [概要](#概要)
2. [システムアーキテクチャ](#システムアーキテクチャ)
3. [セットアップ手順](#セットアップ手順)
4. [コマンドリファレンス](#コマンドリファレンス)
5. [実装詳細](#実装詳細)
6. [拡張ガイド](#拡張ガイド)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### プロジェクトの目的
Google Apps Script (GAS) を使用してブラウザ上で動作するGoogle Drive操作用のCLI（コマンドラインインターフェース）を提供する。

### 技術スタック
- **バックエンド**: Google Apps Script (JavaScript ES5+)
- **フロントエンド**: HTML5 + Vanilla JavaScript
- **API**: Google Drive API (DriveApp Service)
- **通信**: `google.script.run` (非同期RPC)

### 主要機能
- ファイル一覧表示
- ファイル作成・削除
- コマンド履歴管理
- リアルタイムエラーハンドリング
- 拡張可能な設計

---

## システムアーキテクチャ

### レイヤー構成

```
┌─────────────────────────────────────┐
│   UI Layer (index.html)             │
│   - Terminal Rendering              │
│   - Input Handling                  │
│   - Command History                 │
└──────────────┬──────────────────────┘
               │ google.script.run (RPC)
┌──────────────▼──────────────────────┐
│   Business Logic Layer (Code.gs)    │
│   - Command Processing              │
│   - Input Validation                │
│   - Routing                         │
└──────────────┬──────────────────────┘
               │ DriveApp API
┌──────────────▼──────────────────────┐
│   Google Drive API                  │
│   - File Operations                 │
│   - Folder Operations               │
└─────────────────────────────────────┘
```

### データフロー

```
User Input → HTML (sanitize) → GAS (validate) → Drive API → Response → HTML (render)
```

### 型システム

すべてのコマンド関数は以下の型シグネチャに従う:

```typescript
type CommandFunction = (args: string[]) => CommandResult

interface CommandResult {
  success: boolean;  // 処理の成功/失敗
  output: string;    // ユーザーへの表示メッセージ
}
```

---

## セットアップ手順

### ステップ1: プロジェクト作成

1. [Google Apps Script](https://script.google.com) にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「Google Drive CLI」に変更

### ステップ2: ファイル追加

**Code.gs (既存のCode.gsを置き換え)**
- 提供された`Code.gs`の全内容をコピー＆ペースト

**index.html (新規作成)**
1. 左側メニューの「+」→「HTML」をクリック
2. ファイル名を「index」にする
3. 提供された`index.html`の全内容をコピー＆ペースト

### ステップ3: デプロイ

1. 右上の「デプロイ」→「新しいデプロイ」をクリック
2. 「種類の選択」→「ウェブアプリ」を選択
3. 設定:
   - **説明**: v1.0（任意）
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 自分のみ（推奨）
4. 「デプロイ」をクリック

### ステップ4: 権限承認

初回アクセス時:
1. 「承認が必要です」ダイアログが表示される
2. 「権限を確認」をクリック
3. Googleアカウントを選択
4. 「詳細」→「Google Drive CLI（安全ではないページ）に移動」をクリック
5. 「許可」をクリック

**要求される権限**:
- Google Driveのファイルとフォルダの表示、編集、作成、削除

### ステップ5: 動作確認

デプロイURL（例: `https://script.google.com/macros/s/.../exec`）にアクセスし、以下を実行:

```
> help
> list
> create test.txt
> list
> delete test.txt
```

---

## コマンドリファレンス

### `list` / `ls`
**構文**: `list` または `ls`

**機能**: ルートディレクトリのファイル一覧を表示

**出力形式**:
```
Found N file(s):

NAME                          TYPE           SIZE        MODIFIED
--------------------------------------------------------------------------------
example.txt                   plain          1.2 KB      2025-10-15 14:30
document.pdf                  pdf            245.8 KB    2025-10-14 09:15
```

**出力項目**:
- **NAME**: ファイル名（30文字まで表示、超過時は"..."で省略）
- **TYPE**: MIMEタイプの拡張子部分
- **SIZE**: 人間可読形式（B, KB, MB, GB, TB）
- **MODIFIED**: 最終更新日時（YYYY-MM-DD HH:MM形式）

**計算量**: O(n) - nはファイル数

---

### `create <filename>`
**構文**: `create <filename>`

**機能**: 指定名のテキストファイルを作成

**引数**:
- `<filename>`: 作成するファイル名（スペース含む可）

**例**:
```
> create myfile.txt
Created: myfile.txt
ID: 1a2b3c4d5e6f7g8h9i0j

> create my document.txt
Created: my document.txt
ID: 9i8h7g6f5e4d3c2b1a0
```

**エラーケース**:
```
> create
Error: Filename required. Usage: create <filename>

> create existing.txt
Error: File 'existing.txt' already exists.
```

**技術詳細**:
- MIMEタイプ: `text/plain`
- 初期内容: 空文字列
- 作成場所: ルートディレクトリ

---

### `delete <filename>` / `rm <filename>`
**構文**: `delete <filename>` または `rm <filename>`

**機能**: 指定ファイルをゴミ箱に移動（完全削除ではない）

**引数**:
- `<filename>`: 削除するファイル名

**例**:
```
> delete myfile.txt
Deleted: myfile.txt

> rm old_document.pdf
Deleted: old_document.pdf
```

**同名ファイルが複数存在する場合**:
```
> delete duplicate.txt
Deleted: duplicate.txt
Warning: Multiple files with this name exist. Only the first one was deleted.
```

**エラーケース**:
```
> delete
Error: Filename required. Usage: delete <filename>

> delete nonexistent.txt
Error: File 'nonexistent.txt' not found.
```

**重要**: ゴミ箱から復元可能

---

### `help`
**構文**: `help`

**機能**: 利用可能なコマンドの一覧と使用例を表示

**出力内容**:
- 実装済みコマンド
- 各コマンドの簡単な説明
- 使用例
- 将来実装予定のコマンド

---

## 実装詳細

### バックエンド (Code.gs)

#### 関数: `doGet()`
**役割**: エントリーポイント。HTMLを返す

**返り値**: `HtmlOutput` オブジェクト

**セキュリティ設定**:
- `XFrameOptionsMode.ALLOWALL`: iframe埋め込み許可

---

#### 関数: `processCommand(commandLine)`
**役割**: コマンド処理のメインハンドラ

**処理フロー**:
1. 入力の正規化（trim、空白圧縮）
2. コマンドと引数に分割
3. コマンドマップによるルーティング
4. エラーハンドリング

**引数**:
- `commandLine` (string): ユーザー入力の生の文字列

**返り値**: `CommandResult` オブジェクト

**ルーティングテーブル**:
```javascript
const commandMap = {
  'list': cmdList,
  'ls': cmdList,      // エイリアス
  'create': cmdCreate,
  'delete': cmdDelete,
  'rm': cmdDelete,    // エイリアス
  'help': cmdHelp
};
```

---

#### 関数: `cmdList(args)`
**アルゴリズム**:
1. `DriveApp.getRootFolder().getFiles()` でイテレータ取得
2. 各ファイルのメタデータ収集:
   - 名前
   - MIMEタイプ
   - サイズ
   - 最終更新日時
3. テーブル形式に整形

**メモリ効率**: O(n) - n個のファイルメタデータを配列に格納

**日時フォーマット**:
```javascript
Utilities.formatDate(
  file.getLastUpdated(),
  Session.getScriptTimeZone(),
  'yyyy-MM-dd HH:mm'
)
```

---

#### 関数: `cmdCreate(args)`
**バリデーション**:
1. 引数の存在チェック
2. 同名ファイルの存在チェック

**ファイル作成**:
```javascript
DriveApp.getRootFolder().createFile(
  filename,
  '',  // 空の内容
  MimeType.PLAIN_TEXT
)
```

**拡張可能性**: 拡張子によるMIMEタイプ判定が可能
```javascript
const extension = filename.split('.').pop().toLowerCase();
const mimeTypeMap = {
  'txt': MimeType.PLAIN_TEXT,
  'html': MimeType.HTML,
  'csv': MimeType.CSV
};
```

---

#### 関数: `cmdDelete(args)`
**削除方法**: `file.setTrashed(true)` - ゴミ箱に移動

**同名ファイル処理**:
- `FileIterator`から最初の1つのみを削除
- 複数存在する場合は警告メッセージを表示

---

#### ユーティリティ関数

**`formatBytes(bytes)`**
- 対数計算による単位判定: `i = floor(log₁₀₂₄(bytes))`
- 単位配列: `['B', 'KB', 'MB', 'GB', 'TB']`

**`padRight(str, width)`**
- 文字列が`width`を超える場合: `substring(0, width-3) + '...'`
- 不足する場合: スペースで右パディング

---

### フロントエンド (index.html)

#### 状態管理
```javascript
const state = {
  commandHistory: [],    // コマンド履歴の配列
  historyIndex: -1,      // 現在の履歴位置
  isProcessing: false    // 処理中フラグ
};
```

**不変条件**:
- `0 ≤ historyIndex ≤ commandHistory.length`
- `isProcessing === true` の間は入力を無効化

---

#### イベントハンドリング

**Enterキー**: コマンド実行
```javascript
if (e.key === 'Enter') {
  e.preventDefault();
  handleCommand();
}
```

**↑キー**: 履歴を遡る
```javascript
if (e.key === 'ArrowUp') {
  e.preventDefault();
  if (state.historyIndex > 0) {
    state.historyIndex--;
    commandInput.value = state.commandHistory[state.historyIndex];
  }
}
```

**↓キー**: 履歴を進む
```javascript
if (e.key === 'ArrowDown') {
  e.preventDefault();
  if (state.historyIndex < state.commandHistory.length - 1) {
    state.historyIndex++;
    commandInput.value = state.commandHistory[state.historyIndex];
  } else {
    state.historyIndex = state.commandHistory.length;
    commandInput.value = '';
  }
}
```

---

#### 非同期通信

**成功ハンドラ**:
```javascript
google.script.run
  .withSuccessHandler((result) => {
    // ローディング表示を削除
    // 結果を表示
    // 入力をリセット
  })
  .processCommand(command);
```

**失敗ハンドラ**:
```javascript
.withFailureHandler((error) => {
  // エラーメッセージを表示
  // 入力をリセット
})
```

**タイムアウト**: GASの制限により最大6分（実際はもっと短い）

---

#### セキュリティ: XSS対策

**`escapeHtml(text)` 関数**:
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;  // textContentは自動エスケープ
  return div.innerHTML;
}
```

**原理**: `textContent`への代入はHTMLタグをエスケープする

**使用箇所**: すべてのユーザー入力と外部データ

---

#### UI更新の効率性

**DOM操作**: `appendChild` のみ使用
- リフローを最小化
- 既存要素の再計算なし

**スクロール**: `scrollTop = scrollHeight` で最下部へ
- 計算量: O(1)

---

## 拡張ガイド

### 新規コマンド追加の標準手順

#### ステップ1: コマンド関数の実装 (Code.gs)

```javascript
/**
 * 新規コマンドのテンプレート
 * @param {Array<string>} args - コマンド引数
 * @return {Object} CommandResult
 */
function cmdYourCommand(args) {
  try {
    // 1. 引数のバリデーション
    if (args.length < 必要な引数数) {
      return {
        success: false,
        output: 'Error: Usage: yourcommand <arg1> <arg2>'
      };
    }
    
    // 2. Drive API操作
    const result = DriveApp.someOperation();
    
    // 3. 成功レスポンス
    return {
      success: true,
      output: `Success message: ${result}`
    };
    
  } catch (error) {
    // 4. エラーハンドリング
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}
```

#### ステップ2: コマンドマップへの登録

```javascript
const commandMap = {
  'list': cmdList,
  'create': cmdCreate,
  'delete': cmdDelete,
  'help': cmdHelp,
  'yourcommand': cmdYourCommand,  // 追加
  'yc': cmdYourCommand            // エイリアス（任意）
};
```

#### ステップ3: ヘルプの更新

```javascript
function cmdHelp(args) {
  const helpText = `
Available Commands:
-------------------
...
yourcommand <args>    Description of your command
yc <args>             Alias for yourcommand
...
`;
  return {success: true, output: helpText};
}
```

---

### 実装例1: `pwd` コマンド（カレントディレクトリ表示）

```javascript
/**
 * pwd: カレントディレクトリを表示
 */
function cmdPwd(args) {
  try {
    const props = PropertiesService.getUserProperties();
    const currentDirId = props.getProperty('currentDir') || 'root';
    
    let path = '/';
    if (currentDirId !== 'root') {
      const folder = DriveApp.getFolderById(currentDirId);
      path = '/' + folder.getName();
    }
    
    return {
      success: true,
      output: `Current directory: ${path}\nID: ${currentDirId}`
    };
    
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}

// commandMapに追加
'pwd': cmdPwd
```

---

### 実装例2: `cd` コマンド（ディレクトリ移動）

```javascript
/**
 * cd: ディレクトリを変更
 * @param {Array<string>} args - [0]: フォルダ名 or '..' or '/'
 */
function cmdCd(args) {
  if (args.length === 0) {
    return {
      success: false,
      output: 'Error: Usage: cd <foldername> | cd .. | cd /'
    };
  }
  
  try {
    const props = PropertiesService.getUserProperties();
    const target = args[0];
    
    // ルートに移動
    if (target === '/') {
      props.setProperty('currentDir', 'root');
      return {success: true, output: 'Changed to root directory'};
    }
    
    // 親ディレクトリに移動
    if (target === '..') {
      const currentDirId = props.getProperty('currentDir') || 'root';
      if (currentDirId === 'root') {
        return {success: false, output: 'Error: Already at root'};
      }
      
      const currentFolder = DriveApp.getFolderById(currentDirId);
      const parents = currentFolder.getParents();
      
      if (parents.hasNext()) {
        const parent = parents.next();
        props.setProperty('currentDir', parent.getId());
        return {success: true, output: `Changed to: ${parent.getName()}`};
      } else {
        props.setProperty('currentDir', 'root');
        return {success: true, output: 'Changed to root directory'};
      }
    }
    
    // 指定フォルダに移動
    const currentDirId = props.getProperty('currentDir') || 'root';
    const currentFolder = currentDirId === 'root' 
      ? DriveApp.getRootFolder() 
      : DriveApp.getFolderById(currentDirId);
    
    const folders = currentFolder.getFoldersByName(target);
    
    if (!folders.hasNext()) {
      return {
        success: false,
        output: `Error: Folder '${target}' not found`
      };
    }
    
    const folder = folders.next();
    props.setProperty('currentDir', folder.getId());
    
    return {
      success: true,
      output: `Changed to: ${folder.getName()}`
    };
    
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}

// commandMapに追加
'cd': cmdCd
```

**カレントディレクトリの永続化**:
- `PropertiesService.getUserProperties()` を使用
- キー: `'currentDir'`
- 値: フォルダID（または 'root'）

---

### 実装例3: `mkdir` コマンド（フォルダ作成）

```javascript
/**
 * mkdir: 新規フォルダを作成
 */
function cmdMkdir(args) {
  if (args.length === 0) {
    return {
      success: false,
      output: 'Error: Usage: mkdir <foldername>'
    };
  }
  
  const folderName = args.join(' ');
  
  try {
    const props = PropertiesService.getUserProperties();
    const currentDirId = props.getProperty('currentDir') || 'root';
    const currentFolder = currentDirId === 'root'
      ? DriveApp.getRootFolder()
      : DriveApp.getFolderById(currentDirId);
    
    // 同名フォルダチェック
    const existing = currentFolder.getFoldersByName(folderName);
    if (existing.hasNext()) {
      return {
        success: false,
        output: `Error: Folder '${folderName}' already exists`
      };
    }
    
    const folder = currentFolder.createFolder(folderName);
    
    return {
      success: true,
      output: `Created folder: ${folderName}\nID: ${folder.getId()}`
    };
    
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}

// commandMapに追加
'mkdir': cmdMkdir
```

---

### 実装例4: `cat` コマンド（ファイル内容表示）

```javascript
/**
 * cat: ファイル内容を表示
 */
function cmdCat(args) {
  if (args.length === 0) {
    return {
      success: false,
      output: 'Error: Usage: cat <filename>'
    };
  }
  
  const filename = args.join(' ');
  
  try {
    const props = PropertiesService.getUserProperties();
    const currentDirId = props.getProperty('currentDir') || 'root';
    const currentFolder = currentDirId === 'root'
      ? DriveApp.getRootFolder()
      : DriveApp.getFolderById(currentDirId);
    
    const files = currentFolder.getFilesByName(filename);
    
    if (!files.hasNext()) {
      return {
        success: false,
        output: `Error: File '${filename}' not found`
      };
    }
    
    const file = files.next();
    const mimeType = file.getMimeType();
    
    // テキストファイルのみサポート
    if (!mimeType.startsWith('text/') && 
        mimeType !== MimeType.GOOGLE_DOCS) {
      return {
        success: false,
        output: `Error: Cannot display binary file (${mimeType})`
      };
    }
    
    let content;
    if (mimeType === MimeType.GOOGLE_DOCS) {
      content = file.getAs('text/plain').getDataAsString();
    } else {
      content = file.getBlob().getDataAsString();
    }
    
    // 内容が長すぎる場合は制限
    const maxLength = 5000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + 
                '\n\n... (truncated, ' + 
                (content.length - maxLength) + 
                ' more characters)';
    }
    
    return {
      success: true,
      output: `=== ${filename} ===\n\n${content}`
    };
    
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}

// commandMapに追加
'cat': cmdCat
```

---

### カレントディレクトリ対応への完全移行

既存の`list`, `create`, `delete`コマンドをカレントディレクトリ対応にする:

```javascript
// ヘルパー関数: 現在のフォルダを取得
function getCurrentFolder() {
  const props = PropertiesService.getUserProperties();
  const currentDirId = props.getProperty('currentDir') || 'root';
  
  return currentDirId === 'root'
    ? DriveApp.getRootFolder()
    : DriveApp.getFolderById(currentDirId);
}

// cmdListを修正
function cmdList(args) {
  try {
    const currentFolder = getCurrentFolder();  // 変更点
    const files = currentFolder.getFiles();
    // 以下同じ...
  }
}

// cmdCreateを修正
function cmdCreate(args) {
  // ...
  const currentFolder = getCurrentFolder();  // 変更点
  const file = currentFolder.createFile(filename, '', MimeType.PLAIN_TEXT);
  // ...
}

// cmdDeleteを修正
function cmdDelete(args) {
  // ...
  const currentFolder = getCurrentFolder();  // 変更点
  const files = currentFolder.getFilesByName(filename);
  // ...
}
```

---

### HTML側の拡張（プロンプト表示の動的化）

カレントディレクトリをプロンプトに表示する:

```javascript
// Code.gsに追加
function getCurrentPath() {
  const props = PropertiesService.getUserProperties();
  const currentDirId = props.getProperty('currentDir') || 'root';
  
  if (currentDirId === 'root') {
    return '~';
  }
  
  try {
    const folder = DriveApp.getFolderById(currentDirId);
    return '~/' + folder.getName();
  } catch (error) {
    return '~';
  }
}
```

```javascript
// index.htmlのhandleCommandを修正
function handleCommand() {
  const command = commandInput.value.trim();
  if (!command) return;
  
  // 現在のパスを取得してプロンプトに表示
  google.script.run
    .withSuccessHandler((path) => {
      appendOutput(`<span class="prompt">drive@${path}$</span> <span class="command">${escapeHtml(command)}</span>`);
      
      // コマンド処理を実行
      google.script.run
        .withSuccessHandler(handleSuccess)
        .withFailureHandler(handleError)
        .processCommand(command);
    })
    .getCurrentPath();
  
  commandInput.value = '';
  commandInput.disabled = true;
}
```

---

## トラブルシューティング

### 問題1: "承認が必要です"と表示される

**原因**: スクリプトがDrive APIへのアクセス権限を持っていない

**解決策**:
1. 「承認が必要です」をクリック
2. 「権限を確認」→ アカウント選択
3. 「詳細」→ 「(プロジェクト名)（安全ではないページ）に移動」
4. 「許可」をクリック

---

### 問題2: コマンドが実行されない

**チェックリスト**:
- ブラウザのJavaScriptが有効か確認
- デベロッパーツール（F12）でエラーを確認
- GASエディタの「実行ログ」を確認

**デバッグ方法**:
```javascript
// Code.gsにログ追加
function processCommand(commandLine) {
  Logger.log('Received command: ' + commandLine);
  // ...
}
```

実行後、GASエディタの「実行数」→「ログを表示」で確認

---

### 問題3: ファイルが見つからない

**原因**: 
- 異なるGoogleアカウントでログインしている
- ファイルが共有ドライブにある

**確認**:
```javascript
// 実行ユーザーを確認
function checkUser() {
  return Session.getActiveUser().getEmail();
}
```

---

### 問題4: "ReferenceError: google is not defined"

**原因**: `google.script.run`がローカル環境では動作しない

**解決策**: 必ずGASのデプロイURLからアクセスする

---

### 問題5: レスポンスが遅い

**原因**: 
- ファイル数が多い（listコマンド）
- GASの実行時間制限

**対策**:
```javascript
// listコマンドにページネーション追加
function cmdList(args) {
  const maxFiles = 100;
  let count = 0;
  
  while (files.hasNext() && count < maxFiles) {
    const file = files.next();
    fileList.push(/* ... */);
    count++;
  }
  
  if (files.hasNext()) {
    output += '\n(More files exist. Showing first ' + maxFiles + ')';
  }
  
  return {success: true, output: output};
}
```

---

### 問題6: "Service invoked too many times"

**原因**: GASの1日あたりの実行回数制限を超えた

**制限**:
- 無料アカウント: 1日あたり20,000回
- Google Workspace: 1日あたり100,000回

**対策**: 頻繁な操作を避ける、キャッシュを利用する

---

## パフォーマンス最適化

### 最適化1: ファイルリストのキャッシュ

```javascript
// CacheServiceを利用（最大6時間保持）
function cmdList(args) {
  const cache = CacheService.getUserCache();
  const cacheKey = 'fileList';
  
  // キャッシュから取得を試みる
  let cached = cache.get(cacheKey);
  if (cached && !args.includes('refresh')) {
    return {success: true, output: cached};
  }
  
  // キャッシュミス: Drive APIから取得
  const files = getCurrentFolder().getFiles();
  const fileList = [];
  
  while (files.hasNext()) {
    const file = files.next();
    fileList.push({
      name: file.getName(),
      type: file.getMimeType().split('/').pop(),
      size: formatBytes(file.getSize()),
      modified: Utilities.formatDate(file.getLastUpdated(), 
                                     Session.getScriptTimeZone(), 
                                     'yyyy-MM-dd HH:mm')
    });
  }
  
  // 出力を整形
  let output = /* 前述の整形処理 */;
  
  // キャッシュに保存（10分間）
  cache.put(cacheKey, output, 600);
  
  return {success: true, output: output};
}
```

**使用方法**:
- `list`: キャッシュから取得
- `list refresh`: 強制的に最新データを取得

---

### 最適化2: バッチ処理

複数ファイル操作を一度に処理:

```javascript
/**
 * delete-batch: 複数ファイルを一括削除
 * Usage: delete-batch file1.txt file2.txt file3.txt
 */
function cmdDeleteBatch(args) {
  if (args.length === 0) {
    return {
      success: false,
      output: 'Error: Usage: delete-batch <file1> <file2> ...'
    };
  }
  
  const currentFolder = getCurrentFolder();
  const results = [];
  
  args.forEach(filename => {
    try {
      const files = currentFolder.getFilesByName(filename);
      if (files.hasNext()) {
        files.next().setTrashed(true);
        results.push(`✓ ${filename}`);
      } else {
        results.push(`✗ ${filename} (not found)`);
      }
    } catch (error) {
      results.push(`✗ ${filename} (error: ${error.message})`);
    }
  });
  
  return {
    success: true,
    output: `Batch delete results:\n${results.join('\n')}`
  };
}
```

---

## セキュリティ考慮事項

### 認証と認可

**実行権限**:
- スクリプトは実行ユーザーの権限で動作
- アクセス可能な範囲: ユーザーがアクセスできるすべてのDriveファイル

**推奨設定**:
```
アクセスできるユーザー: 自分のみ
```

**組織内共有の場合**:
```
アクセスできるユーザー: (ドメイン)内の全員
```

---

### XSS対策の詳細

**脆弱性のある実装例**（使用禁止）:
```javascript
// ❌ 危険: HTMLインジェクション可能
terminal.innerHTML += userInput;

// ❌ 危険: スクリプトタグが実行される
appendOutput(`<div>${userInput}</div>`);
```

**安全な実装**:
```javascript
// ✓ 安全: textContentで自動エスケープ
div.textContent = userInput;

// ✓ 安全: escapeHtml関数を使用
appendOutput(escapeHtml(userInput));
```

**攻撃シナリオ例**:
```javascript
// 悪意のある入力
> create <img src=x onerror="alert('XSS')">

// escapeHtmlなしの場合 → スクリプト実行
// escapeHtmlありの場合 → "&lt;img src=x onerror="alert('XSS')"&gt;" と表示
```

---

### ファイル操作の安全性

**パストラバーサル対策**:
```javascript
// ファイル名に親ディレクトリ参照を含ませない
function sanitizeFilename(filename) {
  // '../' や '..\' を除去
  return filename.replace(/\.\.[\/\\]/g, '');
}

function cmdCreate(args) {
  const filename = sanitizeFilename(args.join(' '));
  // 以下処理...
}
```

**削除操作の確認**:
```javascript
// 本番環境では確認プロンプトを追加
function cmdDelete(args) {
  const filename = args.join(' ');
  
  // 重要ファイルの場合は追加確認
  const importantPatterns = [/\.config$/, /^\./, /important/i];
  const isImportant = importantPatterns.some(p => p.test(filename));
  
  if (isImportant) {
    return {
      success: false,
      output: `Warning: '${filename}' appears to be important. Use 'delete-force ${filename}' to confirm.`
    };
  }
  
  // 通常の削除処理
  // ...
}
```

---

## テスト戦略

### 単体テスト (Code.gs)

```javascript
/**
 * コマンド関数のテストスイート
 */
function runTests() {
  const tests = [];
  
  // Test 1: cmdHelp
  tests.push(testCmdHelp());
  
  // Test 2: cmdCreate - 正常系
  tests.push(testCmdCreateSuccess());
  
  // Test 3: cmdCreate - 引数なし
  tests.push(testCmdCreateNoArgs());
  
  // Test 4: formatBytes
  tests.push(testFormatBytes());
  
  // 結果出力
  const passed = tests.filter(t => t.passed).length;
  Logger.log(`Tests: ${passed}/${tests.length} passed`);
  
  tests.forEach(t => {
    if (!t.passed) {
      Logger.log(`FAILED: ${t.name} - ${t.error}`);
    }
  });
}

function testCmdHelp() {
  try {
    const result = cmdHelp([]);
    
    if (!result.success) {
      return {name: 'cmdHelp', passed: false, error: 'success should be true'};
    }
    
    if (!result.output.includes('Available Commands')) {
      return {name: 'cmdHelp', passed: false, error: 'output missing header'};
    }
    
    return {name: 'cmdHelp', passed: true};
  } catch (error) {
    return {name: 'cmdHelp', passed: false, error: error.message};
  }
}

function testCmdCreateNoArgs() {
  try {
    const result = cmdCreate([]);
    
    if (result.success) {
      return {name: 'cmdCreate (no args)', passed: false, error: 'should fail without args'};
    }
    
    if (!result.output.includes('Filename required')) {
      return {name: 'cmdCreate (no args)', passed: false, error: 'wrong error message'};
    }
    
    return {name: 'cmdCreate (no args)', passed: true};
  } catch (error) {
    return {name: 'cmdCreate (no args)', passed: false, error: error.message};
  }
}

function testFormatBytes() {
  try {
    const tests = [
      {input: 0, expected: '0 B'},
      {input: 1024, expected: '1.0 KB'},
      {input: 1048576, expected: '1.0 MB'},
      {input: 1536, expected: '1.5 KB'}
    ];
    
    for (const test of tests) {
      const result = formatBytes(test.input);
      if (result !== test.expected) {
        return {
          name: 'formatBytes',
          passed: false,
          error: `formatBytes(${test.input}) = ${result}, expected ${test.expected}`
        };
      }
    }
    
    return {name: 'formatBytes', passed: true};
  } catch (error) {
    return {name: 'formatBytes', passed: false, error: error.message};
  }
}
```

**実行方法**: GASエディタで`runTests`を選択して実行

---

### 統合テスト

```javascript
/**
 * エンドツーエンドテスト: ファイル作成→確認→削除
 */
function testE2E() {
  const testFilename = 'test_' + Date.now() + '.txt';
  
  try {
    // 1. ファイル作成
    const createResult = cmdCreate([testFilename]);
    if (!createResult.success) {
      throw new Error('Create failed: ' + createResult.output);
    }
    Logger.log('✓ Create succeeded');
    
    // 2. ファイル一覧で確認
    const listResult = cmdList([]);
    if (!listResult.output.includes(testFilename)) {
      throw new Error('File not found in list');
    }
    Logger.log('✓ File appears in list');
    
    // 3. ファイル削除
    const deleteResult = cmdDelete([testFilename]);
    if (!deleteResult.success) {
      throw new Error('Delete failed: ' + deleteResult.output);
    }
    Logger.log('✓ Delete succeeded');
    
    // 4. 削除確認
    const listResult2 = cmdList(['refresh']);
    if (listResult2.output.includes(testFilename)) {
      throw new Error('File still exists after delete');
    }
    Logger.log('✓ File removed from list');
    
    Logger.log('E2E Test: PASSED');
    return true;
    
  } catch (error) {
    Logger.log('E2E Test: FAILED - ' + error.message);
    
    // クリーンアップ
    try {
      cmdDelete([testFilename]);
    } catch (e) {
      // 無視
    }
    
    return false;
  }
}
```

---

## デプロイ戦略

### バージョン管理

**Apps Scriptのバージョン機能を使用**:

1. コード変更後、「デプロイ」→「デプロイを管理」
2. 「新しいバージョン」を作成
3. 説明を追加（例: "v1.1 - Added cd and pwd commands"）

**ロールバック**:
1. 「デプロイを管理」→ 対象バージョンを選択
2. 「このバージョンをデプロイ」

---

### 環境分離

**開発環境とプロダクション環境を分離**:

```javascript
// Code.gsの先頭に追加
const CONFIG = {
  environment: 'production',  // 'development' or 'production'
  debug: false
};

function log(message) {
  if (CONFIG.debug || CONFIG.environment === 'development') {
    Logger.log(message);
  }
}

// 使用例
function processCommand(commandLine) {
  log('Processing: ' + commandLine);
  // ...
}
```

**開発用デプロイ**:
1. プロジェクトを複製
2. `environment: 'development'`, `debug: true`に設定
3. 別のWebアプリとしてデプロイ

---

## 高度な機能実装例

### 機能1: ファイル検索 (`find`)

```javascript
/**
 * find: ファイル名でファイルを検索
 * Usage: find <pattern>
 */
function cmdFind(args) {
  if (args.length === 0) {
    return {
      success: false,
      output: 'Error: Usage: find <pattern>'
    };
  }
  
  const pattern = args.join(' ').toLowerCase();
  
  try {
    const currentFolder = getCurrentFolder();
    const files = currentFolder.getFiles();
    const matches = [];
    
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().toLowerCase().includes(pattern)) {
        matches.push({
          name: file.getName(),
          id: file.getId(),
          modified: Utilities.formatDate(
            file.getLastUpdated(),
            Session.getScriptTimeZone(),
            'yyyy-MM-dd HH:mm'
          )
        });
      }
    }
    
    if (matches.length === 0) {
      return {
        success: true,
        output: `No files matching '${pattern}' found.`
      };
    }
    
    let output = `Found ${matches.length} file(s) matching '${pattern}':\n\n`;
    matches.forEach(m => {
      output += `${m.name}\n  ID: ${m.id}\n  Modified: ${m.modified}\n\n`;
    });
    
    return {success: true, output: output};
    
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}

// commandMapに追加
'find': cmdFind
```

---

### 機能2: ファイル情報詳細表示 (`info`)

```javascript
/**
 * info: ファイルの詳細情報を表示
 * Usage: info <filename>
 */
function cmdInfo(args) {
  if (args.length === 0) {
    return {
      success: false,
      output: 'Error: Usage: info <filename>'
    };
  }
  
  const filename = args.join(' ');
  
  try {
    const currentFolder = getCurrentFolder();
    const files = currentFolder.getFilesByName(filename);
    
    if (!files.hasNext()) {
      return {
        success: false,
        output: `Error: File '${filename}' not found`
      };
    }
    
    const file = files.next();
    
    // 詳細情報を収集
    const info = {
      name: file.getName(),
      id: file.getId(),
      mimeType: file.getMimeType(),
      size: formatBytes(file.getSize()),
      created: Utilities.formatDate(
        file.getDateCreated(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd HH:mm:ss'
      ),
      modified: Utilities.formatDate(
        file.getLastUpdated(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd HH:mm:ss'
      ),
      owner: file.getOwner().getName(),
      url: file.getUrl(),
      downloadUrl: file.getDownloadUrl() || 'N/A'
    };
    
    // 整形して出力
    let output = `=== File Information ===\n\n`;
    output += `Name:         ${info.name}\n`;
    output += `ID:           ${info.id}\n`;
    output += `MIME Type:    ${info.mimeType}\n`;
    output += `Size:         ${info.size}\n`;
    output += `Created:      ${info.created}\n`;
    output += `Modified:     ${info.modified}\n`;
    output += `Owner:        ${info.owner}\n`;
    output += `URL:          ${info.url}\n`;
    output += `Download URL: ${info.downloadUrl}\n`;
    
    return {success: true, output: output};
    
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}

// commandMapに追加
'info': cmdInfo
```

---

### 機能3: ファイルリネーム (`mv`)

```javascript
/**
 * mv: ファイルをリネームまたは移動
 * Usage: mv <source> <destination>
 */
function cmdMv(args) {
  if (args.length < 2) {
    return {
      success: false,
      output: 'Error: Usage: mv <source> <destination>'
    };
  }
  
  const source = args[0];
  const destination = args.slice(1).join(' ');
  
  try {
    const currentFolder = getCurrentFolder();
    const files = currentFolder.getFilesByName(source);
    
    if (!files.hasNext()) {
      return {
        success: false,
        output: `Error: File '${source}' not found`
      };
    }
    
    const file = files.next();
    
    // 拡張: フォルダへの移動も可能にする
    // ここではリネームのみ実装
    file.setName(destination);
    
    return {
      success: true,
      output: `Renamed: ${source} → ${destination}`
    };
    
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error.message}`
    };
  }
}

// commandMapに追加
'mv': cmdMv,
'rename': cmdMv  // エイリアス
```

---

### 機能4: コマンド履歴表示 (`history`)

HTML側に実装:

```javascript
// index.htmlに追加
function cmdHistory() {
  if (state.commandHistory.length === 0) {
    appendOutput('<span class="result">No command history.</span>');
    return;
  }
  
  let output = `Command History (${state.commandHistory.length} commands):\n\n`;
  state.commandHistory.forEach((cmd, index) => {
    output += `${String(index + 1).padStart(4, ' ')}: ${cmd}\n`;
  });
  
  appendOutput(`<span class="result">${escapeHtml(output)}</span>`);
}

// handleCommand関数を修正してhistoryコマンドに対応
function handleCommand() {
  const command = commandInput.value.trim();
  
  if (!command) return;
  
  // ローカル処理のコマンド
  if (command === 'history') {
    appendOutput(`<span class="prompt">drive@root:~$</span> <span class="command">${escapeHtml(command)}</span>`);
    state.commandHistory.push(command);
    state.historyIndex = state.commandHistory.length;
    commandInput.value = '';
    cmdHistory();
    return;
  }
  
  if (command === 'clear') {
    terminal.innerHTML = '';
    state.commandHistory.push(command);
    state.historyIndex = state.commandHistory.length;
    commandInput.value = '';
    return;
  }
  
  // 通常のGAS処理
  // ...既存のコード
}
```

---

## API制限と対策

### Drive API クォータ

**制限値**:
- 読み取り: 1ユーザーあたり1000リクエスト/100秒
- 書き込み: 1ユーザーあたり300リクエスト/100秒

**対策**:
1. **バッチ処理**: 複数操作をまとめる
2. **キャッシュ**: 頻繁にアクセスされるデータをキャッシュ
3. **レート制限**: 連続実行を制限

```javascript
// レート制限の実装例
const RATE_LIMIT = {
  maxRequests: 10,
  timeWindow: 60000  // 60秒
};

function checkRateLimit() {
  const props = PropertiesService.getUserProperties();
  const key = 'rateLimit_' + new Date().getMinutes();
  const count = parseInt(props.getProperty(key) || '0');
  
  if (count >= RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      message: 'Rate limit exceeded. Please wait.'
    };
  }
  
  props.setProperty(key, String(count + 1));
  return {allowed: true};
}

function processCommand(commandLine) {
  // レート制限チェック
  const rateLimitCheck = checkRateLimit();
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      output: rateLimitCheck.message
    };
  }
  
  // 通常の処理
  // ...
}
```

---

## まとめ

### プロジェクトの特徴

1. **モジュラー設計**: 各コマンドが独立した関数
2. **型安全性**: すべてのコマンドが同じインターフェース
3. **拡張性**: 新規コマンド追加が容易
4. **セキュリティ**: XSS対策、入力バリデーション
5. **パフォーマンス**: キャッシュ、バッチ処理

### 推奨される次のステップ

1. `cd`, `pwd`, `mkdir`コマンドを実装
2. カレントディレクトリの永続化
3. ファイル検索機能の追加
4. エラーログの保存
5. コマンド補完機能の実装

### 参考リソース

- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [DriveApp Class Reference](https://developers.google.com/apps-script/reference/drive/drive-app)
- [HTML Service Guide](https://developers.google.com/apps-script/guides/html)

---

**ドキュメントバージョン**: 1.0  
**最終更新**: 2025-10-17  
**対象GASバージョン**: V8 Runtime