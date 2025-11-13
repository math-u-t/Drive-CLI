/**
 * Google Drive 擬似CLI - 拡張版GASバックエンド
 * 
 * 形式的仕様:
 * - 状態管理: PropertiesService による永続化
 * - コマンド集合: 27個の独立したコマンド関数
 * - エラーハンドリング: 全関数で一貫した {success, output} インターフェース
 */

// =====================================
// Entry Point
// =====================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Google Drive CLI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =====================================
// State Management
// =====================================

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

function getCurrentFolder() {
  const state = getState();
  return state.currentDir === 'root' 
    ? DriveApp.getRootFolder() 
    : DriveApp.getFolderById(state.currentDir);
}

function getCurrentPath() {
  const state = getState();
  if (state.currentDir === 'root') return '/';
  
  try {
    const folder = DriveApp.getFolderById(state.currentDir);
    return buildPath(folder);
  } catch (e) {
    return '/';
  }
}

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

// =====================================
// Command Processor
// =====================================

function processCommand(commandLine) {
  try {
    const normalized = commandLine.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return {success: false, output: 'Error: Empty command'};
    }
    
    const parts = normalized.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    const commandMap = {
      'ls': cmdLs,
      'pwd': cmdPwd,
      'clear': cmdClear,
      'reload': cmdReload,
      'stat': cmdStat,
      'new': cmdNew,
      'rn': cmdRename,
      'url': cmdUrl,
      'open': cmdOpen,
      'copy': cmdCopy,
      'paste': cmdPaste,
      'del': cmdDelete,
      'exit': cmdExit,
      'color': cmdColor,
      'clone': cmdClone,
      'find': cmdFind,
      'cd': cmdCd,
      'share': cmdShare,
      'trash': cmdTrash,
      'help': cmdHelp,
      'mv': cmdMove,
      'cp': cmdCopyFile,
      'touch': cmdTouch,
      'mkdir': cmdMkdir,
      'cat': cmdCat
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
    return {success: false, output: `System error: ${error.message}`};
  }
}

// =====================================
// Navigation Commands
// =====================================

function cmdLs(args) {
  try {
    const isTree = args[0] === 'tree';
    const currentFolder = getCurrentFolder();
    
    if (isTree) {
      return {success: true, output: buildTree(currentFolder, '', true)};
    }
    
    const folders = currentFolder.getFolders();
    const files = currentFolder.getFiles();
    
    const items = [];
    
    while (folders.hasNext()) {
      const folder = folders.next();
      items.push({
        name: folder.getName(),
        type: 'DIR',
        size: '-',
        modified: Utilities.formatDate(folder.getLastUpdated(), 
                                       Session.getScriptTimeZone(), 
                                       'yyyy-MM-dd HH:mm'),
        isDir: true
      });
    }
    
    while (files.hasNext()) {
      const file = files.next();
      items.push({
        name: file.getName(),
        type: file.getMimeType().split('/').pop().substring(0, 12),
        size: formatBytes(file.getSize()),
        modified: Utilities.formatDate(file.getLastUpdated(), 
                                       Session.getScriptTimeZone(), 
                                       'yyyy-MM-dd HH:mm'),
        isDir: false
      });
    }
    
    if (items.length === 0) {
      return {success: true, output: 'Empty directory.'};
    }
    
    let output = `Total: ${items.length} item(s)\n\n`;
    output += padRight('NAME', 35) + padRight('TYPE', 15) + padRight('SIZE', 12) + 'MODIFIED\n';
    output += '-'.repeat(90) + '\n';
    
    items.sort((a, b) => {
      if (a.isDir !== b.isDir) return b.isDir ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    
    items.forEach(item => {
      const name = item.isDir ? '[' + item.name + ']' : item.name;
      output += padRight(name, 35) + 
                padRight(item.type, 15) + 
                padRight(item.size, 12) + 
                item.modified + '\n';
    });
    
    return {success: true, output: output};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function buildTree(folder, prefix, isLast) {
  let output = prefix + (isLast ? '└── ' : '├── ') + folder.getName() + '/\n';
  
  const subfolders = [];
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    subfolders.push(folders.next());
  }
  
  const files = [];
  const fileIter = folder.getFiles();
  while (fileIter.hasNext() && files.length < 50) {
    files.push(fileIter.next());
  }
  
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

function cmdPwd(args) {
  return {success: true, output: getCurrentPath()};
}

function cmdCd(args) {
  if (args.length === 0) {
    setState('currentDir', 'root');
    return {success: true, output: 'Changed to root directory: /'};
  }
  
  const target = args.join(' ');
  
  try {
    if (target === '/' || target === '~') {
      setState('currentDir', 'root');
      return {success: true, output: 'Changed to root directory: /'};
    }
    
    if (target === '..' || target === '../') {
      const state = getState();
      if (state.currentDir === 'root') {
        return {success: false, output: 'Error: Already at root'};
      }
      
      const current = DriveApp.getFolderById(state.currentDir);
      const parents = current.getParents();
      
      if (parents.hasNext()) {
        const parent = parents.next();
        setState('currentDir', parent.getId());
        return {success: true, output: `Changed to: ${buildPath(parent)}`};
      } else {
        setState('currentDir', 'root');
        return {success: true, output: 'Changed to root directory: /'};
      }
    }
    
    if (target.startsWith('/')) {
      const parts = target.split('/').filter(p => p);
      let current = DriveApp.getRootFolder();
      
      for (const part of parts) {
        const folders = current.getFoldersByName(part);
        if (!folders.hasNext()) {
          return {success: false, output: `Error: Folder '${part}' not found in path`};
        }
        current = folders.next();
      }
      
      setState('currentDir', current.getId());
      return {success: true, output: `Changed to: ${buildPath(current)}`};
    }
    
    const currentFolder = getCurrentFolder();
    const folders = currentFolder.getFoldersByName(target);
    
    if (!folders.hasNext()) {
      return {success: false, output: `Error: Folder '${target}' not found`};
    }
    
    const folder = folders.next();
    setState('currentDir', folder.getId());
    return {success: true, output: `Changed to: ${buildPath(folder)}`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdFind(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: find <name>'};
  }
  
  const name = args.join(' ').toLowerCase();
  const currentFolder = getCurrentFolder();
  
  try {
    const folders = currentFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName().toLowerCase() === name) {
        return {
          success: true, 
          output: `Found (DIR): ${folder.getName()}\nPath: ${buildPath(folder)}\nID: ${folder.getId()}`
        };
      }
    }
    
    const files = currentFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().toLowerCase() === name) {
        return {
          success: true, 
          output: `Found (FILE): ${file.getName()}\nPath: ${getCurrentPath()}/${file.getName()}\nID: ${file.getId()}`
        };
      }
    }
    
    return {success: false, output: `Error: '${name}' not found in current directory`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

// =====================================
// File Operation Commands
// =====================================

function cmdNew(args) {
  if (args.length < 2) {
    return {success: false, output: 'Error: Usage: new <name> <type>\nTypes: file, dir, form, sheet, docs, slide, script, py'};
  }
  
  const type = args[args.length - 1].toLowerCase();
  const name = args.slice(0, -1).join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    let created;
    
    switch (type) {
      case 'file':
        created = currentFolder.createFile(name, '', MimeType.PLAIN_TEXT);
        break;
        
      case 'dir':
        created = currentFolder.createFolder(name);
        break;
        
      case 'form':
        const form = FormApp.create(name);
        created = DriveApp.getFileById(form.getId());
        currentFolder.addFile(created);
        DriveApp.getRootFolder().removeFile(created);
        break;
        
      case 'sheet':
        const sheet = SpreadsheetApp.create(name);
        created = DriveApp.getFileById(sheet.getId());
        currentFolder.addFile(created);
        DriveApp.getRootFolder().removeFile(created);
        break;
        
      case 'docs':
        const doc = DocumentApp.create(name);
        created = DriveApp.getFileById(doc.getId());
        currentFolder.addFile(created);
        DriveApp.getRootFolder().removeFile(created);
        break;
        
      case 'slide':
        const slide = SlidesApp.create(name);
        created = DriveApp.getFileById(slide.getId());
        currentFolder.addFile(created);
        DriveApp.getRootFolder().removeFile(created);
        break;
        
      case 'script':
        return {success: false, output: 'Error: Google Apps Script creation requires manual setup via script.google.com'};
        
      case 'py':
        return {success: false, output: 'Error: Google Colab creation requires manual setup via colab.research.google.com'};
        
      default:
        return {success: false, output: `Error: Unknown type '${type}'`};
    }
    
    return {
      success: true, 
      output: `Created ${type}: ${name}\nID: ${created.getId()}\nURL: ${created.getUrl()}`
    };
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdRename(args) {
  if (args.length < 2) {
    return {success: false, output: 'Error: Usage: rn <old_name> <new_name>'};
  }
  
  const oldName = args[0];
  const newName = args.slice(1).join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    let folders = currentFolder.getFoldersByName(oldName);
    if (folders.hasNext()) {
      const folder = folders.next();
      folder.setName(newName);
      return {success: true, output: `Renamed directory: ${oldName} → ${newName}`};
    }
    
    let files = currentFolder.getFilesByName(oldName);
    if (files.hasNext()) {
      const file = files.next();
      file.setName(newName);
      return {success: true, output: `Renamed file: ${oldName} → ${newName}`};
    }
    
    return {success: false, output: `Error: '${oldName}' not found`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdDelete(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: del <name>'};
  }
  
  const name = args.join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      folders.next().setTrashed(true);
      return {success: true, output: `Moved to trash: ${name} (DIR)`};
    }
    
    let files = currentFolder.getFilesByName(name);
    if (files.hasNext()) {
      files.next().setTrashed(true);
      return {success: true, output: `Moved to trash: ${name} (FILE)`};
    }
    
    return {success: false, output: `Error: '${name}' not found`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdCopy(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: copy <name>'};
  }
  
  const name = args.join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      const folder = folders.next();
      setState('clipboard', folder.getId());
      setState('clipboardType', 'folder');
      return {success: true, output: `Copied to clipboard: ${name} (DIR)`};
    }
    
    let files = currentFolder.getFilesByName(name);
    if (files.hasNext()) {
      const file = files.next();
      setState('clipboard', file.getId());
      setState('clipboardType', 'file');
      return {success: true, output: `Copied to clipboard: ${name} (FILE)`};
    }
    
    return {success: false, output: `Error: '${name}' not found`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdPaste(args) {
  const state = getState();
  
  if (!state.clipboard) {
    return {success: false, output: 'Error: Clipboard is empty'};
  }
  
  const currentFolder = getCurrentFolder();
  
  try {
    if (state.clipboardType === 'file') {
      const file = DriveApp.getFileById(state.clipboard);
      const copy = file.makeCopy(file.getName(), currentFolder);
      return {success: true, output: `Pasted file: ${copy.getName()}`};
    } else {
      return {success: false, output: 'Error: Folder paste not fully supported by Drive API'};
    }
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

// =====================================
// Metadata Commands
// =====================================

function cmdStat(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: stat <name>'};
  }
  
  const name = args.join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      const folder = folders.next();
      let output = `=== Directory Statistics ===\n\n`;
      output += `Name:       ${folder.getName()}\n`;
      output += `ID:         ${folder.getId()}\n`;
      output += `Created:    ${formatDate(folder.getDateCreated())}\n`;
      output += `Modified:   ${formatDate(folder.getLastUpdated())}\n`;
      output += `Owner:      ${folder.getOwner().getName()}\n`;
      output += `URL:        ${folder.getUrl()}\n`;
      
      const access = folder.getSharingAccess();
      const permission = folder.getSharingPermission();
      output += `Access:     ${access} (${permission})\n`;
      
      return {success: true, output: output};
    }
    
    let files = currentFolder.getFilesByName(name);
    if (files.hasNext()) {
      const file = files.next();
      let output = `=== File Statistics ===\n\n`;
      output += `Name:       ${file.getName()}\n`;
      output += `ID:         ${file.getId()}\n`;
      output += `Type:       ${file.getMimeType()}\n`;
      output += `Size:       ${formatBytes(file.getSize())}\n`;
      output += `Created:    ${formatDate(file.getDateCreated())}\n`;
      output += `Modified:   ${formatDate(file.getLastUpdated())}\n`;
      output += `Owner:      ${file.getOwner().getName()}\n`;
      output += `URL:        ${file.getUrl()}\n`;
      
      const access = file.getSharingAccess();
      const permission = file.getSharingPermission();
      output += `Access:     ${access} (${permission})\n`;
      
      return {success: true, output: output};
    }
    
    return {success: false, output: `Error: '${name}' not found`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdUrl(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: url <name>'};
  }
  
  const name = args.join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      return {success: true, output: folders.next().getUrl()};
    }
    
    let files = currentFolder.getFilesByName(name);
    if (files.hasNext()) {
      return {success: true, output: files.next().getUrl()};
    }
    
    return {success: false, output: `Error: '${name}' not found`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdOpen(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: open <name>'};
  }
  
  const name = args.join(' ');
  const currentFolder = getCurrentFolder();
  
  try {
    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      return {success: true, output: folders.next().getUrl(), action: 'open'};
    }
    
    let files = currentFolder.getFilesByName(name);
    if (files.hasNext()) {
      return {success: true, output: files.next().getUrl(), action: 'open'};
    }
    
    return {success: false, output: `Error: '${name}' not found`};
    
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

// =====================================
// Share Commands
// =====================================

function cmdShare(args) {
  if (args.length === 0) {
    return {
      success: false,
      output: 'Error: Usage:\n  share <name> <email> <type>\n  share <name> --link <type>\n  share <name> --list\nTypes: view, edit, comment'
    };
  }

  const currentFolder = getCurrentFolder();

  // --list フラグをチェック
  if (args.length >= 2 && args[args.length - 1] === '--list') {
    const name = args.slice(0, -1).join(' ');
    return cmdShareList(name, currentFolder);
  }

  // --link フラグをチェック
  if (args.length >= 3 && args[args.length - 2] === '--link') {
    const type = args[args.length - 1].toLowerCase();
    const name = args.slice(0, -2).join(' ');
    return cmdShareLink(name, type, currentFolder);
  }

  // 通常の共有
  if (args.length < 3) {
    return {
      success: false,
      output: 'Error: Usage:\n  share <name> <email> <type>\n  share <name> --link <type>\n  share <name> --list\nTypes: view, edit, comment'
    };
  }

  const type = args[args.length - 1].toLowerCase();
  const email = args[args.length - 2];
  const name = args.slice(0, -2).join(' ');

  try {
    let target = null;

    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      target = folders.next();
    } else {
      let files = currentFolder.getFilesByName(name);
      if (files.hasNext()) {
        target = files.next();
      }
    }

    if (!target) {
      return {success: false, output: `Error: '${name}' not found`};
    }

    // メールアドレスの簡易検証
    if (!email.includes('@') || !email.includes('.')) {
      return {success: false, output: `Error: Invalid email address '${email}'`};
    }

    switch (type) {
      case 'view':
        target.addViewer(email);
        break;
      case 'edit':
        target.addEditor(email);
        break;
      case 'comment':
        target.addCommenter(email);
        break;
      default:
        return {success: false, output: `Error: Unknown permission type '${type}'\nValid types: view, edit, comment`};
    }

    return {success: true, output: `Shared ${name} with ${email} (${type})`};

  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdShareLink(name, type, currentFolder) {
  try {
    let target = null;

    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      target = folders.next();
    } else {
      let files = currentFolder.getFilesByName(name);
      if (files.hasNext()) {
        target = files.next();
      }
    }

    if (!target) {
      return {success: false, output: `Error: '${name}' not found`};
    }

    let permission;
    switch (type) {
      case 'view':
        permission = DriveApp.Permission.VIEW;
        break;
      case 'edit':
        permission = DriveApp.Permission.EDIT;
        break;
      case 'comment':
        permission = DriveApp.Permission.COMMENT;
        break;
      default:
        return {success: false, output: `Error: Unknown permission type '${type}'\nValid types: view, edit, comment`};
    }

    target.setSharing(DriveApp.Access.ANYONE_WITH_LINK, permission);

    let output = `Link sharing enabled for ${name}\n`;
    output += `Permission: Anyone with link can ${type}\n`;
    output += `URL: ${target.getUrl()}`;

    return {success: true, output: output};

  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdShareList(name, currentFolder) {
  try {
    let target = null;

    let folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      target = folders.next();
    } else {
      let files = currentFolder.getFilesByName(name);
      if (files.hasNext()) {
        target = files.next();
      }
    }

    if (!target) {
      return {success: false, output: `Error: '${name}' not found`};
    }

    let output = `=== Sharing Settings for ${name} ===\n\n`;
    output += `Owner: ${target.getOwner().getEmail()}\n\n`;

    // 編集者を取得
    const editors = target.getEditors();
    if (editors.length > 0) {
      output += `Editors:\n`;
      editors.forEach(editor => {
        output += `  - ${editor.getEmail()}\n`;
      });
      output += '\n';
    }

    // 閲覧者を取得
    const viewers = target.getViewers();
    if (viewers.length > 0) {
      output += `Viewers:\n`;
      viewers.forEach(viewer => {
        output += `  - ${viewer.getEmail()}\n`;
      });
      output += '\n';
    }

    // 共有設定を取得
    const access = target.getSharingAccess();
    const permission = target.getSharingPermission();
    output += `Link sharing: ${access} (${permission})`;

    return {success: true, output: output};

  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

// =====================================
// Trash Commands
// =====================================

function cmdTrash(args) {
  if (args.length === 0) {
    try {
      const files = DriveApp.getTrashedFiles();
      const folders = DriveApp.getTrashedFolders();
      
      const items = [];
      
      while (folders.hasNext()) {
        const folder = folders.next();
        items.push({
          name: '[' + folder.getName() + ']',
          type: 'DIR',
          trashed: formatDate(folder.getLastUpdated())
        });
      }
      
      while (files.hasNext()) {
        const file = files.next();
        items.push({
          name: file.getName(),
          type: file.getMimeType().split('/').pop().substring(0, 12),
          trashed: formatDate(file.getLastUpdated())
        });
      }
      
      if (items.length === 0) {
        return {success: true, output: 'Trash is empty.'};
      }
      
      let output = `Trash: ${items.length} item(s)\n\n`;
      output += padRight('NAME', 40) + padRight('TYPE', 15) + 'TRASHED\n';
      output += '-'.repeat(80) + '\n';
      
      items.forEach(item => {
        output += padRight(item.name, 40) + padRight(item.type, 15) + item.trashed + '\n';
      });
      
      return {success: true, output: output};
      
    } catch (error) {
      return {success: false, output: `Error: ${error.message}`};
    }
  }
  
  if (args.length >= 2 && args[args.length - 1].toLowerCase() === 'restore') {
    const name = args.slice(0, -1).join(' ');
    
    try {
      let files = DriveApp.getTrashedFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (file.getName() === name) {
          file.setTrashed(false);
          return {success: true, output: `Restored: ${name}`};
        }
      }
      
      let folders = DriveApp.getTrashedFolders();
      while (folders.hasNext()) {
        const folder = folders.next();
        if (folder.getName() === name) {
          folder.setTrashed(false);
          return {success: true, output: `Restored: ${name}`};
        }
      }
      
      return {success: false, output: `Error: '${name}' not found in trash`};
      
    } catch (error) {
      return {success: false, output: `Error: ${error.message}`};
    }
  }
  
  return {success: false, output: 'Error: Usage: trash OR trash <name> restore'};
}

// =====================================
// UI Control Commands
// =====================================

function cmdClear(args) {
  return {success: true, output: '', action: 'clear'};
}

function cmdReload(args) {
  return {success: true, output: '', action: 'reload'};
}

function cmdExit(args) {
  return {success: true, output: 'Closing...', action: 'exit'};
}

function cmdColor(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: color <color>\nAvailable: white, blue, green, red, yellow, cyan, magenta, black'};
  }
  
  const color = args[0].toLowerCase();
  const validColors = ['white', 'blue', 'green', 'red', 'yellow', 'cyan', 'magenta', 'black'];
  
  if (!validColors.includes(color)) {
    return {success: false, output: `Error: Invalid color '${color}'`};
  }
  
  return {success: true, output: `Color changed to ${color}`, action: 'color', color: color};
}

// =====================================
// Special Commands
// =====================================

function cmdClone(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: clone <URL>'};
  }

  const url = args[0];

  try {
    // GitHubのURLをチェック
    let repoUrl = url;
    let repoName = '';

    // GitHub URL からリポジトリ名を抽出
    if (url.includes('github.com')) {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      if (match) {
        repoName = match[2];
        // GitHub の raw content URL に変換（zipファイル取得用）
        repoUrl = `https://github.com/${match[1]}/${match[2]}/archive/refs/heads/main.zip`;
      } else {
        return {success: false, output: 'Error: Invalid GitHub URL format'};
      }
    } else if (url.includes('gitlab.com')) {
      const match = url.match(/gitlab\.com\/([^\/]+)\/([^\/\.]+)/);
      if (match) {
        repoName = match[2];
        repoUrl = `https://gitlab.com/${match[1]}/${match[2]}/-/archive/main/${match[2]}-main.zip`;
      } else {
        return {success: false, output: 'Error: Invalid GitLab URL format'};
      }
    } else {
      return {success: false, output: 'Error: Only GitHub and GitLab are currently supported'};
    }

    // リポジトリをダウンロード
    const response = UrlFetchApp.fetch(repoUrl, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() !== 200) {
      // mainブランチが存在しない場合、masterブランチを試す
      if (url.includes('github.com')) {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
        repoUrl = `https://github.com/${match[1]}/${match[2]}/archive/refs/heads/master.zip`;
      } else if (url.includes('gitlab.com')) {
        const match = url.match(/gitlab\.com\/([^\/]+)\/([^\/\.]+)/);
        repoUrl = `https://gitlab.com/${match[1]}/${match[2]}/-/archive/master/${match[2]}-master.zip`;
      }

      const retryResponse = UrlFetchApp.fetch(repoUrl, {
        muteHttpExceptions: true,
        followRedirects: true
      });

      if (retryResponse.getResponseCode() !== 200) {
        return {success: false, output: `Error: Failed to download repository (HTTP ${response.getResponseCode()})`};
      }

      // 現在のフォルダにZIPファイルとして保存
      const currentFolder = getCurrentFolder();
      const blob = retryResponse.getBlob();
      const zipFile = currentFolder.createFile(blob.setName(`${repoName}.zip`));

      // ZIPファイルを解凍（Google Driveでは自動解凍されないため、zipのまま保存）
      let output = `Repository cloned successfully!\n`;
      output += `File: ${repoName}.zip\n`;
      output += `Location: ${getCurrentPath()}\n`;
      output += `Size: ${formatBytes(zipFile.getSize())}\n\n`;
      output += `Note: Repository downloaded as ZIP file. Extract manually if needed.`;

      return {success: true, output: output};
    }

    // 現在のフォルダにZIPファイルとして保存
    const currentFolder = getCurrentFolder();
    const blob = response.getBlob();
    const zipFile = currentFolder.createFile(blob.setName(`${repoName}.zip`));

    let output = `Repository cloned successfully!\n`;
    output += `File: ${repoName}.zip\n`;
    output += `Location: ${getCurrentPath()}\n`;
    output += `Size: ${formatBytes(zipFile.getSize())}\n\n`;
    output += `Note: Repository downloaded as ZIP file. Extract manually if needed.`;

    return {success: true, output: output};

  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdHelp(args) {
  const help = `
=== Google Drive CLI - Command Reference ===

NAVIGATION:
  ls                    List files and folders in current directory
  ls tree               Display directory tree structure
  pwd                   Print working directory (current path)
  cd <path>             Change directory
  cd ..                 Move to parent directory
  cd /                  Move to root directory
  find <name>           Find file/folder by exact name

FILE OPERATIONS:
  new <name> file       Create new text file
  new <name> dir        Create new folder
  new <name> form       Create Google Form
  new <name> sheet      Create Google Spreadsheet
  new <name> docs       Create Google Document
  new <name> slide      Create Google Slides
  touch <name>          Create empty text file
  mkdir <name>          Create new folder
  rn <old> <new>        Rename file or folder
  del <name>            Move file/folder to trash
  copy <name>           Copy file to clipboard
  paste                 Paste file from clipboard
  mv <src> <dst>        Move file/folder to destination
  cp <src> <dst>        Copy file to destination
  cat <name>            Display file content (text files only)

METADATA:
  stat <name>           Show detailed statistics
  url <name>            Get URL of file/folder
  open <name>           Open file/folder in new tab

SHARING:
  share <name> <email> <type>
                        Share with user (type: view/edit/comment)
  share <name> --link <type>
                        Enable link sharing
  share <name> --list   Show sharing settings

TRASH:
  trash                 List trashed items
  trash <name> restore  Restore item from trash

SPECIAL:
  clone <URL>           Clone Git repository (GitHub/GitLab)

UI CONTROL:
  clear                 Clear terminal screen
  reload                Reload page
  exit                  Close terminal tab
  color <color>         Change text color
                        (white/blue/green/red/yellow/cyan/magenta/black)

HELP:
  help                  Show this help message

Examples:
  > ls
  > cd Documents
  > mkdir Projects
  > touch notes.txt
  > cat notes.txt
  > mv report.txt Projects
  > cp important.doc Backup
  > share report.txt user@example.com view
  > share document.doc --link edit
  > share presentation.pptx --list
  > clone https://github.com/user/repository
  > cd ..
  > pwd

Note: <name> = file/folder name (can include spaces)
      <path> = directory path (absolute or relative)
      <URL>  = Git repository URL (GitHub/GitLab)

For detailed documentation, visit: /docs/command-detail.md
`;

  return {success: true, output: help};
}

// =====================================
// Utility Functions
// =====================================

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + units[i];
}

function padRight(str, width) {
  str = String(str);
  if (str.length >= width) {
    return str.substring(0, width - 3) + '...';
  }
  return str + ' '.repeat(width - str.length);
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

// =====================================
// UNIX-like Commands
// =====================================

function cmdMove(args) {
  if (args.length < 2) {
    return {success: false, output: 'Error: Usage: mv <source> <destination>'};
  }

  const destination = args[args.length - 1];
  const source = args.slice(0, -1).join(' ');
  const currentFolder = getCurrentFolder();

  try {
    // 移動元を検索
    let sourceItem = null;
    let isFolder = false;

    let folders = currentFolder.getFoldersByName(source);
    if (folders.hasNext()) {
      sourceItem = folders.next();
      isFolder = true;
    } else {
      let files = currentFolder.getFilesByName(source);
      if (files.hasNext()) {
        sourceItem = files.next();
        isFolder = false;
      }
    }

    if (!sourceItem) {
      return {success: false, output: `Error: '${source}' not found`};
    }

    // 移動先を検索
    let destFolder = currentFolder.getFoldersByName(destination);
    if (!destFolder.hasNext()) {
      return {success: false, output: `Error: Destination folder '${destination}' not found`};
    }

    const targetFolder = destFolder.next();

    // 移動を実行
    if (isFolder) {
      targetFolder.addFolder(sourceItem);
      currentFolder.removeFolder(sourceItem);
      return {success: true, output: `Moved directory: ${source} → ${destination}/`};
    } else {
      targetFolder.addFile(sourceItem);
      currentFolder.removeFile(sourceItem);
      return {success: true, output: `Moved file: ${source} → ${destination}/`};
    }

  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdCopyFile(args) {
  if (args.length < 2) {
    return {success: false, output: 'Error: Usage: cp <source> <destination>'};
  }

  const destination = args[args.length - 1];
  const source = args.slice(0, -1).join(' ');
  const currentFolder = getCurrentFolder();

  try {
    // コピー元のファイルを検索
    let files = currentFolder.getFilesByName(source);
    if (!files.hasNext()) {
      return {success: false, output: `Error: File '${source}' not found`};
    }

    const sourceFile = files.next();

    // コピー先を検索
    let destFolder = currentFolder.getFoldersByName(destination);
    if (!destFolder.hasNext()) {
      return {success: false, output: `Error: Destination folder '${destination}' not found`};
    }

    const targetFolder = destFolder.next();

    // コピーを実行
    const copiedFile = sourceFile.makeCopy(sourceFile.getName(), targetFolder);

    return {success: true, output: `Copied: ${source} → ${destination}/${copiedFile.getName()}`};

  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdTouch(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: touch <filename>'};
  }

  const name = args.join(' ');
  const currentFolder = getCurrentFolder();

  try {
    const file = currentFolder.createFile(name, '', MimeType.PLAIN_TEXT);
    return {success: true, output: `Created file: ${name}\nID: ${file.getId()}`};
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdMkdir(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: mkdir <directory>'};
  }

  const name = args.join(' ');
  const currentFolder = getCurrentFolder();

  try {
    const folder = currentFolder.createFolder(name);
    return {success: true, output: `Created directory: ${name}\nID: ${folder.getId()}`};
  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}

function cmdCat(args) {
  if (args.length === 0) {
    return {success: false, output: 'Error: Usage: cat <filename>'};
  }

  const name = args.join(' ');
  const currentFolder = getCurrentFolder();

  try {
    let files = currentFolder.getFilesByName(name);
    if (!files.hasNext()) {
      return {success: false, output: `Error: File '${name}' not found`};
    }

    const file = files.next();
    const mimeType = file.getMimeType();

    // テキストファイルのみサポート
    if (mimeType !== MimeType.PLAIN_TEXT && !mimeType.startsWith('text/')) {
      return {
        success: false,
        output: `Error: Cannot display content of '${name}'\nMIME type: ${mimeType}\nOnly text files are supported.`
      };
    }

    const content = file.getBlob().getDataAsString();

    // ファイルが空の場合
    if (content.length === 0) {
      return {success: true, output: `(empty file)`};
    }

    // 内容が長すぎる場合は制限する（最大5000文字）
    if (content.length > 5000) {
      return {
        success: true,
        output: content.substring(0, 5000) + `\n\n... (truncated, ${content.length - 5000} more characters)`
      };
    }

    return {success: true, output: content};

  } catch (error) {
    return {success: false, output: `Error: ${error.message}`};
  }
}