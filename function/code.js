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
  if (args.length < 3) {
    return {success: false, output: 'Error: Usage: share <name> <email> <type>\nTypes: view, edit, comment'};
  }
  
  const type = args[args.length - 1].toLowerCase();
  const email = args[args.length - 2];
  const name = args.slice(0, -2).join(' ');
  const currentFolder = getCurrentFolder();
  
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
        return {success: false, output: `Error: Unknown permission type '${type}'`};
    }
    
    return {success: true, output: `Shared ${name} with ${email} (${type})`};
    
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
  
  return {success: false, output: 'Error: Git clone not supported in Google Drive environment'};
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
  rn <old> <new>        Rename file or folder
  del <name>            Move file/folder to trash
  copy <name>           Copy file to clipboard
  paste                 Paste file from clipboard

METADATA:
  stat <name>           Show detailed statistics
  url <name>            Get URL of file/folder
  open <name>           Open file/folder in new tab

SHARING:
  share <name> <email> <type>
                        Share with user (type: view/edit/comment)

TRASH:
  trash                 List trashed items
  trash <name> restore  Restore item from trash

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
  > new report.txt file
  > stat report.txt
  > share report.txt user@example.com view
  > cd ..
  > pwd

Note: <n> = name (can include spaces)
      <path> = directory path (absolute or relative)
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