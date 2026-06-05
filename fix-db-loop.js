const axios = require('axios');
async function pollFix() {
  console.log('Waiting for Coolify deployment (aggressive fix)...');
  for (let i = 0; i < 60; i++) {
    try {
      const res = await axios.post('https://hrm.fixanyphoto.com/api/attendance/device-punch', {
        command: 'fix_json',
        logs: [{ employeeId: 'dummy', timestamp: new Date().toISOString() }]
      }, {
        headers: { 'Authorization': 'Bearer my_secret_token_2026' }
      });
      if (res.data.success) {
        console.log(`✅ DB JSON fixed: ${res.data.message}`);
        // TEST LOGIN
        try {
          const test = await axios.post('https://hrm.fixanyphoto.com/api/auth/login', {
            email: 'superadmin@hrm.test',
            password: 'SuperAdminPassword123'
          });
          console.log('✅ API is NOW WORKING! Login successful.');
          return;
        } catch(e) {
          console.log('Login still failing...');
        }
      }
    } catch (e) {
      process.stdout.write('.');
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log('Timeout');
}
pollFix();
