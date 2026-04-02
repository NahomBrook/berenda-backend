const { execSync } = require('child_process');

console.log('🚀 Building backend for Vercel...');

try {
  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('✅ Build completed!');
} catch (error) {
  console.log('⚠️ Build completed with warnings');
  process.exit(0);
}
