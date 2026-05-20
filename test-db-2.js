const mariadb = require('mariadb');
const pool = mariadb.createPool({
  host: 'localhost',
  port: 3306,
  user: 'tushar',
  password: 'password123',
  database: 'hrm_database',
  connectionLimit: 5
});
pool.getConnection()
  .then(conn => {
    console.log("Connected successfully to tushar");
    conn.query("SELECT 1 as val")
      .then(res => { console.log(res); conn.release(); pool.end(); })
      .catch(err => { console.error("Query error", err); conn.release(); pool.end(); });
  })
  .catch(err => {
    console.error("Connection failed", err);
  });
