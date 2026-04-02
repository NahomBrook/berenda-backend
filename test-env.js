require('dotenv').config();
console.log('CHAPA_SECRET_KEY:', process.env.CHAPA_SECRET_KEY ? '✅ LOADED' : '❌ NOT LOADED');
console.log('Key length:', process.env.CHAPA_SECRET_KEY?.length || 0);
console.log('First 10 chars:', process.env.CHAPA_SECRET_KEY?.substring(0, 10) || 'N/A');
