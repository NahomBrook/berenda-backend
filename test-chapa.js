require('dotenv').config();

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

async function testChapa() {
  console.log('🔑 Testing Chapa API...');
  console.log('Key loaded:', CHAPA_SECRET_KEY ? 'Yes' : 'No');
  
  if (!CHAPA_SECRET_KEY) {
    console.log('❌ CHAPA_SECRET_KEY not found in environment');
    return;
  }
  
  try {
    const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: '10',
        currency: 'ETB',
        email: 'test@berenda.com',
        tx_ref: `test_${Date.now()}`,
        first_name: 'Test',
        last_name: 'User',
        callback_url: 'http://localhost:5000/api/payments/webhook',
        return_url: 'http://localhost:3000/payment/verify',
      }),
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ Chapa API is working!');
      console.log('Checkout URL:', data.data?.checkout_url);
    } else {
      console.log('❌ Chapa API error:', data.message || data);
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
  }
}

testChapa();
