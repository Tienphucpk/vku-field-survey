import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const srcDir = path.resolve('c:/Users/LENOVO/OneDrive/Desktop/Documents/PTUDDNT/vku-field-survey');
const destDir = path.resolve('C:/Users/LENOVO/StudioProjects/vku-field-survey');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (let item of fs.readdirSync(src)) {
    if (item === '.git' || item === 'node_modules' || item === 'dist' || item === '.idea') continue;
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  console.log('Copying updated project files to StudioProjects...');
  copyDir(srcDir, destDir);
  console.log('Files copied successfully!');

  console.log('Staging and committing in StudioProjects repository...');
  execSync('git add .', { cwd: destDir, stdio: 'inherit' });
  execSync('git commit -m "feat: setup capacitor android project and fix android studio build"', { cwd: destDir, stdio: 'inherit' });

  console.log('Pushing commit to GitHub...');
  execSync('git push origin master', { cwd: destDir, stdio: 'inherit' });
  console.log('🎉 Pushed to GitHub successfully!');
} catch (err) {
  console.error('Error:', err.message);
}
