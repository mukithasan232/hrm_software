const { createPool } = require('mariadb');
try {
  const pool = createPool('mysql://root:@127.0.0.1:3306/hrm_database?connectTimeout=30000');
  console.log("Pool created successfully");
} catch(e) {
  console.error("Crash:", e);
}
