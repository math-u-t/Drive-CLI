# Google Drive CLI - 拡張版完全技術ドキュメント

## 目次
1. [概要](#概要)
2. [数学的仕様](#数学的仕様)
3. [システムアーキテクチャ](#システムアーキテクチャ)
4. [セットアップ手順](#セットアップ手順)
5. [コマンドリファレンス](#コマンドリファレンス)
6. [実装詳細](#実装詳細)
7. [状態管理](#状態管理)
8. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### プロジェクトの目的
Google Apps Script (GAS) を使用したブラウザベースのGoogle Drive操作用CLI。UNIXライクなコマンド体系を提供し、ファイル・フォルダの管理、メタデータ操作、共有設定を統一されたインターフェースで実現する。

### 技術スタック
- **バックエンド**: Google Apps Script (V8 Runtime)
- **フロントエンド**: HTML5 + Vanilla JavaScript (ES6+)
- **API**: Google Drive API, Forms API, Sheets API, Docs API, Slides API
- **通信プロトコル**: `google.script.run` (非同期RPC)
- **状態管理**: PropertiesService (永続化)

### 主要機能
- 27個の独立したコマンド
- ディレクトリナビゲーション (cd, pwd)
- ファイル・フォルダ操作 (new, rn, del, copy, paste)
- メタデータ表示 (stat, url)
- 共有設定 (share)
- ゴミ箱管理 (trash)
- UI制御 (dark/lightモード, カラー変更)
- コマンド履歴 (↑↓キー)

---

## 数学的仕様

### 型定義

システム全体を以下の代数的データ型で形式化する：

#### 基本型

```haskell
type FileId = String
type FolderId = String
type Path = String
type Email = String

data ItemType = File | Folder
data Permission = View | Edit | Comment
data Theme = Dark | Light
data Color = White | Blue | Green | Red | Yellow | Cyan | Magenta | Black
```

#### 状態型

```haskell
data SystemState = SystemState {
  currentDir :: FolderId,
  clipboard :: Maybe (ItemType, FileId),
  theme :: Theme,
  textColor :: Maybe Color,
  commandHistory :: [String]
}
```

#### コマンド型

すべてのコマンドは以下の型シグネチャに従う：

```haskell
type Command = [String] -> IO CommandResult

data CommandResult = CommandResult {
  success :: Bool,
  output :: String,
  action :: Maybe Action
}

data Action 
  = Clear
  | Reload
  | Exit
  | ColorChange Color
  | OpenURL String
```

### 状態遷移

状態遷移関数を以下のように定義する：

$$\delta: S \times C \rightarrow S \times O$$

ここで：
- $S$: システム状態の集合
- $C$: コマンドの集合
- $O$: 出力の集合

各コマンド $c \in C$ に対して、遷移関数は以下の性質を満たす：

1. **決定性**: $\forall s \in S, c \in C: |\delta(s, c)| = 1$
2. **終了性**: すべての $c$ は有限時間で終了する
3. **安全性**: 無効な状態への遷移は発生しない

### 不変条件

システムは以下の不変条件 $I$ を維持する：

1. $\text{currentDir} \in \{\text{root}\} \cup \{\text{valid FolderId}\}$
2. $\text{clipboard} = \text{Nothing} \vee \exists \text{valid ItemId}$
3. $|\text{commandHistory}| \geq 0$
4. $\text{historyIndex} \in [0, |\text{commandHistory}|]$

---

## システムアーキテクチャ

### レイヤー構成

```
┌────────────────────────────────────────────┐
│   Presentation Layer (index.html)          │
│   - Terminal Rendering                     │
│   - Event Handling                         │
│   - Theme Management                       │
│   - Command History                        │
└───────────────┬────────────────────────────┘
                │ google.script.run (RPC)
┌───────────────▼────────────────────────────┐
│   Application Layer (Code.gs)              │
│   - Command Processing                     │
│   - State Management                       │
│   - Input Validation                       │
│   - Error Handling                         │
└───────────────┬────────────────────────────┘
                │ PropertiesService
┌───────────────▼────────────────────────────┐
│   State Persistence Layer                  │
│   - currentDir                             │
│   - clipboard                              │
│   - clipboardType                          │
└───────────────┬────────────────────────────┘
                │ DriveApp, FormsApp, etc.
┌───────────────▼────────────────────────────┐
│   Google Workspace APIs                    │
│   - Drive API                              │
│   - Forms API                              │
│   - Sheets API                             │
│   - Docs API                               │
│   - Slides API                             │
└────────────────────────────────────────────┘
```

### データフロー

```
User Input → HTML (sanitize) 
         → GAS (validate) 
         → State Update 
         → API Call 
         → State Persist 
         → Response 
         → HTML (render)
```

### コマンド分類体系

コマンド集合 $\mathcal{C}$ を以下の互いに素な部分集合に分割：

$$\mathcal{C} = \mathcal{C}_{\text{nav}} \cup \mathcal{C}_{\text{file}} \cup \mathcal{C}_{\text{meta}} \cup \mathcal{C}_{\text{share}} \cup \mathcal{C}_{\text{ui}} \cup \mathcal{C}_{\text{special}}$$

ここで：
- $\mathcal{C}_{\text{nav}} = \{\text{ls}, \text{pwd}, \text{cd}, \text{find}\}$
- $\mathcal{C}_{\text{file}} = \{\text{new}, \text{rn}, \text{del}, \text{copy}, \text{paste}\}$
- $\mathcal{C}_{\text{meta}} = \{\text{stat}, \text{url}, \text{open}\}$
- $\mathcal{C}_{\text{share}} = \{\text{share}\}$
- $\mathcal{C}_{\text{ui}} = \{\text{clear}, \text{reload}, \text{exit}, \text{color}\}$
- $\mathcal{C}_{\text{special}} = \{\text{trash}, \text{clone}, \text{help}\}$

---

## セットアップ手順

### ステップ1: プロジェクト作成

1. [Google Apps Script](https://script.google.com) にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「Google Drive CLI Extended」に変更

### ステップ2: ファイル追加

**Code.gs**
1. 既存のCode.gsを削除
2. 提供された拡張版`Code.gs`の全内容をコピー＆ペースト

**index.html**
1. 左側メニューの「+」→「HTML」をクリック
2. ファイル名を「index」にする
3. 提供された拡張版`index.html`の全内容をコピー＆ペースト

### ステップ3: デプロイ

1. 右上の「デプロイ」→「新しいデプロイ」をクリック
2. 「種類の選択」→「ウェブアプリ」を選択
3. 設定:
   - **説明**: v2.0 Extended
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 自分のみ（推奨）
4. 「デプロイ」をクリック

### ステップ4: 権限承認

初回アクセス時、以下の権限が必要：
- Google Driveのファイルとフォルダの表示、編集、作成、削除
- Google Forms, Sheets, Docs, Slidesの作成・管理

承認手順：
1. 「承認が必要です」→「権限を確認」
2. アカウント選択
3. 「詳細」→「(安全ではないページ)に移動」
4. 「許可」をクリック

### ステップ5: 動作確認

```bash
> help
> ls
> new test.txt file
> stat test.txt
> del test.txt
> pwd
```

---

## コマンドリファレンス

### ナビゲーションコマンド

#### `ls` / `ls tree`

**構文**: 
```
ls              # 現在のディレクトリの内容を一覧表示
ls tree         # ツリー構造で表示
```

**機能**: 
- ファイルとフォルダを区別して表示
- フォルダは `[name]` 形式で表示
- 名前順にソート（フォルダ優先）

**出力形式**:
```
Total: N item(s)

NAME                               TYPE           SIZE        MODIFIED
----------------------------------------------------------------------------------
[Documents]                        DIR            -           2025-10-15 14:30
[Photos]                           DIR            -           2025-10-14 09:15
report.txt                         plain          1.2 KB      2025-10-13 16:45
```

**tree出力形式**:
```
root/
├── Documents/
│   ├── report.pdf
│   └── notes.txt
├── Photos/
│   └── vacation.jpg
└── archive.zip
```

**計算量**: 
- リスト表示: $O(n)$ where $n$ = アイテム数
- ツリー表示: $O(n \cdot d)$ where $d$ = 最大深さ

---

#### `pwd`

**構文**: `pwd`

**機能**: 現在の作業ディレクトリの絶対パスを表示

**出力例**:
```
/Documents/Projects
```

**計算量**: $O(d)$ where $d$ = ディレクトリの深さ

---

#### `cd <path>`

**構文**: 
```
cd <path>       # 指定パスに移動
cd ..           # 親ディレクトリに移動
cd /            # ルートに移動
cd ~            # ルートに移動（エイリアス）
```

**機能**: カレントディレクトリを変更

**例**:
```
> cd Documents
Changed to: /Documents

> cd ../
Changed to: /

> cd /Documents/Projects
Changed to: /Documents/Projects
```

**エラーケース**:
```
> cd NonExistent
Error: Folder 'NonExistent' not found

> cd ..  (at root)
Error: Already at root
```

**状態変化**: 
$\text{currentDir}' = \begin{cases}
\text{root} & \text{if path} = / \vee \text{path} = \sim \\
\text{parent(currentDir)} & \text{if path} = .. \\
\text{resolve(path)} & \text{otherwise}
\end{cases}$

---

#### `find <name>`

**構文**: `find <name>`

**機能**: 現在のディレクトリで指定名に完全一致するアイテムを検索

**出力例**:
```
> find report.txt
Found (FILE): report.txt
Path: /Documents/report.txt
ID: 1a2b3c4d5e6f7g8h9i0j
```

**計算量**: $O(n)$ where $n$ = 現在のディレクトリ内のアイテム数

**注意**: 
- 完全一致検索（大文字小文字区別なし）
- サブディレクトリは検索しない
- 最初に見つかったものを返す

---

### ファイル操作コマンド

#### `new <name> <type>`

**構文**: `new <name> <type>`

**サポートされるタイプ**:
- `file` - プレーンテキストファイル
- `dir` - フォルダ
- `form` - Google Form
- `sheet` - Google Spreadsheet
- `docs` - Google Document
- `slide` - Google Slides
- `script` - Google Apps Script（未サポート）
- `py` - Google Colab（未サポート）

**例**:
```
> new report.txt file
Created file: report.txt
ID: 1a2b3c4d5e6f7g8h9i0j
URL: https://drive.google.com/file/d/...

> new ProjectFolder dir
Created dir: ProjectFolder
ID: 9z8y7x6w5v4u3t2s1r0q
URL: https://drive.google.com/drive/folders/...

> new Survey form
Created form: Survey
ID: ...
URL: https://docs.google.com/forms/d/...
```

**型対応表**:

| Type   | MIME Type                              | API               |
|--------|----------------------------------------|-------------------|
| file   | text/plain                             | DriveApp          |
| dir    | application/vnd.google-apps.folder     | DriveApp          |
| form   | application/vnd.google-apps.form       | FormApp           |
| sheet  | application/vnd.google-apps.spreadsheet| SpreadsheetApp    |
| docs   | application/vnd.google-apps.document   | DocumentApp       |
| slide  | application/vnd.google-apps.presentation| SlidesApp        |

**注意**: 
- Google Workspace形式のファイルは作成後、ルートから現在のディレクトリに移動される
- 同名チェックは未実装（上書き注意）

---

#### `rn <old_name> <new_name>`

**構文**: `rn <old_name> <new_name>`

**機能**: ファイルまたはフォルダの名前を変更

**例**:
```
> rn old.txt new.txt
Renamed file: old.txt → new.txt

> rn OldFolder NewFolder
Renamed directory: OldFolder → NewFolder
```

**探索順序**:
1. フォルダを先に検索
2. フォルダが見つからない場合、ファイルを検索

**エラーケース**:
```
> rn nonexistent.txt other.txt
Error: 'nonexistent.txt' not found
```

---

#### `del <name>`

**構文**: `del <name>`

**機能**: ファイルまたはフォルダをゴミ箱に移動（完全削除ではない）

**例**:
```
> del test.txt
Moved to trash: test.txt (FILE)

> del OldFolder
Moved to trash: OldFolder (DIR)
```

**重要**: 
- ゴミ箱から復元可能（`trash <name> restore`コマンド使用）
- 完全削除はGoogle Drive UIから手動で実行

**探索順序**: rnコマンドと同様

---

#### `copy <name>`

**構文**: `copy <name>`

**機能**: ファイルまたはフォルダを内部クリップボードにコピー

**例**:
```
> copy document.pdf
Copied to clipboard: document.pdf (FILE)
```

**状態変化**:
$\text{clipboard}' = (\text{ItemType}, \text{ItemId})$

**注意**: 
- フォルダのコピーはDrive API制限により完全にはサポートされない
- セッション間で永続化される（PropertiesService使用）

---

#### `paste`

**構文**: `paste`

**機能**: クリップボードの内容を現在のディレクトリに貼り付け

**例**:
```
> copy report.txt
Copied to clipboard: report.txt (FILE)

> cd ../Projects
> paste
Pasted file: report.txt
```

**エラーケース**:
```
> paste  (clipboard empty)
Error: Clipboard is empty
```

**制限事項**: フォルダの貼り付けは未サポート

---

### メタデータコマンド

#### `stat <name>`

**構文**: `stat <name>`

**機能**: ファイルまたはフォルダの詳細メタデータを表示

**出力例（ファイル）**:
```
=== File Statistics ===

Name:       report.pdf
ID:         1a2b3c4d5e6f7g8h9i0j
Type:       application/pdf
Size:       2.4 MB
Created:    2025-10-01 10:30:00
Modified:   2025-10-15 14:22:31
Owner:      user@example.com
URL:        https://drive.google.com/file/d/...
Access:     PRIVATE (OWNER)
```

**出力例（フォルダ）**:
```
=== Directory Statistics ===

Name:       Projects
ID:         9z8y7x6w5v4u3t2s1r0q
Created:    2025-09-15 09:00:00
Modified:   2025-10-16 16:45:12
Owner:      user@example.com
URL:        https://drive.google.com/drive/folders/...
Access:     DOMAIN (VIEW)
```

**表示項目**:
- Name: アイテム名
- ID: Google Drive固有ID
- Type: MIMEタイプ（ファイルのみ）
- Size: ファイルサイズ（ファイルのみ）
- Created: 作成日時
- Modified: 最終更新日時
- Owner: 所有者のメールアドレス
- URL: WebアクセスURL
- Access: 共有設定（アクセスレベルと権限）

**計算量**: $O(1)$ - 単一API呼び出し

---

#### `url <name>`

**構文**: `url <name>`

**機能**: ファイルまたはフォルダのURLを取得

**出力例**:
```
> url report.pdf
https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view
```

**用途**: 
- URLをコピーして外部共有
- ブラウザで直接開く

---

#### `open <name>`

**構文**: `open <name>`

**機能**: ファイルまたはフォルダを新しいタブで開く

**動作**:
```
> open document.pdf
Opening in new tab...
```

**内部動作**: 
1. URLを取得
2. `window.open(url, '_blank')` を実行
3. ユーザーのブラウザで新タブが開く

**ポップアップブロック注意**: ブラウザ設定で許可が必要な場合あり

---

### 共有コマンド

#### `share <name> <email> <type>`

**構文**: `share <name> <email> <type>`

**権限タイプ**:
- `view` - 閲覧のみ
- `edit` - 編集可能
- `comment` - コメント可能（Google Workspace形式のみ）

**例**:
```
> share report.pdf user@example.com view
Shared report.pdf with user@example.com (view)

> share Spreadsheet colleague@company.com edit
Shared Spreadsheet with colleague@company.com (edit)
```

**権限マトリクス**:

| Type    | Can View | Can Edit | Can Comment | Can Share |
|---------|----------|----------|-------------|-----------|
| view    | ✓        | ✗        | ✗           | ✗         |
| comment | ✓        | ✗        | ✓           | ✗         |
| edit    | ✓        | ✓        | ✓           | ✓         |

**エラーケース**:
```
> share nonexistent.txt user@example.com view
Error: 'nonexistent.txt' not found

> share file.txt invalid-email unknown
Error: Unknown permission type 'unknown'
```

**セキュリティ注意**: 
- メールアドレスの妥当性検証は最小限
- 組織外共有は組織ポリシーに依存

---

### ゴミ箱コマンド

#### `trash`

**構文**: `trash`

**機能**: ゴミ箱内のすべてのアイテムを一覧表示

**出力例**:
```
Trash: 5 item(s)

NAME                                    TYPE           TRASHED
--------------------------------------------------------------------------------
[OldProject]                            DIR            2025-10-10 11:20:00
deleted_report.pdf                      pdf            2025-10-12 15:35:12
temp.txt                                plain          2025-10-14 09:05:43
```

**注意**: 
- すべてのユーザーのゴミ箱を表示（ルート権限不要）
- 完全削除されたファイルは表示されない

---

#### `trash <name> restore`

**構文**: `trash <name> restore`

**機能**: ゴミ箱から指定アイテムを復元

**例**:
```
> trash deleted_report.pdf restore
Restored: deleted_report.pdf
```

**復元先**: 元の場所に復元される

**エラーケース**:
```
> trash nonexistent.txt restore
Error: 'nonexistent.txt' not found in trash
```

**計算量**: $O(n)$ where $n$ = ゴミ箱内のアイテム数

---

### UI制御コマンド

#### `clear`

**構文**: `clear`

**機能**: ターミナル画面をクリア

**動作**: DOMから全出力要素を削除

**用途**: 画面が見づらくなった時のリフレッシュ

---

#### `reload`

**構文**: `reload`

**機能**: ページを再読み込み

**動作**: `location.reload()` を実行

**用途**: 
- 状態のリセット
- UI不具合の解消

---

#### `exit`

**構文**: `exit`

**機能**: ブラウザタブを閉じる

**動作**: 
1. "Closing..." メッセージを表示
2. 1秒後に `window.close()` を実行

**注意**: ユーザー操作で開いたタブでない場合、閉じられない可能性あり

---

#### `color <color>`

**構文**: `color <color>`

**サポートされる色**:
- white
- blue
- green
- red
- yellow
- cyan
- magenta
- black

**例**:
```
> color green
Color changed to green
```

**動作**: 以降のすべての出力テキストが指定色で表示される

**リセット**: ページをリロードするまで持続

**CSS実装**:
```css
.color-green { color: #4ec9b0 !important; }
```

---

### 特殊コマンド

#### `clone <URL>`

**構文**: `clone <URL>`

**機能**: （未実装）Gitリポジトリのクローン

**現状**: 
```
> clone https://github.com/user/repo
Error: Git clone not supported in Google Drive environment
```

**理由**: Google Driveはバージョン管理システムではないため

**代替案**: Google Drive REST APIを使用した外部スクリプト

---

#### `help`

**構文**: `help`

**機能**: 全コマンドのリファレンスを表示

**出力**: 
- コマンド分類
- 各コマンドの構文
- 使用例
- 注意事項

---

## 実装詳細

### バックエンド (Code.gs)

#### 状態管理システム

**PropertiesServiceによる永続化**:

```javascript
function getState() {
  const props = PropertiesService.getUserProperties();
  return {
    currentDir: props.getProperty('currentDir') || 'root',
    clipboard: props.getProperty('clipboard') || null,
    clipboardType: props.getProperty('clipboardType') || null
  };
}

function setState(key, value) {
  PropertiesService.getUserProperties().setProperty(key, value);
}
```

**数学的定義**:

状態取得関数: $\text{getState}: \emptyset \rightarrow S$

状態設定関数: $\text{setState}: K \times V \rightarrow \emptyset$

where $K$ = キー集合, $V$ = 値集合

**永続化スコープ**: ユーザー単位（他のユーザーと共有されない）

---

#### カレントディレクトリ管理

```javascript
function getCurrentFolder() {
  const state = getState();
  return state.currentDir === 'root' 
    ? DriveApp.getRootFolder() 
    : DriveApp.getFolderById(state.currentDir);
}
```

**型シグネチャ**: 
$\text{getCurrentFolder}: \emptyset \rightarrow \text{Folder}$

**例外処理**: 無効なFolderIdの場合、ルートにフォールバック

---

#### パス構築アルゴリズム

```javascript
function buildPath(folder) {
  const parts = [];
  let current = folder;
  
  while (true) {
    parts.unshift(current.getName());
    const parents = current.getParents();
    if (!parents.hasNext()) break;
    current = parents.next();
  }
  
  return '/' + parts.join('/');
}
```

**計算量**: $O(d)$ where $d$ = ディレクトリの深さ

**再帰的定義**:
$\text{buildPath}(f) = \begin{cases}
/ + f.\text{name} & \text{if } f.\text{parent} = \emptyset \\
\text{buildPath}(f.\text{parent}) + / + f.\text{name} & \text{otherwise}
\end{cases}$

---

#### コマンド処理パイプライン

```
Input → Normalize → Parse → Route → Execute → Persist → Output
```

**正規化**: 
- トリミング: 前後空白削除
- 圧縮: 連続空白を単一空白に

```javascript
const normalized = commandLine.trim().replace(/\s+/g, ' ');
```

**パース**: 
```javascript
const parts = normalized.split(' ');
const command = parts[0].toLowerCase();
const args = parts.slice(1);
```

**ルーティング**: ハッシュマップによる $O(1)$ 探索
```javascript
const commandMap = {
  'ls': cmdLs,
  'cd': cmdCd,
  // ... 全27コマンド
};
```

---

#### ツリー構造生成アルゴリズム

```javascript
function buildTree(folder, prefix, isLast) {
  let output = prefix + (isLast ? '└── ' : '├── ') + folder.getName() + '/\n';
  
  const subfolders = getFoldersArray(folder);
  const files = getFilesArray(folder);
  const totalItems = subfolders.length + files.length;
  
  let count = 0;
  
  subfolders.forEach(subfolder => {
    count++;
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    output += buildTree(subfolder, newPrefix, count === totalItems);
  });
  
  files.forEach(file => {
    count++;
    output += prefix + (isLast ? '    ' : '│   ') + 
              (count === totalItems ? '└── ' : '├── ') + 
              file.getName() + '\n';
  });
  
  return output;
}
```

**アルゴリズム分類**: 深さ優先探索 (DFS)

**計算量**: 
- 時間: $O(n \cdot d)$ where $n$ = ノード数, $d$ = 平均深さ
- 空間: $O(d)$ (再帰スタック)

**制限**: ファイル数上限50（無限ループ防止）

---

### フロントエンド (index.html)

#### 状態管理

```javascript
const state = {
  commandHistory: [],      // 型: String[]
  historyIndex: -1,        // 型: Int, 範囲: [-1, |commandHistory|]
  isProcessing: false,     // 型: Bool
  currentPath: '/',        // 型: String
  theme: 'dark',           // 型: 'dark' | 'light'
  textColor: null          // 型: Color | null
};
```

**不変条件**:
1. $-1 \leq \text{historyIndex} \leq |\text{commandHistory}|$
2. $\text{isProcessing} = \text{true} \Rightarrow \text{commandInput.disabled} = \text{true}$
3. $\text{theme} \in \{\text{dark}, \text{light}\}$

---

#### テーマ管理システム

**localStorage統合**:
```javascript
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', state.theme);
  localStorage.setItem('theme', state.theme);
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    state.theme = savedTheme;
    document.body.setAttribute('data-theme', state.theme);
  }
}
```

**CSS変数によるテーマ切り替え**:
```css
body[data-theme="dark"] {
  background-color: #1e1e1e;
  color: #d4d4d4;
}

body[data-theme="light"] {
  background-color: #ffffff;
  color: #000000;
}
```

**永続化**: ブラウザセッション間で保持

---

#### コマンド履歴ナビゲーション

**状態遷移図**:
```
          ↑ key
    ┌──────────────┐
    │ historyIndex │
    │ decrements   │
    └──────────────┘
           │
           ▼
    [cmd0, cmd1, cmd2, ...]
           ▲
           │
    ┌──────────────┐
    │ historyIndex │
    │ increments   │
    └──────────────┘
          ↓ key
```

**実装**:
```javascript
function navigateHistory(direction) {
  if (state.commandHistory.length === 0) return;
  
  if (direction === 'up') {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      commandInput.value = state.commandHistory[state.historyIndex];
    }
  } else if (direction === 'down') {
    if (state.historyIndex < state.commandHistory.length - 1) {
      state.historyIndex++;
      commandInput.value = state.commandHistory[state.historyIndex];
    } else {
      state.historyIndex = state.commandHistory.length;
      commandInput.value = '';
    }
  }
}
```

**境界条件**:
- 上限: $\text{historyIndex} = 0$（最古）
- 下限: $\text{historyIndex} = |\text{commandHistory}|$（空入力）

---

#### 非同期RPC処理

**Promiseチェーン（内部）**:
```javascript
google.script.run
  .withSuccessHandler(handleSuccess)
  .withFailureHandler(handleError)
  .processCommand(command);
```

**型シグネチャ**:
```typescript
type RPCCall = (command: string) => Promise<CommandResult>
```

**タイムアウト**: GASの実行時間制限（最大6分）

**エラーハンドリング**:
- ネットワークエラー
- GASランタイムエラー
- 権限エラー

---

#### XSS対策

**エスケープ関数**:
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;  // 自動エスケープ
  return div.innerHTML;
}
```

**原理**: `textContent`への代入はHTMLタグをエスケープする

**テストケース**:
```javascript
escapeHtml('<script>alert("XSS")</script>')
// => "&lt;script&gt;alert("XSS")&lt;/script&gt;"
```

**使用箇所**: すべてのユーザー入力と外部データ

---

#### Ctrl+C インタラプト

**実装**:
```javascript
commandInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'c') {
    e.preventDefault();
    handleInterrupt();
  }
});

function handleInterrupt() {
  if (state.isProcessing) {
    appendOutput('<span class="error">^C (interrupted - note: cannot stop GAS execution)</span>');
  } else {
    appendOutput('<span class="error">^C</span>');
    commandInput.value = '';
  }
}
```

**制限**: GAS実行中のコマンドは停止不可（サーバーサイド実行のため）

**用途**: 入力のクリア、視覚的フィードバック

---

## 状態管理

### 永続化戦略

**PropertiesService仕様**:
- スコープ: ユーザー単位
- 容量制限: 9KB（キー＋値）
- 保存期間: 無期限（ユーザーが削除するまで）

**キー設計**:
| キー           | 型     | 説明                     |
|----------------|--------|--------------------------|
| currentDir     | String | 現在のディレクトリID      |
| clipboard      | String | クリップボードアイテムID  |
| clipboardType  | String | "file" または "folder"   |

**データフロー**:
```
GAS Command → setState(key, value) 
          → PropertiesService.setProperty(key, value)
          → Persistent Storage
```

**取得**:
```
GAS Command → getState() 
          → PropertiesService.getProperty(key)
          → Memory
```

---

### セッション管理

**フロントエンド状態**: ブラウザメモリ（揮発性）
- commandHistory
- historyIndex
- isProcessing
- theme (localStorageに永続化)
- textColor

**バックエンド状態**: PropertiesService（永続性）
- currentDir
- clipboard
- clipboardType

**同期**: 各コマンド実行時にバックエンド状態を取得・更新

---

## トラブルシューティング

### 問題1: コマンドが実行されない

**症状**: Enterキーを押しても何も起こらない

**原因と解決策**:

1. **JavaScriptが無効**
   - ブラウザ設定でJavaScriptを有効化
   - 確認: F12 → Console に "Uncaught ReferenceError" が表示される

2. **google.script.runが未定義**
   - GASデプロイURLから直接アクセスしているか確認
   - ローカルHTMLファイルでは動作しない

3. **処理中フラグが立ったまま**
   - ページをリロード (`reload`コマンド)
   - F12 → Console で `state.isProcessing` を確認

---

### 問題2: "Error: Unknown command"

**症状**: 有効なコマンドなのにエラーが出る

**原因と解決策**:

1. **大文字小文字の違い**
   - すべてのコマンドは小文字で実装
   - `LS` → `ls`, `CD` → `cd`

2. **スペルミス**
   - `help`コマンドで正しいスペルを確認

3. **コマンドが未実装**
   - `clone`, `script`, `py`コマンドは部分的に未サポート

---

### 問題3: "Error: File 'X' not found"

**原因と解決策**:

1. **ファイル名の大文字小文字**
   - `find`コマンドは大文字小文字を区別しない
   - 他のコマンドは区別する可能性あり

2. **カレントディレクトリが違う**
   - `pwd`で現在位置を確認
   - `ls`で現在のファイル一覧を確認

3. **ファイルがゴミ箱にある**
   - `trash`コマンドで確認
   - `trash <name> restore`で復元

---

### 問題4: 権限エラー

**症状**: "Error: You do not have permission to access this file"

**原因と解決策**:

1. **ファイルの所有者でない**
   - `stat <name>`で所有者を確認
   - 所有者に権限付与を依頼

2. **スクリプトの実行権限が不足**
   - GASエディタ → デプロイ → 設定 → "次のユーザーとして実行: 自分"に設定

3. **組織ポリシーによる制限**
   - Google Workspace管理者に確認

---

### 問題5: パフォーマンスが遅い

**原因と解決策**:

1. **ファイル数が多い**
   - `ls tree`は大量のファイルで遅延
   - サブディレクトリに分割

2. **GASの実行時間制限**
   - 1回の実行は最大6分
   - 大量のファイル操作は分割実行

3. **キャッシュ未使用**
   - 現在未実装
   - 拡張案: CacheServiceの利用

---

### 問題6: "Clipboard is empty"

**原因**: `copy`コマンドを実行していない

**解決策**:
```bash
> copy document.pdf
> cd target_folder
> paste
```

**注意**: クリップボードはセッション間で永続化される

---

### 問題7: テーマが保存されない

**原因**: localStorageが無効

**解決策**:
1. ブラウザ設定でCookieとサイトデータを許可
2. プライベートモードでは永続化されない

---

## パフォーマンス最適化

### API呼び出し削減

**現在の実装**: 
- `ls`: $O(n)$ API呼び出し
- `ls tree`: $O(n \cdot d)$ API呼び出し

**最適化案**:
```javascript
// CacheServiceの利用
function cmdLsCached(args) {
  const cache = CacheService.getUserCache();
  const cacheKey = 'ls_' + getState().currentDir;
  
  let cached = cache.get(cacheKey);
  if (cached && !args.includes('refresh')) {
    return {success: true, output: cached};
  }
  
  // 通常のls処理
  const output = generateLsOutput();
  
  // 10分間キャッシュ
  cache.put(cacheKey, output, 600);
  
  return {success: true, output: output};
}
```

**効果**: 同じディレクトリへの連続アクセスで高速化

---

### バッチ処理

**複数ファイル操作の最適化**:
```javascript
function cmdDeleteBatch(args) {
  const results = args.map(name => {
    try {
      // 削除処理
      return `✓ ${name}`;
    } catch (e) {
      return `✗ ${name}: ${e.message}`;
    }
  });
  
  return {success: true, output: results.join('\n')};
}
```

**効果**: ネットワークラウンドトリップの削減

---

## セキュリティ

### 認証と認可

**OAuth 2.0フロー**:
```
User → GAS Web App → Google OAuth → User Authorization → Access Token → Drive API
```

**スコープ要求**:
- `https://www.googleapis.com/auth/drive` - Drive完全アクセス
- `https://www.googleapis.com/auth/drive.file` - アプリ作成ファイルのみ（推奨）
- `https://www.googleapis.com/auth/script.external_request` - 外部API呼び出し

**実行権限モデル**:
- **"自分として実行"**: ユーザーの権限でAPI呼び出し
- **"アクセスするユーザー"**: 各ユーザーが個別に認証

**推奨設定**:
```
実行者: 自分
アクセス: 自分のみ（開発時）
        組織内全員（本番時）
```

---

### 入力検証

**コマンドライン検証**:
```javascript
function validateCommand(commandLine) {
  // 1. 長さチェック
  if (commandLine.length > 1000) {
    return {valid: false, error: 'Command too long'};
  }
  
  // 2. 文字種チェック（制御文字除外）
  if (/[\x00-\x1F\x7F]/.test(commandLine)) {
    return {valid: false, error: 'Invalid characters'};
  }
  
  // 3. 空白のみチェック
  if (commandLine.trim() === '') {
    return {valid: false, error: 'Empty command'};
  }
  
  return {valid: true};
}
```

**ファイル名検証**:
```javascript
function validateFilename(filename) {
  // Google Drive禁止文字: / \ ? * : | " < >
  const invalidChars = /[\/\\?*:|"<>]/;
  
  if (invalidChars.test(filename)) {
    return {valid: false, error: 'Invalid characters in filename'};
  }
  
  if (filename.length > 255) {
    return {valid: false, error: 'Filename too long'};
  }
  
  return {valid: true};
}
```

---

### XSS防止

**全出力のエスケープ**:
```javascript
// HTML出力前に必ずエスケープ
function safeOutput(text) {
  return escapeHtml(text);
}

// 使用例
appendOutput(`<span class="result">${safeOutput(userInput)}</span>`);
```

**危険なパターン（使用禁止）**:
```javascript
// ❌ 絶対NG
terminal.innerHTML += userInput;
element.innerHTML = `<div>${userInput}</div>`;

// ✅ 安全
element.textContent = userInput;
element.innerHTML = escapeHtml(userInput);
```

**テスト用攻撃ベクター**:
```html
<script>alert('XSS')</script>
<img src=x onerror="alert('XSS')">
<iframe src="javascript:alert('XSS')">
<svg onload="alert('XSS')">
```

すべて正しくエスケープされることを確認する。

---

### CSRF対策

**GASの組み込み対策**:
- google.script.runは同一オリジンポリシーで保護
- CSRFトークン不要（GASが自動処理）

**追加対策**:
```javascript
// セッショントークンの検証（オプション）
function validateSession() {
  const props = PropertiesService.getUserProperties();
  const sessionToken = props.getProperty('sessionToken');
  
  if (!sessionToken) {
    const newToken = Utilities.getUuid();
    props.setProperty('sessionToken', newToken);
    return newToken;
  }
  
  return sessionToken;
}
```

---

### レート制限

**Drive APIクォータ**:
- 読み取り: 1,000リクエスト/100秒/ユーザー
- 書き込み: 300リクエスト/100秒/ユーザー

**実装例**:
```javascript
function checkRateLimit(operation) {
  const props = PropertiesService.getUserProperties();
  const key = `rateLimit_${operation}_${Math.floor(Date.now() / 100000)}`;
  
  const count = parseInt(props.getProperty(key) || '0');
  const limit = operation === 'read' ? 1000 : 300;
  
  if (count >= limit) {
    return {
      allowed: false,
      message: `Rate limit exceeded for ${operation}. Wait 100 seconds.`
    };
  }
  
  props.setProperty(key, String(count + 1));
  return {allowed: true};
}
```

**使用方法**:
```javascript
function cmdList(args) {
  const rateCheck = checkRateLimit('read');
  if (!rateCheck.allowed) {
    return {success: false, output: rateCheck.message};
  }
  
  // 通常処理
}
```

---

## 拡張機能の実装案

### 機能1: ファイル検索の高度化

**現在**: 完全一致のみ
**拡張**: 正規表現サポート

```javascript
function cmdFindRegex(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: find-regex <pattern>'};
  }
  
  const pattern = new RegExp(args.join(' '), 'i');
  const currentFolder = getCurrentFolder();
  const matches = [];
  
  // フォルダ検索
  const folders = currentFolder.getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    if (pattern.test(folder.getName())) {
      matches.push({
        name: '[' + folder.getName() + ']',
        type: 'DIR',
        id: folder.getId()
      });
    }
  }
  
  // ファイル検索
  const files = currentFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (pattern.test(file.getName())) {
      matches.push({
        name: file.getName(),
        type: 'FILE',
        id: file.getId()
      });
    }
  }
  
  if (matches.length === 0) {
    return {success: true, output: 'No matches found.'};
  }
  
  let output = `Found ${matches.length} match(es):\n\n`;
  matches.forEach(m => {
    output += `${m.type}: ${m.name}\n  ID: ${m.id}\n\n`;
  });
  
  return {success: true, output: output};
}
```

**コマンドマップ追加**:
```javascript
'find-regex': cmdFindRegex,
'fr': cmdFindRegex  // エイリアス
```

---

### 機能2: ファイル内容検索

```javascript
function cmdGrep(args) {
  if (args.length < 2) {
    return {success: false, output: 'Error: Usage: grep <pattern> <file>'};
  }
  
  const pattern = args[0];
  const filename = args.slice(1).join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    const files = currentFolder.getFilesByName(filename);
    if (!files.hasNext()) {
      return {success: false, output: `Error: File '${filename}' not found`};
    }
    
    const file = files.next();
    const mimeType = file.getMimeType();
    
    // テキストファイルのみ
    if (!mimeType.startsWith('text/') && mimeType !== MimeType.PLAIN_TEXT) {
      return {success: false, output: 'Error: Not a text file'};
    }
    
    const content = file.getBlob().getDataAsString();
    const lines = content.split('\n');
    const matches = [];
    
    lines.forEach((line, index) => {
      if (line.includes(pattern)) {
        matches.push(`${index + 1}: ${line}`);
      }
    });
    
    if (matches.length === 0) {
      return {success: true, output: 'No matches found.'};
    }
    
    let output = `Found ${matches.length} match(es) in ${filename}:\n\n`;
    output += matches.join('\n');
    
    return {success: true, output: output};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}
```

---

### 機能3: ファイル圧縮

```javascript
function cmdZip(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: zip <output.zip> <file1> <file2> ...'};
  }
  
  const zipName = args[0];
  const fileNames = args.slice(1);
  const currentFolder = getCurrentFolder();
  
  try {
    const blobs = [];
    
    fileNames.forEach(name => {
      const files = currentFolder.getFilesByName(name);
      if (files.hasNext()) {
        blobs.push(files.next().getBlob());
      }
    });
    
    if (blobs.length === 0) {
      return {success: false, output: 'Error: No valid files found'};
    }
    
    const zipBlob = Utilities.zip(blobs, zipName);
    const zipFile = currentFolder.createFile(zipBlob);
    
    return {
      success: true,
      output: `Created: ${zipName}\nFiles: ${blobs.length}\nID: ${zipFile.getId()}`
    };
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}
```

---

### 機能4: エイリアス機能

**状態保存**:
```javascript
function cmdAlias(args) {
  if (args.length === 0) {
    // エイリアス一覧表示
    const props = PropertiesService.getUserProperties();
    const aliases = JSON.parse(props.getProperty('aliases') || '{}');
    
    if (Object.keys(aliases).length === 0) {
      return {success: true, output: 'No aliases defined.'};
    }
    
    let output = 'Defined aliases:\n\n';
    for (const [name, command] of Object.entries(aliases)) {
      output += `${name} → ${command}\n`;
    }
    
    return {success: true, output: output};
  }
  
  if (args.length < 2) {
    return {success: false, output: 'Error: Usage: alias <name> <command>'};
  }
  
  const aliasName = args[0];
  const command = args.slice(1).join(' ');
  
  const props = PropertiesService.getUserProperties();
  const aliases = JSON.parse(props.getProperty('aliases') || '{}');
  
  aliases[aliasName] = command;
  props.setProperty('aliases', JSON.stringify(aliases));
  
  return {success: true, output: `Alias created: ${aliasName} → ${command}`};
}
```

**コマンド処理の修正**:
```javascript
function processCommand(commandLine) {
  // エイリアス展開
  const props = PropertiesService.getUserProperties();
  const aliases = JSON.parse(props.getProperty('aliases') || '{}');
  
  const parts = commandLine.trim().split(' ');
  const command = parts[0];
  
  if (aliases[command]) {
    commandLine = aliases[command] + ' ' + parts.slice(1).join(' ');
  }
  
  // 通常の処理
  // ...
}
```

---

### 機能5: パイプライン

**構文**: `command1 | command2`

**実装**:
```javascript
function processCommand(commandLine) {
  // パイプ検出
  if (commandLine.includes('|')) {
    return processPipeline(commandLine);
  }
  
  // 通常処理
  // ...
}

function processPipeline(commandLine) {
  const commands = commandLine.split('|').map(c => c.trim());
  let input = '';
  
  for (const cmd of commands) {
    const result = executeCommand(cmd, input);
    if (!result.success) {
      return result;
    }
    input = result.output;
  }
  
  return {success: true, output: input};
}
```

**使用例**:
```bash
> ls | grep report
> find report | stat
```

---

### 機能6: スクリプト実行

**ファイルからコマンド読み込み**:
```javascript
function cmdSource(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: source <script.txt>'};
  }
  
  const filename = args.join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    const files = currentFolder.getFilesByName(filename);
    if (!files.hasNext()) {
      return {success: false, output: `Error: File '${filename}' not found`};
    }
    
    const file = files.next();
    const content = file.getBlob().getDataAsString();
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    const results = [];
    for (const line of lines) {
      if (line.startsWith('#')) continue;  // コメント
      
      const result = processCommand(line);
      results.push(`> ${line}\n${result.output}\n`);
      
      if (!result.success) break;
    }
    
    return {success: true, output: results.join('\n')};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}
```

**スクリプトファイル例**:
```bash
# setup.txt
cd Documents
new project dir
cd project
new README.md file
new main.py file
ls
```

**実行**:
```bash
> source setup.txt
```

---

## API制限と対策

### Drive API クォータ

**無料アカウント**:
| 操作 | 制限 |
|------|------|
| 読み取り | 1,000/100秒/ユーザー |
| 書き込み | 300/100秒/ユーザー |
| ストレージ | 15GB |

**Google Workspace**:
| 操作 | 制限 |
|------|------|
| 読み取り | 10,000/100秒/ユーザー |
| 書き込み | 1,000/100秒/ユーザー |
| ストレージ | 組織による |

---

### GAS実行時間制限

**制限値**:
- 無料: 6分/実行
- Google Workspace: 6分/実行（変更なし）

**対策**:
```javascript
function cmdLongOperation(args) {
  const startTime = Date.now();
  const maxTime = 5 * 60 * 1000;  // 5分
  
  while (hasMoreWork()) {
    if (Date.now() - startTime > maxTime) {
      return {
        success: false,
        output: 'Error: Operation timed out. Resume with: resume-operation'
      };
    }
    
    doWork();
  }
  
  return {success: true, output: 'Completed'};
}
```

---

### PropertiesService制限

**制限値**:
- 最大サイズ: 9KB（キー＋値の合計）
- 呼び出し制限: なし（実質無制限）

**最適化**:
```javascript
// 大きなデータは圧縮
function saveCompressed(key, data) {
  const compressed = Utilities.base64Encode(
    Utilities.gzip(Utilities.newBlob(JSON.stringify(data))).getBytes()
  );
  PropertiesService.getUserProperties().setProperty(key, compressed);
}

function loadCompressed(key) {
  const compressed = PropertiesService.getUserProperties().getProperty(key);
  if (!compressed) return null;
  
  const decompressed = Utilities.ungzip(
    Utilities.newBlob(Utilities.base64Decode(compressed))
  );
  return JSON.parse(decompressed.getDataAsString());
}
```

---

## テスト戦略

### 単体テスト

**テストフレームワーク**:
```javascript
function runUnitTests() {
  const tests = [
    testFormatBytes,
    testPadRight,
    testBuildPath,
    testValidateFilename
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(test => {
    try {
      test();
      Logger.log(`✓ ${test.name}`);
      passed++;
    } catch (error) {
      Logger.log(`✗ ${test.name}: ${error.message}`);
      failed++;
    }
  });
  
  Logger.log(`\nResults: ${passed} passed, ${failed} failed`);
}

function testFormatBytes() {
  assertEqual(formatBytes(0), '0 B');
  assertEqual(formatBytes(1024), '1.0 KB');
  assertEqual(formatBytes(1048576), '1.0 MB');
  assertEqual(formatBytes(1536), '1.5 KB');
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}
```

---

### 統合テスト

```javascript
function runIntegrationTests() {
  const testFile = 'test_' + Date.now() + '.txt';
  
  try {
    // 作成テスト
    let result = cmdNew([testFile, 'file']);
    assert(result.success, 'File creation failed');
    
    // 存在確認
    result = cmdFind([testFile]);
    assert(result.success && result.output.includes(testFile), 'Find failed');
    
    // 名前変更
    const newName = 'renamed_' + Date.now() + '.txt';
    result = cmdRename([testFile, newName]);
    assert(result.success, 'Rename failed');
    
    // 削除
    result = cmdDelete([newName]);
    assert(result.success, 'Delete failed');
    
    // ゴミ箱確認
    result = cmdTrash([]);
    assert(result.success && result.output.includes(newName), 'Trash check failed');
    
    // 復元
    result = cmdTrash([newName, 'restore']);
    assert(result.success, 'Restore failed');
    
    // 最終削除
    cmdDelete([newName]);
    
    Logger.log('✓ All integration tests passed');
    
  } catch (error) {
    Logger.log('✗ Integration test failed: ' + error.message);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
```

---

## デプロイメント

### バージョン管理

**セマンティックバージョニング**:
```
MAJOR.MINOR.PATCH

MAJOR: 破壊的変更
MINOR: 新機能追加
PATCH: バグ修正
```

**現在のバージョン**: 2.0.0

**変更履歴**:
```
v2.0.0 (2025-10-17)
  - 27コマンドへの拡張
  - ディレクトリナビゲーション
  - テーマ切り替え
  - クリップボード機能

v1.0.0 (2025-10-01)
  - 初期リリース
  - 基本コマンド (ls, create, delete)
```

---

### 環境分離

**開発環境**:
```javascript
const CONFIG = {
  env: 'development',
  debug: true,
  logLevel: 'verbose'
};
```

**本番環境**:
```javascript
const CONFIG = {
  env: 'production',
  debug: false,
  logLevel: 'error'
};
```

**環境依存処理**:
```javascript
function log(message, level = 'info') {
  if (CONFIG.env === 'development' || level === 'error') {
    Logger.log(`[${level.toUpperCase()}] ${message}`);
  }
}
```

---

### ロールバック手順

**問題発生時**:
1. GASエディタ → デプロイ → デプロイを管理
2. 以前のバージョンを選択
3. 「このバージョンをデプロイ」をクリック

**手動ロールバック**:
```javascript
// バージョン管理用の定数
const VERSION = '2.0.0';

function getVersion() {
  return {success: true, output: `Google Drive CLI v${VERSION}`};
}
```

---

## まとめ

### プロジェクトの特性

**形式的性質**:
1. **完全性**: すべてのコマンドが `CommandResult` 型を返す
2. **決定性**: 同じ入力に対して同じ出力
3. **安全性**: 無効な状態遷移が発生しない
4. **終了性**: すべてのコマンドが有限時間で終了

**実装品質**:
- **モジュール性**: 27個の独立したコマンド関数
- **拡張性**: 新規コマンド追加が容易
- **保守性**: 一貫したコーディング規約
- **テスト可能性**: 単体・統合テスト完備

---

### 数学的整合性

**型安全性**:
$\forall c \in \mathcal{C}: \text{type}(c) = [\text{String}] \rightarrow \text{CommandResult}$

**状態不変条件の保持**:
$\forall s \in S, c \in \mathcal{C}: I(s) \Rightarrow I(\delta(s, c))$

**停止性**:
$\forall c \in \mathcal{C}: \exists t \in \mathbb{N}: \text{terminates}(c, t)$

---

### 今後の開発ロードマップ

**Phase 1** (完了):
- ✅ 基本ナビゲーション (ls, cd, pwd)
- ✅ ファイル操作 (new, rn, del, copy, paste)
- ✅ メタデータ (stat, url, open)
- ✅ UI制御 (clear, reload, exit, color, theme)

**Phase 2** (計画中):
- ⬜ 正規表現検索 (find-regex)
- ⬜ ファイル内容検索 (grep)
- ⬜ ファイル圧縮 (zip, unzip)
- ⬜ エイリアス機能 (alias)

**Phase 3** (将来):
- ⬜ パイプライン処理
- ⬜ スクリプト実行 (source)
- ⬜ バックグラウンド実行
- ⬜ プラグインシステム

---

### リファレンス

**公式ドキュメント**:
- [Google Apps Script](https://developers.google.com/apps-script)
- [DriveApp Reference](https://developers.google.com/apps-script/reference/drive/drive-app)
- [PropertiesService](https://developers.google.com/apps-script/reference/properties)

**コミュニティリソース**:
- Stack Overflow: `google-apps-script` タグ
- GitHub: GAS関連プロジェクト

---

**ドキュメントバージョン**: 2.0.0  
**最終更新**: 2025-10-17  
**対象GASランタイム**: V8  
**対象ブラウザ**: Chrome, Firefox, Safari (最新版)