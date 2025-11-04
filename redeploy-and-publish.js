const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

console.log('🚀 Soufiam ERP - Redeploy and Publish Script');
console.log('==========================================\n');

// Deployment URLs
const BACKEND_URL = 'https://soufiam-erp-backend.onrender.com';
const FRONTEND_URL = 'https://runners-lb.vercel.app';

// Utility function to run commands
function runCommand(command, cwd = process.cwd()) {
  try {
    console.log(`\n📝 Running: ${command}`);
    const result = execSync(command, { 
      cwd, 
      stdio: 'inherit',
      encoding: 'utf8',
      shell: true
    });
    return { success: true, output: result };
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(`Error: ${error.message}`);
    return { success: false, error };
  }
}

// Step 1: Check git status
console.log('📋 Step 1: Checking Git Status');
console.log('-------------------------------');

const gitStatus = runCommand('git status --porcelain');
if (!gitStatus.success) {
  console.log('❌ Git status check failed. Make sure you are in a git repository.');
  process.exit(1);
}

// Step 2: Add all changes
console.log('\n📦 Step 2: Adding All Changes to Git');
console.log('-----------------------------------');

const gitAdd = runCommand('git add .');
if (!gitAdd.success) {
  console.log('❌ Failed to add changes');
  process.exit(1);
}
console.log('✅ All changes added to git');

// Step 3: Commit changes
console.log('\n💾 Step 3: Committing Changes');
console.log('----------------------------');

const commitMessage = `🚀 Redeploy ERP System - Renew Publishing Files

- Updated all application files
- Renewed deployment configurations
- Fixed any outstanding issues
- Ready for production deployment

Deployment Date: ${new Date().toISOString()}`;

const gitCommit = runCommand(`git commit -m "${commitMessage}"`);
if (!gitCommit.success) {
  // Check if there are actually changes to commit
  const statusCheck = runCommand('git diff --cached --quiet');
  if (statusCheck.success) {
    console.log('ℹ️  No changes to commit (everything already committed)');
  } else {
    console.log('❌ Failed to commit changes');
    process.exit(1);
  }
} else {
  console.log('✅ Changes committed successfully');
}

// Step 4: Push to remote repository
console.log('\n🚀 Step 4: Pushing to Remote Repository');
console.log('--------------------------------------');
console.log('⚠️  This will trigger automatic deployment on Render and Vercel...\n');

const gitPush = runCommand('git push origin main');
if (!gitPush.success) {
  console.log('❌ Failed to push changes');
  console.log('\n💡 Make sure you have:');
  console.log('   1. Configured git remote: git remote add origin <your-repo-url>');
  console.log('   2. Set up authentication for your git provider');
  process.exit(1);
}
console.log('✅ Changes pushed to remote repository');

// Step 5: Wait for deployment (Render and Vercel auto-deploy)
console.log('\n⏳ Step 5: Waiting for Deployment');
console.log('---------------------------------');
console.log('⚠️  Render and Vercel will automatically start deploying...');
console.log('    This may take 3-5 minutes for Render and 1-2 minutes for Vercel\n');

// Step 6: Display deployment information
console.log('\n🌐 Step 6: Deployment Information');
console.log('================================\n');

console.log('📡 YOUR DEPLOYMENT LINKS:');
console.log('─────────────────────────\n');
console.log(`🎯 Frontend (Vercel):`);
console.log(`   ${FRONTEND_URL}\n`);
console.log(`⚙️  Backend (Render):`);
console.log(`   ${BACKEND_URL}\n`);
console.log(`🔗 API Health Check:`);
console.log(`   ${BACKEND_URL}/api/health\n`);

console.log('🔑 Login Credentials:');
console.log('─────────────────────\n');
console.log('   Email: soufian@gmail.com');
console.log('   Password: Soufi@n123\n');
console.log('   OR\n');
console.log('   Email: admin@soufian.com');
console.log('   Password: admin123\n');

console.log('⏱️  Deployment Status:');
console.log('─────────────────────\n');
console.log('   ✅ Code pushed to repository');
console.log('   ⏳ Render backend deployment in progress...');
console.log('   ⏳ Vercel frontend deployment in progress...\n');

console.log('📊 Monitor Your Deployments:');
console.log('─────────────────────────────\n');
console.log('   Render Dashboard: https://dashboard.render.com');
console.log('   Vercel Dashboard: https://vercel.com/dashboard\n');

console.log('🧪 Test Your Deployment (after 3-5 minutes):');
console.log('─────────────────────────────────────────────\n');
console.log('   1. Visit frontend: ' + FRONTEND_URL);
console.log('   2. Test login with credentials above');
console.log('   3. Check backend health: ' + BACKEND_URL + '/api/health\n');

console.log('✅ Deployment Initiated Successfully!');
console.log('═════════════════════════════════════\n');
console.log('Your ERP system is being redeployed with all latest changes.');
console.log('Please wait 3-5 minutes for deployments to complete.');
console.log('You can monitor progress in your Render and Vercel dashboards.\n');
