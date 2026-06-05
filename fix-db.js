const axios = require('axios');
async function pollFix() {
  console.log('Waiting for Coolify deployment to finish...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await axios.post('https://hrm.fixanyphoto.com/api/attendance/device-punch', {
        command: 'fix_json',
        logs: []
      }, {
        headers: { 'Authorization': 'Bearer my_secret_token_2026' }
      });
      if (res.data.message === 'Fixed JSON fields') {
        console.log('✅ DB JSON fixed successfully on production!');
        return;
      }
    } catch (e) {
      // Ignore errors, server might be restarting or returning 400
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log('Timeout waiting for deployment');
}
pollFix();
