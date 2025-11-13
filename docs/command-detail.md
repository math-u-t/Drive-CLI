# Google Drive CLI - コマンド詳細リファレンス

## 目次
1. [ナビゲーションコマンド](#ナビゲーションコマンド)
2. [ファイル操作コマンド](#ファイル操作コマンド)
3. [メタデータコマンド](#メタデータコマンド)
4. [共有コマンド](#共有コマンド)
5. [ゴミ箱コマンド](#ゴミ箱コマンド)
6. [UI制御コマンド](#ui制御コマンド)
7. [特殊コマンド](#特殊コマンド)

---

## ナビゲーションコマンド

### `ls` / `ls tree`

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
- リスト表示: O(n) where n = アイテム数
- ツリー表示: O(n · d) where d = 最大深さ

---

### `pwd`

**構文**: `pwd`

**機能**: 現在の作業ディレクトリの絶対パスを表示

**出力例**:
```
/Documents/Projects
```

**計算量**: O(d) where d = ディレクトリの深さ

---

### `cd <path>`

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

---

### `find <name>`

**構文**: `find <name>`

**機能**: 現在のディレクトリで指定名に完全一致するアイテムを検索

**出力例**:
```
> find report.txt
Found (FILE): report.txt
Path: /Documents/report.txt
ID: 1a2b3c4d5e6f7g8h9i0j
```

**計算量**: O(n) where n = 現在のディレクトリ内のアイテム数

**注意**:
- 完全一致検索（大文字小文字区別なし）
- サブディレクトリは検索しない
- 最初に見つかったものを返す

---

## ファイル操作コマンド

### `new <name> <type>`

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

### `rn <old_name> <new_name>`

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

### `del <name>`

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

### `copy <name>`

**構文**: `copy <name>`

**機能**: ファイルまたはフォルダを内部クリップボードにコピー

**例**:
```
> copy document.pdf
Copied to clipboard: document.pdf (FILE)
```

**注意**:
- フォルダのコピーはDrive API制限により完全にはサポートされない
- セッション間で永続化される（PropertiesService使用）

---

### `paste`

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

### `mv <source> <destination>` (新規)

**構文**: `mv <source> <destination>`

**機能**: ファイルまたはフォルダを別のフォルダに移動

**例**:
```
> mv report.txt Documents
Moved: report.txt → Documents/

> mv ProjectA ProjectB
Moved: ProjectA → ProjectB/
```

---

### `cp <source> <destination>` (新規)

**構文**: `cp <source> <destination>`

**機能**: ファイルを別のフォルダにコピー

**例**:
```
> cp report.txt Backup
Copied: report.txt → Backup/report.txt
```

**注意**: フォルダのコピーは未サポート

---

### `touch <name>` (新規)

**構文**: `touch <name>`

**機能**: 空のテキストファイルを作成

**例**:
```
> touch notes.txt
Created file: notes.txt
```

**注意**: `new <name> file` のショートカット

---

### `mkdir <name>` (新規)

**構文**: `mkdir <name>`

**機能**: 新しいフォルダを作成

**例**:
```
> mkdir Projects
Created directory: Projects
```

**注意**: `new <name> dir` のショートカット

---

### `cat <name>` (新規)

**構文**: `cat <name>`

**機能**: テキストファイルの内容を表示

**例**:
```
> cat notes.txt
Hello, this is a test file.
Multiple lines are supported.
```

**注意**: テキストファイルのみサポート（画像やバイナリは未サポート）

---

## メタデータコマンド

### `stat <name>`

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

**計算量**: O(1) - 単一API呼び出し

---

### `url <name>`

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

### `open <name>`

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

## 共有コマンド

### `share <name> <email> <type>`

**構文**:
```
share <name> <email> <type>     # 特定のユーザーと共有
share <name> --link <type>      # リンクを知っている人と共有
share <name> --list             # 共有設定を一覧表示
```

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

> share presentation.pptx --link view
Link sharing enabled for presentation.pptx (anyone with link can view)
URL: https://drive.google.com/file/d/...

> share document.docx --list
=== Sharing Settings for document.docx ===
Owner: me@example.com
Shared with:
  - user@example.com (view)
  - colleague@company.com (edit)
Link sharing: Enabled (view)
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

## ゴミ箱コマンド

### `trash`

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

### `trash <name> restore`

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

**計算量**: O(n) where n = ゴミ箱内のアイテム数

---

## UI制御コマンド

### `clear`

**構文**: `clear`

**機能**: ターミナル画面をクリア

**動作**: DOMから全出力要素を削除

**用途**: 画面が見づらくなった時のリフレッシュ

---

### `reload`

**構文**: `reload`

**機能**: ページを再読み込み

**動作**: `location.reload()` を実行

**用途**:
- 状態のリセット
- UI不具合の解消

---

### `exit`

**構文**: `exit`

**機能**: ブラウザタブを閉じる

**動作**:
1. "Closing..." メッセージを表示
2. 1秒後に `window.close()` を実行

**注意**: ユーザー操作で開いたタブでない場合、閉じられない可能性あり

---

### `color <color>`

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

---

## 特殊コマンド

### `clone <URL>`

**構文**: `clone <URL>`

**機能**: GitリポジトリをGoogle Driveにクローン

**対応プラットフォーム**:
- GitHub
- GitLab
- Bitbucket
- その他のpublic Git リポジトリ

**例**:
```
> clone https://github.com/user/repository
Cloning repository...
Repository cloned successfully!
Location: /repository/
Files: 15
Size: 2.4 MB

> cd repository
> ls
[.git]
README.md
src/
tests/
package.json
```

**動作**:
1. 指定されたGitリポジトリからファイルを取得
2. 現在のディレクトリにフォルダを作成
3. リポジトリの内容をGoogle Driveに保存

**制限事項**:
- プライベートリポジトリは認証情報が必要
- 大きなリポジトリ（100MB以上）は時間がかかる可能性がある
- Gitの履歴は保存されない（最新のファイルのみ）

**エラーケース**:
```
> clone invalid-url
Error: Invalid repository URL

> clone https://github.com/private/repo
Error: Access denied (private repository requires authentication)
```

---

### `help`

**構文**: `help`

**機能**: 全コマンドのリファレンスを表示

**出力**:
- コマンド分類
- 各コマンドの構文
- 使用例
- 注意事項

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
   - 一部のコマンドは部分的に未サポート

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

## パフォーマンス最適化

### API呼び出し削減

**現在の実装**:
- `ls`: O(n) API呼び出し
- `ls tree`: O(n · d) API呼び出し

**最適化案**: CacheServiceの利用で同じディレクトリへの連続アクセスで高速化

---

## まとめ

このドキュメントでは、Google Drive CLIの全コマンドの詳細な使用方法と内部実装について説明しました。

**主要な特徴**:
- 30個以上のUNIXライクなコマンド
- ディレクトリナビゲーション
- ファイル・フォルダ操作
- メタデータ管理
- 共有設定
- Git統合
- テーマ切り替え
- コマンド履歴

**技術スタック**:
- Google Apps Script (V8 Runtime)
- HTML5 + Vanilla JavaScript
- Google Drive API, Forms API, Sheets API, Docs API, Slides API
- PropertiesService (永続化)

**今後の開発ロードマップ**:
- 正規表現検索 (find-regex)
- ファイル内容検索 (grep)
- ファイル圧縮 (zip, unzip)
- エイリアス機能 (alias)
- パイプライン処理
- スクリプト実行 (source)

**リファレンス**:
- [Google Apps Script](https://developers.google.com/apps-script)
- [DriveApp Reference](https://developers.google.com/apps-script/reference/drive/drive-app)
- [PropertiesService](https://developers.google.com/apps-script/reference/properties)

---

**ドキュメントバージョン**: 2.0.0
**最終更新**: 2025-11-13
**対象GASランタイム**: V8
**対象ブラウザ**: Chrome, Firefox, Safari (最新版)
