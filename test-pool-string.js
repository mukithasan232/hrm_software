const mariadb = require('mariadb');
const pool = mariadb.createPool("mysql://tushar:password123@localhost:3306/hrm_database");
pool.getConnection()
  .then(conn => {
    console.log("Connected with string");
    conn.query("SELECT 1 as val")
      .then(res => { console.log(res); conn.release(); pool.end(); })
      .catch(err => { console.error("Query error", err); conn.release(); pool.end(); });
  })
  .catch(err => {
    console.error("Connection failed", err);
  });
