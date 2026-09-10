import { execSync } from 'child_process';

try {
  console.log('Staging files...');
  execSync('git add package.json package-lock.json capacitor.config.json .gitignore android/app/src android/build.gradle android/gradle.properties android/gradle/ android/gradlew.bat android/settings.gradle android/variables.gradle', { stdio: 'inherit' });
  
  console.log('Committing changes...');
  execSync('git commit -m "feat: setup capacitor android project and fix android studio build"', { stdio: 'inherit' });
  
  console.log('Pushing to GitHub...');
  execSync('git push origin master', { stdio: 'inherit' });
  
  console.log('Pushed successfully to GitHub!');
} catch (err) {
  console.error('Git error:', err.message);
}
