const fs = require('fs');
const path = require('path');
const { log } = require('./logging.js');

async function backupCode(isImportant = false) {
  const rootDir = path.resolve(__dirname);
	const parentDir = path.join(rootDir, '../');
  const saveDir = path.join(parentDir, 'saves');
  const workingDir = path.join(saveDir, 'working');
  const brokenDir = path.join(saveDir, 'broken');
  
  const estDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const formattedDate = `${(estDate.getMonth() + 1).toString().padStart(2, '0')}-${estDate.getDate().toString().padStart(2, '0')}-${estDate.getFullYear()}`;
  const formattedTime = estDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/:/g, '-');
  
  const backupFileName = `full-code-${isImportant ? 'important-' : ''}${formattedDate}-${formattedTime}.txt`;
  const backupFilePath = path.join(saveDir, backupFileName);

  // Ensure directories exist
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir);
  }
  if (!fs.existsSync(workingDir)) {
    fs.mkdirSync(workingDir);
  }
  if (!fs.existsSync(brokenDir)) {
    fs.mkdirSync(brokenDir);
  }

  let combinedContent = '';

  function readJsFiles(dir) {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory() && !['node_modules', 'saves'].includes(file)) {
        readJsFiles(filePath);
      } else if (path.extname(file) === '.js') {
        combinedContent += `// File: ${filePath}\n`;
        combinedContent += fs.readFileSync(filePath, 'utf8');
        combinedContent += '\n\n';
      }
    });
  }

  readJsFiles(rootDir);

  // Write the backup file
  fs.writeFileSync(backupFilePath, combinedContent);
  log(`Backup created successfully at: ${backupFilePath}`);
  
  return backupFilePath;
}

module.exports = { backupCode };
