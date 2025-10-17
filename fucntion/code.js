/**
 * Google Drive 擬似CLI - GASバックエンド
 * 
 * アーキテクチャ:
 * - CommandProcessor: コマンド解析と実行の責務分離
 * - DriveService: Drive API操作のカプセル化
 * - 各コマンドは独立した関数として実装し、拡張容易性を確保
 */

// =====================================
// Entry Point
// =====================================

/**
 * Web UIを表示するエントリーポイント
 * @return {HtmlOutput} HTMLサービス出力
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Google Drive CLI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =====================================
// Command Processor
// =====================================

/**
 * コマンドを処理するメインハンドラ
 * @param {string} commandLine - ユーザー入力の完全なコマンドライン
 * @return {Object} {success: boolean, output: string}
 */
function processCommand(commandLine) {
  try {
    // 入力の正規化: 前後の空白削除、連続空白を単一空白に
    const normalized = commandLine.trim().replace(/\s+/g, ' ');
    
    if (!normalized) {
      return {success: false, output: 'Error: Empty command'};
    }
    
    // コマンドとパラメータに分割
    const parts = normalized.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    // コマンドルーティング
    const commandMap = {
      'list': cmdList,
      'ls': cmdList,  // エイリアス
      'create': cmdCreate,
      'delete': cmdDelete,
      'rm': cmdDelete,  // エイリアス
      'help': cmdHelp
    };
    
    if (commandMap[command]) {
      return commandMap[command](args);
    } else {
      return {
        success: false, 
        output: `Error: Unknown command '${command}'. Type 'help' for available commands.`
      };
    }
    
  } catch (error) {
    Logger.log('Error in processCommand: ' + error.toString());
    return {
      success: false,
      output: `System error: ${error.message}`
    };
  }
}

// =====================================
// Command Implementations
// =====================================

/**
 * list/ls コマンド: ルートディレクトリのファイル一覧を表示
 * @param {Array<string>} args - コマンド引数（現在未使用）
 * @return {Object}
 */
function cmdList(args) {
  try {
    const files = DriveApp.getRootFolder().getFiles();
    const fileList = [];
    
    while (files.hasNext()) {
      const file = files.next();
      // ファイル情報: 名前、タイプ、サイズ、最終更新日
      fileList.push({
        name: file.getName(),
        type: file.getMimeType().split('/').pop(),
        size: formatBytes(file.getSize()),
        modified: Utilities.formatDate(file.getLastUpdated(), 
                                       Session.getScriptTimeZone(), 
                                       'yyyy-MM-dd HH:mm')
      });
    }
    
    if (fileList.length === 0) {
      return {success: true, output: 'No files found in root directory.'};
    }
    
    // テーブル形式で出力を整形
    let output = `Found ${fileList.length} file(s):\n\n`;
    output += padRight('NAME', 30) + padRight('TYPE', 15) + padRight('SIZE', 12) + 'MODIFIED\n';
    output += '-'.repeat(80) + '\n';
    
    fileList.forEach(f => {
      output += padRight(f.name, 30) + 
                padRight(f.type, 15) + 
                padRight(f.size, 12) + 
                f.modified + '\n';
    });
    
    return {success: true, output: output};
    
  } catch (error) {
    return {success: false, output: `Error listing files: ${error.message}`};
  }
}

/**
 * create コマンド: 新規ファイルを作成
 * @param {Array<string>} args - [0]: ファイル名
 * @return {Object}
 */
function cmdCreate(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Filename required. Usage: create <filename>'};
  }
  
  const filename = args.join(' ');  // スペース含むファイル名に対応
  
  try {
    // 既存ファイルチェック
    const existing = DriveApp.getRootFolder().getFilesByName(filename);
    if (existing.hasNext()) {
      return {success: false, output: `Error: File '${filename}' already exists.`};
    }
    
    // Google Docsとして作成（拡張可能: 拡張子で判定も可能）
    const file = DriveApp.getRootFolder().createFile(filename, '', MimeType.PLAIN_TEXT);
    
    return {
      success: true, 
      output: `Created: ${filename}\nID: ${file.getId()}`
    };
    
  } catch (error) {
    return {success: false, output: `Error creating file: ${error.message}`};
  }
}

/**
 * delete/rm コマンド: ファイルを削除（ゴミ箱へ移動）
 * @param {Array<string>} args - [0]: ファイル名
 * @return {Object}
 */
function cmdDelete(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Filename required. Usage: delete <filename>'};
  }
  
  const filename = args.join(' ');
  
  try {
    const files = DriveApp.getRootFolder().getFilesByName(filename);
    
    if (!files.hasNext()) {
      return {success: false, output: `Error: File '${filename}' not found.`};
    }
    
    // 同名ファイルが複数ある場合は最初の1つを削除
    const file = files.next();
    file.setTrashed(true);
    
    let warning = '';
    if (files.hasNext()) {
      warning = '\nWarning: Multiple files with this name exist. Only the first one was deleted.';
    }
    
    return {
      success: true, 
      output: `Deleted: ${filename}${warning}`
    };
    
  } catch (error) {
    return {success: false, output: `Error deleting file: ${error.message}`};
  }
}

/**
 * help コマンド: 利用可能なコマンド一覧を表示
 * @param {Array<string>} args - 未使用
 * @return {Object}
 */
function cmdHelp(args) {
  const helpText = `
Available Commands:
-------------------
list, ls              List all files in the root directory
create <filename>     Create a new empty file
delete <filename>     Delete a file (move to trash)
rm <filename>         Alias for delete
help                  Show this help message

Examples:
---------
> list
> create myfile.txt
> delete myfile.txt

Future commands (planned):
--------------------------
cd <folder>           Change directory
pwd                   Print working directory
mv <src> <dst>        Move/rename file
mkdir <name>          Create folder
`;
  
  return {success: true, output: helpText};
}

// =====================================
// Utility Functions
// =====================================

/**
 * バイト数を人間可読形式に変換
 * @param {number} bytes - バイト数
 * @return {string} フォーマット済み文字列
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + units[i];
}

/**
 * 文字列を指定幅で右パディング
 * @param {string} str - 対象文字列
 * @param {number} width - 目標幅
 * @return {string} パディング済み文字列
 */
function padRight(str, width) {
  str = String(str);
  if (str.length >= width) {
    return str.substring(0, width - 3) + '...';
  }
  return str + ' '.repeat(width - str.length);
}

// =====================================
// Extension Points (将来の拡張用)
// =====================================

/**
 * カレントディレクトリ管理用のグローバル状態
 * 実装案: PropertiesServiceで永続化
 * 
 * function getCurrentDirectory() {
 *   const props = PropertiesService.getUserProperties();
 *   return props.getProperty('currentDir') || 'root';
 * }
 * 
 * function setCurrentDirectory(folderId) {
 *   const props = PropertiesService.getUserProperties();
 *   props.setProperty('currentDir', folderId);
 * }
 */