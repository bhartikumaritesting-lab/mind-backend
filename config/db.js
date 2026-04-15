const mysql = require('mysql2')

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'scribfun',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

console.log('MySQL Pool Created!')

module.exports = db
