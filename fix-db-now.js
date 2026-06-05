const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('https://hrm.fixanyphoto.com/api/attendance/device-punch', {
      command: 'fix_json',
      logs: [{ employeeId: 'dummy', timestamp: new Date().toISOString() }]
    }, {
      headers: { 'Authorization': 'Bearer my_secret_token_2026' }
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}
run();
